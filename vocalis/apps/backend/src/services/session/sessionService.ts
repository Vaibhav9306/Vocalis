import { randomUUID } from 'crypto';
import {
  LiveMeetingSession,
  SessionTranscriptChunk,
  MeetingAnalysis,
  MeetingComment,
  AskScribeResponse,
} from '@meeting-assistant/shared-types';
import { ISessionService, ProcessChunkResult } from './types';
import { IAzureOpenAIService } from '../azure/types';
import { IMemoryService } from '../memory/types';
import { sqliteSessionStore } from './sqliteSessionStore';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface SessionServiceConfig {
  analysisCooldownMs?: number;
  minWordThreshold?: number;
}

export class SessionService implements ISessionService {
  private readonly azureOpenAIService: IAzureOpenAIService;
  private readonly memoryService: IMemoryService;
  private readonly sessions = new Map<string, LiveMeetingSession>();
  private readonly persistedMemoryKeys = new Map<string, Set<string>>();
  private readonly lastAnalysisTimestamp = new Map<string, number>();
  private readonly analyzingLocks = new Set<string>();

  private readonly analysisCooldownMs: number;
  private readonly minWordThreshold: number;

  constructor(
    azureOpenAIService: IAzureOpenAIService,
    memoryService: IMemoryService,
    config?: SessionServiceConfig
  ) {
    this.azureOpenAIService = azureOpenAIService;
    this.memoryService = memoryService;
    this.analysisCooldownMs = config?.analysisCooldownMs ?? 10000;
    this.minWordThreshold = config?.minWordThreshold ?? 15;

    // Hydrate existing sessions from SQLite store
    const stored = sqliteSessionStore.getAllSessions();
    for (const session of stored) {
      this.sessions.set(session.id, session);
      this.persistedMemoryKeys.set(session.id, new Set<string>());
      this.lastAnalysisTimestamp.set(session.id, 0);
    }
  }

  public createSession(title?: string, participants?: string[], tags?: string[]): LiveMeetingSession {
    const id = randomUUID();
    const now = new Date().toISOString();
    const nextNum = this.sessions.size + 1;
    const sessionTitle = title?.trim() || `Meeting #${nextNum}`;

    const session: LiveMeetingSession = {
      id,
      title: sessionTitle,
      status: 'active',
      startedAt: now,
      chunks: [],
      accumulatedTranscript: '',
      lastAnalyzedChunkIndex: -1,
      savedMemoriesCount: 0,
      participants: participants || ['You (Host)'],
      tags: tags || ['Live', 'P2P'],
      isFavorite: false,
      chapters: [],
      comments: [],
    };

    this.sessions.set(id, session);
    this.persistedMemoryKeys.set(id, new Set<string>());
    this.lastAnalysisTimestamp.set(id, 0);

    sqliteSessionStore.saveSession(session);

    logger.info('Created new meeting session', {
      sessionId: id,
      title: sessionTitle,
    }, 'SessionService');

    return session;
  }

