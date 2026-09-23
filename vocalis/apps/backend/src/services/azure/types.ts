import {
  MeetingSummary,
  ActionItem,
  DetectedQuestion,
  TranscriptionChunk,
  ServiceStatus,
  MeetingAnalysis,
} from '@meeting-assistant/shared-types';
import { Readable } from 'stream';

export interface AzureOpenAIConfig {
  endpoint?: string;
  apiKey?: string;
  deploymentChat?: string;      // gpt-4.1-mini (Phase 3)
  deploymentWhisper?: string;   // whisper v001 (Phase 2)
  deploymentEmbedding?: string; // text-embedding-3-small (Phase 4)
  deployment?: string;          // fallback
}

export interface AzureSpeechConfig {
  key?: string;
  region?: string;
}

export interface SummaryOptions {
  focusAreas?: string[];
  maxTokens?: number;
  temperature?: number;
}

export interface TranscriptionOptions {
  language?: string;
  enableSpeakerDiarization?: boolean;
  model?: 'whisper' | 'azure-speech';
  prompt?: string;
  temperature?: number;
}

export interface TranscriptionResult {
  fullText: string;
  chunks: TranscriptionChunk[];
  durationSeconds?: number;
  language?: string;
}

export interface MeetingAnalysisInput {
  transcript: string;
  context?: string;
  meetingTitle?: string;
  participants?: string[];
}

export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  deployment?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Interface for Azure OpenAI operations:
 * Whisper Audio Transcription, Meeting Discourse Analysis (GPT-4.1-mini),
 * Text Embeddings (text-embedding-3-small), Summarization, Action Item Extraction,
 * Question Detection, and Interactive Q&A.
 */
export interface IAzureOpenAIService {
  getStatus(): ServiceStatus;
  isConfigured(): boolean;
  transcribeAudio(
    audioBuffer: Buffer,
    filename?: string,
    mimeType?: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>;
  analyzeMeeting(params: MeetingAnalysisInput): Promise<MeetingAnalysis>;
  createEmbedding(text: string): Promise<EmbeddingResult>;
  generateSummary(transcript: string, options?: SummaryOptions): Promise<MeetingSummary>;
  detectQuestions(transcript: string): Promise<DetectedQuestion[]>;
  extractActionItems(transcript: string): Promise<ActionItem[]>;
  queryAssistant(prompt: string, context?: { meetingId?: string; transcript?: string; memories?: string[] }): Promise<string>;
}

/**
 * Interface for Azure Speech & Whisper operations:
 * Batch audio transcription and real-time streaming audio transcription.
 */
export interface IAzureSpeechService {
  getStatus(): ServiceStatus;
  isConfigured(): boolean;
  transcribeAudio(audioBuffer: Buffer, options?: TranscriptionOptions): Promise<TranscriptionResult>;
  transcribeStream(
    audioStream: Readable,
    onChunk: (chunk: TranscriptionChunk) => void,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult>;
}
