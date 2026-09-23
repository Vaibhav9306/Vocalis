import {
  IAzureOpenAIService,
  AzureOpenAIConfig,
  SummaryOptions,
  TranscriptionOptions,
  TranscriptionResult,
  MeetingAnalysisInput,
  EmbeddingResult,
} from './types';
import {
  MeetingSummary,
  ActionItem,
  DetectedQuestion,
  ServiceStatus,
  TranscriptionChunk,
  MeetingAnalysis,
} from '@meeting-assistant/shared-types';
import {
  MEETING_ANALYSIS_SYSTEM_PROMPT,
  buildMeetingAnalysisUserPrompt,
  meetingAnalysisSchema,
} from './prompts/meetingAnalysisPrompt';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export class AzureOpenAIService implements IAzureOpenAIService {
  private readonly endpoint?: string;
  private readonly apiKey?: string;
  private readonly deploymentChat: string;
  private readonly deploymentWhisper: string;
  private readonly deploymentEmbedding: string;

  constructor(config: AzureOpenAIConfig) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.deploymentChat = config.deploymentChat || config.deployment || 'gpt-4.1-mini';
    this.deploymentWhisper = config.deploymentWhisper || 'whisper';
    this.deploymentEmbedding = config.deploymentEmbedding || 'text-embedding-3-small';
  }

  public isConfigured(): boolean {
    return Boolean(this.endpoint && this.apiKey);
  }

  public getStatus(): ServiceStatus {
    const configured = this.isConfigured();
    return {
      configured,
      endpoint: this.endpoint ? this.maskEndpoint(this.endpoint) : undefined,
      deployment: `Whisper: ${this.deploymentWhisper} (v001) | Chat: ${this.deploymentChat} | Embeddings: ${this.deploymentEmbedding}`,
      notes: configured
        ? 'Azure OpenAI credentials configured'
        : 'Pending Azure model deployment & credential configuration in Phase 2',
    };
  }

  private maskEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.hostname}`;
    } catch {
      return 'configured';
    }
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new AppError(
        'Azure OpenAI service is not configured. Real model deployment and credentials will be connected in Phase 2.',
        503,
        'AZURE_OPENAI_NOT_CONFIGURED'
      );
    }
  }

  public async transcribeAudio(
    audioBuffer: Buffer,
    filename = 'meeting_audio.wav',
    mimeType = 'audio/wav',
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    this.ensureConfigured();

    const startTime = Date.now();
    const url = `${this.endpoint!.replace(/\/+$/, '')}/openai/deployments/${this.deploymentWhisper}/audio/transcriptions?api-version=2024-06-01`;

    logger.info('Sending audio transcription request to Azure Whisper', {
      deployment: this.deploymentWhisper,
      fileSizeBytes: audioBuffer.byteLength,
      filename,
      mimeType,
      language: options?.language,
    }, 'AzureWhisper');

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('response_format', 'verbose_json');

    if (options?.language) {
      formData.append('language', options.language);
    }

    const controller = new AbortController();
    const timeoutMs = 90000; // 90 seconds timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey!,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let parsedMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage = parsed.error?.message || parsed.message || errorText;
        } catch {
          // fallback to raw text
        }

        logger.error('Azure Whisper API returned error response', {
          statusCode: response.status,
          durationMs,
          deployment: this.deploymentWhisper,
          errorMessage: parsedMessage,
        }, 'AzureWhisper');

        if (response.status === 401) {
          throw new AppError('Azure OpenAI authentication failed. Verify API key in .env', 401, 'AZURE_UNAUTHORIZED');
        }
        if (response.status === 404) {
          throw new AppError(`Whisper deployment "${this.deploymentWhisper}" not found on Azure endpoint.`, 404, 'DEPLOYMENT_NOT_FOUND');
        }
        if (response.status === 429) {
          throw new AppError('Azure Whisper rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED');
        }

        throw new AppError(
          `Azure Whisper error (${response.status}): ${parsedMessage}`,
          response.status >= 500 ? 502 : response.status,
          'AZURE_WHISPER_ERROR'
        );
      }

      const data = (await response.json()) as {
        text?: string;
        language?: string;
        duration?: number;
        segments?: Array<{
          id: number;
          start: number;
          end: number;
          text: string;
        }>;
      };

      const fullText = (data.text || '').trim();
      const chunks: TranscriptionChunk[] = (data.segments || []).map((seg) => ({
        id: `seg-${seg.id}`,
        timestamp: `${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s`,
        text: seg.text.trim(),
        isFinal: true,
      }));

      if (chunks.length === 0 && fullText) {
        chunks.push({
          id: 'seg-0',
          timestamp: '0.00s',
          text: fullText,
          isFinal: true,
        });
      }

      logger.info('Azure Whisper transcription completed successfully', {
        durationMs,
        audioDurationSeconds: data.duration,
        language: data.language,
        transcriptLength: fullText.length,
        chunkCount: chunks.length,
      }, 'AzureWhisper');

      return {
        fullText,
        chunks,
        durationSeconds: data.duration,
        language: data.language,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) {
        throw err;
      }

      const error = err as Error;
      if (error.name === 'AbortError') {
        logger.error('Azure Whisper transcription request timed out', { timeoutMs }, 'AzureWhisper');
        throw new AppError(`Whisper transcription request timed out after ${timeoutMs / 1000} seconds`, 504, 'GATEWAY_TIMEOUT');
      }

      logger.error('Failed to communicate with Azure Whisper endpoint', {
        errorMessage: error.message,
      }, 'AzureWhisper');

      throw new AppError(`Failed to connect to Azure Whisper: ${error.message}`, 502, 'BAD_GATEWAY');
    }
  }

  public async analyzeMeeting(params: MeetingAnalysisInput): Promise<MeetingAnalysis> {
    this.ensureConfigured();

    const trimmedTranscript = (params.transcript || '').trim();
    if (!trimmedTranscript) {
      throw new AppError('Transcript must not be empty', 400, 'EMPTY_TRANSCRIPT');
    }

    if (trimmedTranscript.length > 100000) {
      throw new AppError(
        'Transcript exceeds maximum supported length (100,000 characters)',
        413,
        'TRANSCRIPT_TOO_LARGE'
      );
    }

    const startTime = Date.now();
    const url = `${this.endpoint!.replace(/\/+$/, '')}/openai/deployments/${this.deploymentChat}/chat/completions?api-version=2024-06-01`;

    const userPrompt = buildMeetingAnalysisUserPrompt(params);

    logger.info('Sending meeting analysis request to Azure OpenAI', {
      deployment: this.deploymentChat,
      transcriptLength: trimmedTranscript.length,
      hasContext: Boolean(params.context),
      participantCount: params.participants?.length || 0,
    }, 'AzureOpenAI');

    const controller = new AbortController();
    const timeoutMs = 60000; // 60s timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey!,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: MEETING_ANALYSIS_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let parsedMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage = parsed.error?.message || parsed.message || errorText;
        } catch {
          // fallback to raw text
        }

        logger.error('Azure OpenAI chat completion returned error response', {
          statusCode: response.status,
          durationMs,
          deployment: this.deploymentChat,
          errorMessage: parsedMessage,
        }, 'AzureOpenAI');

        if (response.status === 401) {
          throw new AppError('Azure OpenAI authentication failed. Verify API key in .env', 401, 'AZURE_UNAUTHORIZED');
        }
        if (response.status === 404) {
          throw new AppError(`Chat deployment "${this.deploymentChat}" not found on Azure endpoint.`, 404, 'DEPLOYMENT_NOT_FOUND');
        }
        if (response.status === 429) {
          throw new AppError('Azure OpenAI rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED');
        }

        throw new AppError(
          `Azure OpenAI error (${response.status}): ${parsedMessage}`,
          response.status >= 500 ? 502 : response.status,
          'AZURE_OPENAI_ERROR'
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new AppError('Azure OpenAI returned an empty response content', 502, 'EMPTY_AI_RESPONSE');
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawContent);
      } catch {
        logger.error('Failed to parse AI response as JSON', { rawContent }, 'AzureOpenAI');
        throw new AppError('AI returned malformed JSON response', 502, 'MALFORMED_AI_RESPONSE');
      }

      const validation = meetingAnalysisSchema.safeParse(parsedJson);
      if (!validation.success) {
        const issueSummary = validation.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        logger.error('AI response failed schema validation', { issues: issueSummary }, 'AzureOpenAI');
        throw new AppError(
          `AI response failed schema validation: ${issueSummary}`,
          502,
          'INVALID_AI_SCHEMA'
        );
      }

      logger.info('Meeting analysis completed successfully', {
        durationMs,
        usage: data.usage,
        questionCount: validation.data.detectedQuestions.length,
        keyPointCount: validation.data.keyPoints.length,
        decisionCount: validation.data.decisions.length,
        actionItemCount: validation.data.actionItems.length,
      }, 'AzureOpenAI');

      return validation.data;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) {
        throw err;
      }

      const error = err as Error;
      if (error.name === 'AbortError') {
        logger.error('Meeting analysis request timed out', { timeoutMs }, 'AzureOpenAI');
        throw new AppError(
          `Meeting analysis request timed out after ${timeoutMs / 1000} seconds`,
          504,
          'GATEWAY_TIMEOUT'
        );
      }

      logger.error('Failed to communicate with Azure OpenAI endpoint', {
        errorMessage: error.message,
      }, 'AzureOpenAI');

      throw new AppError(`Failed to connect to Azure OpenAI: ${error.message}`, 502, 'BAD_GATEWAY');
    }
  }

  public async createEmbedding(text: string): Promise<EmbeddingResult> {
    this.ensureConfigured();

    const trimmedText = (text || '').trim();
    if (!trimmedText) {
      throw new AppError('Text must not be empty', 400, 'EMPTY_TEXT');
    }

    if (trimmedText.length > 32000) {
      throw new AppError(
        'Text exceeds maximum supported length (32,000 characters)',
        413,
        'TEXT_TOO_LARGE'
      );
    }

    const startTime = Date.now();
    const url = `${this.endpoint!.replace(/\/+$/, '')}/openai/deployments/${this.deploymentEmbedding}/embeddings?api-version=2024-06-01`;

    logger.info('Sending embedding generation request to Azure OpenAI', {
      deployment: this.deploymentEmbedding,
      textLength: trimmedText.length,
    }, 'AzureOpenAI');

    const controller = new AbortController();
    const timeoutMs = 30000; // 30s timeout
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey!,
        },
        body: JSON.stringify({
          input: trimmedText,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let parsedMessage = errorText;
        try {
          const parsed = JSON.parse(errorText);
          parsedMessage = parsed.error?.message || parsed.message || errorText;
        } catch {
          // fallback to raw text
        }

        logger.error('Azure OpenAI embedding API returned error response', {
          statusCode: response.status,
          durationMs,
          deployment: this.deploymentEmbedding,
          errorMessage: parsedMessage,
        }, 'AzureOpenAI');

        if (response.status === 401) {
          throw new AppError('Azure OpenAI authentication failed. Verify API key in .env', 401, 'AZURE_UNAUTHORIZED');
        }
        if (response.status === 404) {
          throw new AppError(`Embedding deployment "${this.deploymentEmbedding}" not found on Azure endpoint.`, 404, 'DEPLOYMENT_NOT_FOUND');
        }
        if (response.status === 429) {
          throw new AppError('Azure OpenAI rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED');
        }

        throw new AppError(
          `Azure Embedding error (${response.status}): ${parsedMessage}`,
          response.status >= 500 ? 502 : response.status,
          'AZURE_EMBEDDING_ERROR'
        );
      }

      const data = (await response.json()) as {
        data?: Array<{
          embedding?: number[];
          index?: number;
        }>;
        model?: string;
        usage?: {
          prompt_tokens?: number;
          total_tokens?: number;
        };
      };

      const vector = data.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        logger.error('Azure OpenAI returned an invalid embedding vector', { data }, 'AzureOpenAI');
        throw new AppError('Azure OpenAI returned an invalid embedding response', 502, 'INVALID_EMBEDDING_RESPONSE');
      }

      logger.info('Azure OpenAI embedding generated successfully', {
        durationMs,
        dimensions: vector.length,
        deployment: this.deploymentEmbedding,
        usage: data.usage,
      }, 'AzureOpenAI');

      return {
        embedding: vector,
        dimensions: vector.length,
        deployment: this.deploymentEmbedding,
        model: data.model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) {
        throw err;
      }

      const error = err as Error;
      if (error.name === 'AbortError') {
        logger.error('Embedding generation request timed out', { timeoutMs }, 'AzureOpenAI');
        throw new AppError(
          `Embedding generation request timed out after ${timeoutMs / 1000} seconds`,
          504,
          'GATEWAY_TIMEOUT'
        );
      }

      logger.error('Failed to communicate with Azure OpenAI embedding endpoint', {
        errorMessage: error.message,
      }, 'AzureOpenAI');

      throw new AppError(`Failed to connect to Azure OpenAI embedding service: ${error.message}`, 502, 'BAD_GATEWAY');
    }
  }

  public async generateSummary(
    transcript: string,
    options?: SummaryOptions
  ): Promise<MeetingSummary> {
    const analysis = await this.analyzeMeeting({ transcript });
    return {
      meetingId: 'meeting-current',
      title: options?.focusAreas ? `Meeting: ${options.focusAreas.join(', ')}` : 'Meeting Summary',
      executiveSummary: analysis.keyPoints.join(' '),
      keyDiscussionPoints: analysis.keyPoints,
      actionItems: analysis.actionItems.map((a, idx) => ({
        id: `act-${idx}`,
        description: a.task,
        assignee: a.owner || undefined,
        dueDate: a.deadline || undefined,
        priority: 'medium',
      })),
      questionsDetected: analysis.detectedQuestions.map((q, idx) => ({
        id: `q-${idx}`,
        question: q.question,
        suggestedAnswer: q.suggestedAnswer,
        timestamp: '00:00',
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  public async detectQuestions(
    transcript: string
  ): Promise<DetectedQuestion[]> {
    const analysis = await this.analyzeMeeting({ transcript });
    return analysis.detectedQuestions.map((q, idx) => ({
      id: `q-${idx}`,
      question: q.question,
      suggestedAnswer: q.suggestedAnswer,
      timestamp: '00:00',
    }));
  }

  public async extractActionItems(
    transcript: string
  ): Promise<ActionItem[]> {
    const analysis = await this.analyzeMeeting({ transcript });
    return analysis.actionItems.map((a, idx) => ({
      id: `act-${idx}`,
      description: a.task,
      assignee: a.owner || undefined,
      dueDate: a.deadline || undefined,
      priority: 'medium',
    }));
  }

  public async queryAssistant(
    prompt: string,
    context?: { meetingId?: string; transcript?: string; memories?: string[] }
  ): Promise<string> {
    this.ensureConfigured();
    const startTime = Date.now();
    const url = `${this.endpoint!.replace(/\/+$/, '')}/openai/deployments/${this.deploymentChat}/chat/completions?api-version=2024-06-01`;

    const systemContent = `You are Vocalis, an advanced, highly capable AI Voice & Conversation Intelligence Assistant.
Your answers should be insightful, helpful, concise, and grounded in the conversation transcripts, shared stories, ideas, and memories provided.
You effortlessly understand all types of conversations — from informal chats between friends, creative rap/storytelling, and Hindi/Hinglish dialogue, to structured executive meetings.
Answer questions naturally and accurately based on the dialogue.`;

    let userContent = prompt;
    if (context?.transcript) {
      userContent = `Meeting Transcript & Context:\n${context.transcript}\n\nUser Question:\n${prompt}`;
    } else if (context?.memories && context.memories.length > 0) {
      userContent = `Relevant Indexed Meeting Memories & Agreements:\n${context.memories.join('\n---\n')}\n\nUser Question:\n${prompt}`;
    }

    const payload = {
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 800,
    };

    const controller = new AbortController();
    const timeoutMs = 45000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey!,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        logger.error('Azure OpenAI queryAssistant API error', {
          statusCode: response.status,
          deployment: this.deploymentChat,
          errorMessage: errText,
        }, 'AzureOpenAI');
        throw new AppError(`Azure OpenAI chat error: ${response.status}`, response.status, 'AZURE_CHAT_ERROR');
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const answer = data.choices?.[0]?.message?.content?.trim() || '';
      logger.info('Azure OpenAI queryAssistant answered successfully', {
        durationMs: Date.now() - startTime,
        answerLength: answer.length,
      }, 'AzureOpenAI');

      return answer;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof AppError) throw err;
      throw new AppError(`Failed to query Azure OpenAI assistant: ${(err as Error).message}`, 502, 'BAD_GATEWAY');
    }
  }
}