  public async processAudioChunk(
    sessionId: string,
    sequenceNumber: number,
    audioBuffer: Buffer,
    filename = `chunk-${sequenceNumber}.webm`,
    mimeType = 'audio/webm'
  ): Promise<ProcessChunkResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError(`Meeting session "${sessionId}" not found.`, 404, 'SESSION_NOT_FOUND');
    }

    if (session.status === 'completed') {
      throw new AppError('Cannot add chunks to an already completed meeting session.', 400, 'SESSION_COMPLETED');
    }

    let chunkText = '';
    let durationSeconds: number | undefined;
    let chunkStatus: 'completed' | 'failed' = 'completed';
    let errorMessage: string | undefined;

    try {
      const transcriptionResult = await this.azureOpenAIService.transcribeAudio(
        audioBuffer,
        filename,
        mimeType
      );
      chunkText = transcriptionResult.fullText?.trim() || '';
      durationSeconds = transcriptionResult.durationSeconds;
    } catch (err) {
      chunkStatus = 'failed';
      errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      logger.error('Audio chunk transcription failed', { sessionId, sequenceNumber, error: errorMessage }, 'SessionService');
    }

    const mins = Math.floor((session.chunks.length * 5) / 60);
    const secs = (session.chunks.length * 5) % 60;
    const timestampStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const chunk: SessionTranscriptChunk = {
      sequenceNumber,
      receivedAt: new Date().toISOString(),
      timestamp: timestampStr,
      text: chunkText,
      durationSeconds,
      status: chunkStatus,
      error: errorMessage,
    };

    session.chunks.push(chunk);

    if (chunkText) {
      session.accumulatedTranscript = session.accumulatedTranscript
        ? `${session.accumulatedTranscript} ${chunkText}`
        : chunkText;
    }

    // Auto-generate chapters every 5 chunks
    if (session.chunks.length > 0 && session.chunks.length % 5 === 0) {
      const chapterIndex = Math.floor(session.chunks.length / 5);
      if (!session.chapters) session.chapters = [];
      session.chapters.push({
        id: `ch-${session.id}-${chapterIndex}`,
        title: `Discussion Topic ${chapterIndex}`,
        timestamp: timestampStr,
        timeSeconds: session.chunks.length * 5,
        summary: chunkText.slice(0, 100),
      });
    }

    if (this.shouldTriggerAutomaticAnalysis(session)) {
      this.runAnalysisAndPersist(sessionId, false).catch((err) => {
        logger.error('Background automatic analysis failed', { sessionId, error: String(err) }, 'SessionService');
      });
    }

    sqliteSessionStore.saveSession(session);

    return {
      chunk,
      accumulatedTranscript: session.accumulatedTranscript,
      latestAnalysis: session.latestAnalysis,
      savedMemoriesCount: session.savedMemoriesCount,
    };
  }

  public async addLiveTranscriptSegment(
    sessionId: string,
    text: string,
    durationSeconds = 5,
    speakerName?: string
  ): Promise<ProcessChunkResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError(`Meeting session "${sessionId}" not found.`, 404, 'SESSION_NOT_FOUND');
    }

    const trimmedText = text.trim();
    if (!trimmedText || trimmedText.length < 2) {
      return {
        chunk: session.chunks[session.chunks.length - 1] || {
          sequenceNumber: 0,
          receivedAt: new Date().toISOString(),
          timestamp: '00:00',
          text: '',
          status: 'completed',
        },
        accumulatedTranscript: session.accumulatedTranscript,
        latestAnalysis: session.latestAnalysis,
        savedMemoriesCount: session.savedMemoriesCount,
      };
    }

    // Helper to normalize text for fuzzy comparison (supports English & Devanagari Hindi)
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^\w\s\u0900-\u097F]/gi, '').replace(/\s+/g, ' ').trim();

    const normalizedNew = normalize(trimmedText);
    const lastChunk = session.chunks[session.chunks.length - 1];

    if (lastChunk) {
      const normalizedLast = normalize(lastChunk.text);

      // 1. Exact or near-exact duplicate detection (e.g. echo or double-fire)
      if (normalizedNew === normalizedLast || normalizedLast.endsWith(normalizedNew)) {
        logger.info('Suppressed duplicate transcript segment', { sessionId, text: trimmedText }, 'SessionService');
        return {
          chunk: lastChunk,
          accumulatedTranscript: session.accumulatedTranscript,
          latestAnalysis: session.latestAnalysis,
          savedMemoriesCount: session.savedMemoriesCount,
        };
      }

      // 2. Incremental extension detection (e.g. recognizer finalized prefix first, then fuller sentence)
      if (normalizedNew.startsWith(normalizedLast) && normalizedNew.length > normalizedLast.length) {
        lastChunk.text = trimmedText;
        lastChunk.receivedAt = new Date().toISOString();
        if (durationSeconds) lastChunk.durationSeconds = durationSeconds;

        // Rebuild accumulated transcript
        session.accumulatedTranscript = session.chunks
          .map((c) => `[${c.speakerName || 'Speaker'}]: ${c.text}`)
          .join('\n');

        sqliteSessionStore.saveSession(session);
        return {
          chunk: lastChunk,
          accumulatedTranscript: session.accumulatedTranscript,
          latestAnalysis: session.latestAnalysis,
          savedMemoriesCount: session.savedMemoriesCount,
        };
      }
    }

    // Determine speaker identification with verbal handoff and turn detection
    let resolvedSpeaker = speakerName?.trim();
    if (!resolvedSpeaker) {
      const prevText = lastChunk ? lastChunk.text : '';
      const handoffMatch = prevText.match(/(?:pass(?:ed)? the baton to|hand(?:ing)? over to|over to you,?|turn over to|unmute,?)\s+(?:my (?:good )?friend(?:, colleague and comrade)?\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      const selfIntroMatch = trimmedText.match(/^(?:Good morning everyone|Good evening|Hi everyone|Hello everyone|This is ([A-Z][a-z]+)|([A-Z][a-z]+) here)/i);

      if (handoffMatch && handoffMatch[1]) {
        resolvedSpeaker = handoffMatch[1].trim();
      } else if (selfIntroMatch) {
        if (selfIntroMatch[1]) resolvedSpeaker = selfIntroMatch[1].trim();
        else if (selfIntroMatch[2]) resolvedSpeaker = selfIntroMatch[2].trim();
        else {
          // New speaker greeting
          resolvedSpeaker = lastChunk?.speakerName === 'Speaker 1' ? 'Speaker 2' : (lastChunk?.speakerName === 'Speaker 2' ? 'Speaker 3' : 'Speaker 2');
        }
      } else if (trimmedText.endsWith('?') || (lastChunk && lastChunk.text.endsWith('?'))) {
        resolvedSpeaker = lastChunk?.speakerName === 'Speaker 1' ? 'Speaker 2' : 'Speaker 1';
      } else {
        resolvedSpeaker = lastChunk?.speakerName || 'Speaker 1';
      }
    }

    // 3. Natural conversational consolidation:
    // If the last chunk is from the SAME speaker, was received very recently (< 8 seconds ago), and has < 30 words,
    // merge into the current chunk instead of creating an artificial micro-chunk card.
    const now = Date.now();
    const lastReceivedTime = lastChunk ? new Date(lastChunk.receivedAt).getTime() : 0;
    const timeDiffSeconds = (now - lastReceivedTime) / 1000;
    const lastWordCount = lastChunk ? lastChunk.text.split(/\s+/).length : 0;

    if (
      lastChunk &&
      lastChunk.speakerName === resolvedSpeaker &&
      timeDiffSeconds < 8 &&
      lastWordCount < 30
    ) {
      lastChunk.text = `${lastChunk.text} ${trimmedText}`;
      lastChunk.receivedAt = new Date().toISOString();
      if (durationSeconds) {
        lastChunk.durationSeconds = (lastChunk.durationSeconds || 0) + durationSeconds;
      }

      // Rebuild accumulated transcript
      session.accumulatedTranscript = session.chunks
        .map((c) => `[${c.speakerName || 'Speaker'}]: ${c.text}`)
        .join('\n');

      if (this.shouldTriggerAutomaticAnalysis(session)) {
        this.runAnalysisAndPersist(sessionId, false).catch((err) => {
          logger.error('Background analysis failed', { sessionId, error: String(err) }, 'SessionService');
        });
      }

      sqliteSessionStore.saveSession(session);

      return {
        chunk: lastChunk,
        accumulatedTranscript: session.accumulatedTranscript,
        latestAnalysis: session.latestAnalysis,
        savedMemoriesCount: session.savedMemoriesCount,
      };
    }

    // 4. Create new distinct chunk
    const sequenceNumber = session.chunks.length + 1;
    const mins = Math.floor((session.chunks.length * 5) / 60);
    const secs = (session.chunks.length * 5) % 60;
    const timestampStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const chunk: SessionTranscriptChunk = {
      sequenceNumber,
      receivedAt: new Date().toISOString(),
      timestamp: timestampStr,
      text: trimmedText,
      speakerName: resolvedSpeaker,
      durationSeconds,
      status: 'completed',
    };

    session.chunks.push(chunk);
    session.accumulatedTranscript = session.accumulatedTranscript
      ? `${session.accumulatedTranscript}\n[${resolvedSpeaker}]: ${trimmedText}`
      : `[${resolvedSpeaker}]: ${trimmedText}`;

    if (this.shouldTriggerAutomaticAnalysis(session)) {
      this.runAnalysisAndPersist(sessionId, false).catch((err) => {
        logger.error('Background analysis failed', { sessionId, error: String(err) }, 'SessionService');
      });
    }

    sqliteSessionStore.saveSession(session);

    return {
      chunk,
      accumulatedTranscript: session.accumulatedTranscript,
      latestAnalysis: session.latestAnalysis,
      savedMemoriesCount: session.savedMemoriesCount,
    };
  }

  public async runAnalysisAndPersist(
    sessionId: string,
    force = false
  ): Promise<MeetingAnalysis | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError(`Meeting session "${sessionId}" not found.`, 404, 'SESSION_NOT_FOUND');
    }

    if (!session.accumulatedTranscript || session.accumulatedTranscript.trim().length === 0) {
      return session.latestAnalysis;
    }

    if (this.analyzingLocks.has(sessionId)) {
      return session.latestAnalysis;
    }

    this.analyzingLocks.add(sessionId);

    try {
      const analysis = await this.azureOpenAIService.analyzeMeeting({
        transcript: session.accumulatedTranscript,
        meetingTitle: session.title,
      });

      session.latestAnalysis = analysis;
      session.lastAnalyzedChunkIndex = session.chunks.length - 1;
      this.lastAnalysisTimestamp.set(sessionId, Date.now());

      let persistedKeys = this.persistedMemoryKeys.get(sessionId);
      if (!persistedKeys) {
        persistedKeys = new Set<string>();
        this.persistedMemoryKeys.set(sessionId, persistedKeys);
      }

      if (analysis.decisions && analysis.decisions.length > 0) {
        for (const decision of analysis.decisions) {
          const key = `decision:${decision.trim().toLowerCase()}`;
          if (!persistedKeys.has(key)) {
            persistedKeys.add(key);
            try {
              await this.memoryService.addTextMemory({
                text: `Decision in ${session.title}: ${decision}`,
                meetingId: session.id,
                meetingTitle: session.title,
                source: 'azure_openai_gpt41_mini',
                metadata: {
                  type: 'decision',
                  rawDecision: decision,
                  timestamp: new Date().toISOString(),
                },
              });
              session.savedMemoriesCount += 1;
            } catch (memErr) {
              logger.error('Failed to persist decision to memory', { sessionId, decision, error: String(memErr) }, 'SessionService');
            }
          }
        }
      }

      if (analysis.actionItems && analysis.actionItems.length > 0) {
        for (const item of analysis.actionItems) {
          const key = `action:${item.task.trim().toLowerCase()}`;
          if (!persistedKeys.has(key)) {
            persistedKeys.add(key);
            try {
              await this.memoryService.addTextMemory({
                text: `Action Item from ${session.title}: ${item.task}${item.owner ? ` (Assigned: ${item.owner})` : ''}${item.deadline ? ` [Due: ${item.deadline}]` : ''}`,
                meetingId: session.id,
                meetingTitle: session.title,
                source: 'azure_openai_gpt41_mini',
                metadata: {
                  type: 'action_item',
                  task: item.task,
                  owner: item.owner,
                  deadline: item.deadline,
                  timestamp: new Date().toISOString(),
                },
              });
              session.savedMemoriesCount += 1;
            } catch (memErr) {
              logger.error('Failed to persist action item to memory', { sessionId, task: item.task, error: String(memErr) }, 'SessionService');
            }
          }
        }
      }

      sqliteSessionStore.saveSession(session);
      return analysis;
    } finally {
      this.analyzingLocks.delete(sessionId);
    }
  }

  public async endSession(sessionId: string): Promise<LiveMeetingSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AppError(`Meeting session "${sessionId}" not found.`, 404, 'SESSION_NOT_FOUND');
    }

    session.status = 'completed';
    session.endedAt = new Date().toISOString();
    const durationSec = Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000);
    session.durationSeconds = durationSec > 0 ? durationSec : session.chunks.length * 5;

    if (session.accumulatedTranscript && session.accumulatedTranscript.length > 0) {
      try {
        await this.runAnalysisAndPersist(sessionId, true);
      } catch (err) {
        logger.error('Final analysis run failed upon session end', { sessionId, error: String(err) }, 'SessionService');
      }
    }

    sqliteSessionStore.saveSession(session);
    return session;
  }

  public getSession(sessionId: string): LiveMeetingSession | null {
    return this.sessions.get(sessionId) || sqliteSessionStore.getSession(sessionId) || null;
  }

  public listSessions(): LiveMeetingSession[] {
    return sqliteSessionStore.getAllSessions();
  }

  public updateSession(sessionId: string, updates: Partial<LiveMeetingSession>): LiveMeetingSession {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Meeting session "${sessionId}" not found.`, 404, 'SESSION_NOT_FOUND');
    }

    if (updates.title !== undefined) session.title = updates.title;
    if (updates.isFavorite !== undefined) session.isFavorite = updates.isFavorite;
    if (updates.tags !== undefined) session.tags = updates.tags;
    if (updates.participants !== undefined) session.participants = updates.participants;

    this.sessions.set(sessionId, session);
    sqliteSessionStore.saveSession(session);
    return session;
  }

  public deleteSession(sessionId: string): boolean {
    this.sessions.delete(sessionId);
    this.persistedMemoryKeys.delete(sessionId);
    this.lastAnalysisTimestamp.delete(sessionId);
    this.memoryService.deleteByMeetingId(sessionId).catch((err) => {
      logger.error('Failed to cascade delete memories for session', { sessionId, error: String(err) }, 'SessionService');
    });
    return sqliteSessionStore.deleteSession(sessionId);
  }

  public addComment(sessionId: string, comment: Omit<MeetingComment, 'id' | 'createdAt'>): MeetingComment {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Meeting session "${sessionId}" not found.`, 404, 'SESSION_NOT_FOUND');
    }

    const fullComment: MeetingComment = {
      ...comment,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };

    if (!session.comments) session.comments = [];
    session.comments.push(fullComment);

    this.sessions.set(sessionId, session);
    sqliteSessionStore.saveSession(session);
    return fullComment;
  }

  public async askMeeting(sessionId: string, query: string): Promise<AskScribeResponse> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new AppError(`Meeting session "${sessionId}" not found.`, 404, 'SESSION_NOT_FOUND');
    }

    const transcript = session.accumulatedTranscript || '';
    if (!transcript.trim()) {
      return {
        success: true,
        answer: 'This meeting currently has no recorded transcript to answer questions from.',
        citations: [],
      };
    }

    const matchingChunks = session.chunks.filter((c) =>
      query.toLowerCase().split(' ').some((word) => word.length > 3 && c.text.toLowerCase().includes(word))
    );

    const citations = (matchingChunks.length > 0 ? matchingChunks.slice(0, 3) : session.chunks.slice(0, 2)).map((c) => ({
      meetingId: session.id,
      meetingTitle: session.title,
      speakerName: c.speakerName || 'Speaker 1 (You)',
      timestamp: c.timestamp || '00:00',
      snippet: c.text,
      relevanceScore: 0.95,
    }));

    let answer = '';
    if (this.azureOpenAIService.isConfigured()) {
      try {
        const meetingContext = `Meeting Title: ${session.title}\nParticipants: ${session.participants?.join(', ') || 'N/A'}\nFull Transcript:\n${transcript}\nDecisions: ${session.latestAnalysis?.decisions?.join('; ') || 'None'}\nAction Items: ${session.latestAnalysis?.actionItems?.map(a => `${a.task} (Owner: ${a.owner || 'N/A'}, Due: ${a.deadline || 'N/A'})`).join('; ') || 'None'}`;
        answer = await this.azureOpenAIService.queryAssistant(query, {
          meetingId: session.id,
          transcript: meetingContext,
        });
      } catch (err) {
        logger.error('Azure OpenAI askMeeting failed, falling back to local synthesis', { sessionId, error: String(err) }, 'SessionService');
      }
    }

    if (!answer) {
      answer = `Based on the transcript from "${session.title}": `;
      if (session.latestAnalysis?.decisions?.some(d => query.toLowerCase().includes('decide') || query.toLowerCase().includes('decision'))) {
        answer += `The team agreed on: ${session.latestAnalysis.decisions.join('; ')}.`;
      } else if (session.latestAnalysis?.actionItems?.some(a => query.toLowerCase().includes('task') || query.toLowerCase().includes('action') || query.toLowerCase().includes('do'))) {
        answer += `Key action items include: ${session.latestAnalysis.actionItems.map(a => `${a.task} (Owner: ${a.owner || 'Unassigned'})`).join(', ')}.`;
      } else {
        answer += `The discussion covered: ${session.latestAnalysis?.topics?.join(', ') || 'key meeting topics'}. Relevant excerpt: "${citations[0]?.snippet || transcript.slice(0, 200)}".`;
      }
    }

    return {
      success: true,
      answer,
      citations,
    };
  }

  public async askGlobal(query: string): Promise<AskScribeResponse> {
    const memoryResults = await this.memoryService.searchMemory(query, 5);
    const sessions = this.listSessions();

    const citations = memoryResults.map((res) => {
      const matchedSession = sessions.find((s) => s.id === res.memory.meetingId);
      const matchingChunk = matchedSession?.chunks?.find(
        (c) => c.text.includes(res.memory.text) || res.memory.text.includes(c.text)
      );
      return {
        meetingId: res.memory.meetingId || matchedSession?.id || 'global',
        meetingTitle: res.memory.meetingTitle || matchedSession?.title || 'Meeting Session',
        speakerName: matchingChunk?.speakerName || (res.memory.metadata as any)?.speaker || 'Speaker 1 (You)',
        timestamp: matchingChunk?.timestamp || (res.memory.metadata as any)?.timestamp || '00:00',
        snippet: res.memory.text,
        relevanceScore: res.similarity,
      };
    });

    let answer = '';
    if (this.azureOpenAIService.isConfigured() && memoryResults.length > 0) {
      try {
        const memoryTexts = memoryResults.map(
          (m) => `[From "${m.memory.meetingTitle || 'Meeting'}"]: ${m.memory.text}`
        );
        answer = await this.azureOpenAIService.queryAssistant(query, {
          memories: memoryTexts,
        });
      } catch (err) {
        logger.error('Azure OpenAI askGlobal failed, falling back to synthesis', { error: String(err) }, 'SessionService');
      }
    }

    if (!answer) {
      if (citations.length > 0) {
        answer = `Found across your meeting memories: ${citations.map((c) => c.snippet).join(' · ')}`;
      } else {
        answer = `No specific meeting memories or transcripts matched "${query}". Record a live meeting or start a session to populate memory.`;
      }
    }

    return {
      success: true,
      answer,
      citations,
    };
  }

  public async askWithContext(query: string, transcript: string, meetingId?: string): Promise<AskScribeResponse> {
    let answer = '';
    if (this.azureOpenAIService.isConfigured() && transcript.trim()) {
      try {
        answer = await this.azureOpenAIService.queryAssistant(query, {
          meetingId: meetingId || 'live',
          transcript,
        });
      } catch (err) {
        logger.error('Azure OpenAI askWithContext failed', { error: String(err) }, 'SessionService');
      }
    }

    if (!answer) {
      answer = `Based on the live conversation so far: "${transcript.slice(-250)}"`;
    }

    const citations = [
      {
        meetingId: meetingId || 'live',
        meetingTitle: 'Current Live Meeting',
        speakerName: 'Live Speaker',
        timestamp: 'Live',
        snippet: transcript.length > 200 ? transcript.slice(-200) : transcript,
        relevanceScore: 0.99,
      },
    ];

    return {
      success: true,
      answer,
      citations,
    };
  }

  private shouldTriggerAutomaticAnalysis(session: LiveMeetingSession): boolean {
    const lastTimestamp = this.lastAnalysisTimestamp.get(session.id) || 0;
    const timeSinceLast = Date.now() - lastTimestamp;
    if (timeSinceLast < this.analysisCooldownMs) return false;

    const unanalyzedChunks = session.chunks.slice(session.lastAnalyzedChunkIndex + 1);
    const newWords = unanalyzedChunks
      .map((c) => c.text)
      .join(' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    return newWords >= this.minWordThreshold;
  }
}
