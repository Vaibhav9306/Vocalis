import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { SessionService } from '../src/services/session/sessionService';
import { azureOpenAIService } from '../src/services/azure';
import { memoryService } from '../src/services/memory';
import { IAzureOpenAIService } from '../src/services/azure/types';
import { IMemoryService } from '../src/services/memory/types';
import { AppError } from '../src/middleware/errorHandler';

describe('SessionService Unit Tests', () => {
  let mockAzure: Partial<IAzureOpenAIService>;
  let mockMemory: Partial<IMemoryService>;
  let service: SessionService;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockAzure = {
      transcribeAudio: vi.fn().mockResolvedValue({
        fullText: 'Hello team, welcome to the weekly sprint sync.',
        chunks: [
          {
            id: 'seg-0',
            timestamp: '0.00s - 3.00s',
            text: 'Hello team, welcome to the weekly sprint sync.',
            isFinal: true,
          },
        ],
        durationSeconds: 3.0,
      }),
      analyzeMeeting: vi.fn().mockResolvedValue({
        detectedQuestions: [
          {
            question: 'What is the release date?',
            context: 'Sprint sync discussion',
            suggestedAnswer: 'November 15th',
            confidence: 0.9,
          },
        ],
        keyPoints: ['Sprint sync started on time'],
        decisions: ['Deploy to staging next Tuesday'],
        actionItems: [
          {
            task: 'Prepare release notes',
            owner: 'Alice',
            deadline: 'Monday 5pm',
          },
        ],
        topics: ['Sprint Sync', 'Deployment'],
      }),
    };

    mockMemory = {
      addTextMemory: vi.fn().mockResolvedValue({
        id: 'mem-123',
        text: 'Decision: Deploy to staging next Tuesday',
        createdAt: new Date().toISOString(),
      }),
    };

    // Instantiate service with 0ms cooldown and 5-word threshold for responsive testing
    service = new SessionService(
      mockAzure as IAzureOpenAIService,
      mockMemory as IMemoryService,
      { analysisCooldownMs: 0, minWordThreshold: 5 }
    );
  });

  it('should create a new session with custom or default title', () => {
    const s1 = service.createSession('Custom Planning Session');
    expect(s1.id).toBeDefined();
    expect(s1.title).toBe('Custom Planning Session');
    expect(s1.status).toBe('active');
    expect(s1.chunks).toEqual([]);
    expect(s1.accumulatedTranscript).toBe('');

    const s2 = service.createSession();
    expect(s2.id).toBeDefined();
    expect(s2.title).toContain('Local Meeting');
    expect(s2.status).toBe('active');
  });

  it('should process audio chunks and accumulate transcript in correct order', async () => {
    const session = service.createSession('Order Test');

    (mockAzure.transcribeAudio as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        fullText: 'First sentence.',
        chunks: [],
        durationSeconds: 2.0,
      })
      .mockResolvedValueOnce({
        fullText: 'Second sentence.',
        chunks: [],
        durationSeconds: 2.5,
      });

    const fakeBuf = Buffer.from('fake-audio');
    const r1 = await service.processAudioChunk(session.id, 0, fakeBuf);
    expect(r1.chunk.sequenceNumber).toBe(0);
    expect(r1.chunk.text).toBe('First sentence.');
    expect(r1.accumulatedTranscript).toBe('First sentence.');

    const r2 = await service.processAudioChunk(session.id, 1, fakeBuf);
    expect(r2.chunk.sequenceNumber).toBe(1);
    expect(r2.chunk.text).toBe('Second sentence.');
    expect(r2.accumulatedTranscript).toBe('First sentence. Second sentence.');
  });

  it('should handle out-of-order chunks by sorting sequence numbers', async () => {
    const session = service.createSession('Out Of Order Test');

    (mockAzure.transcribeAudio as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        fullText: 'Part two.',
        chunks: [],
        durationSeconds: 2.0,
      })
      .mockResolvedValueOnce({
        fullText: 'Part one.',
        chunks: [],
        durationSeconds: 2.0,
      });

    const fakeBuf = Buffer.from('fake-audio');
    // Chunk 1 arrives before Chunk 0
    await service.processAudioChunk(session.id, 1, fakeBuf);
    const r0 = await service.processAudioChunk(session.id, 0, fakeBuf);

    // Accumulated transcript should be properly sorted: "Part one. Part two."
    expect(r0.accumulatedTranscript).toBe('Part one. Part two.');
    expect(service.getSession(session.id)!.chunks[0].sequenceNumber).toBe(0);
    expect(service.getSession(session.id)!.chunks[1].sequenceNumber).toBe(1);
  });

  it('should isolate Whisper failures without crashing or invalidating session', async () => {
    const session = service.createSession('Failure Resilience Test');

    (mockAzure.transcribeAudio as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Whisper connection dropped'))
      .mockResolvedValueOnce({
        fullText: 'Resumed speaking successfully.',
        chunks: [],
        durationSeconds: 3.0,
      });

    const fakeBuf = Buffer.from('fake-audio');

    // Chunk 0 fails
    const res0 = await service.processAudioChunk(session.id, 0, fakeBuf);
    expect(res0.chunk.status).toBe('failed');
    expect(res0.chunk.error).toBe('Whisper connection dropped');
    expect(res0.accumulatedTranscript).toBe('');

    // Chunk 1 succeeds
    const res1 = await service.processAudioChunk(session.id, 1, fakeBuf);
    expect(res1.chunk.status).toBe('completed');
    expect(res1.chunk.text).toBe('Resumed speaking successfully.');
    expect(res1.accumulatedTranscript).toBe('Resumed speaking successfully.');
    expect(service.getSession(session.id)!.status).toBe('active');
  });

  it('should trigger debounced analysis and persist decisions and action items to memory', async () => {
    const session = service.createSession('Analysis & Memory Test');

    (mockAzure.transcribeAudio as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      fullText: 'We agreed to deploy to staging next Tuesday and Alice will prepare release notes.',
      chunks: [],
      durationSeconds: 5.0,
    });

    const fakeBuf = Buffer.from('fake-audio');
    const result = await service.processAudioChunk(session.id, 0, fakeBuf);

    expect(mockAzure.analyzeMeeting).toHaveBeenCalled();
    expect(result.latestAnalysis).toBeDefined();
    expect(result.latestAnalysis?.decisions).toContain('Deploy to staging next Tuesday');

    // Memory persistence should have been called for both decision and action item
    expect(mockMemory.addTextMemory).toHaveBeenCalledTimes(2);
    expect(result.savedMemoriesCount).toBe(2);
  });

  it('should not persist duplicate decisions/actions on subsequent analysis cycles', async () => {
    const session = service.createSession('Deduplication Test');

    // Run first analysis pass
    session.accumulatedTranscript = 'We decided to deploy to staging next Tuesday.';
    await service.runAnalysisAndPersist(session.id, true);
    expect(mockMemory.addTextMemory).toHaveBeenCalledTimes(2); // 1 decision + 1 action item

    // Run second analysis pass with identical output from mock
    await service.runAnalysisAndPersist(session.id, true);
    // Should NOT have called addTextMemory again because keys were tracked
    expect(mockMemory.addTextMemory).toHaveBeenCalledTimes(2);
  });

  it('should finalize session and run final analysis upon endSession', async () => {
    const session = service.createSession('End Session Test');
    session.accumulatedTranscript = 'Final discussion points summarized here.';

    const finalized = await service.endSession(session.id);
    expect(finalized.status).toBe('completed');
    expect(finalized.endedAt).toBeDefined();

    // Verify cannot add more chunks to completed session
    await expect(
      service.processAudioChunk(session.id, 99, Buffer.from('test'))
    ).rejects.toThrow('already completed');
  });
});

describe('Live Meeting Session Routes (/api/sessions)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/sessions/start - should create a new session', async () => {
    const res = await request(app)
      .post('/api/sessions/start')
      .send({ title: 'Route Test Meeting' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.session.id).toBeDefined();
    expect(res.body.session.title).toBe('Route Test Meeting');
    expect(res.body.session.status).toBe('active');
  });

  it('GET /api/sessions - should list active sessions', async () => {
    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.sessions)).toBe(true);
  });

  it('GET /api/sessions/:id - should return 404 for non-existent session', async () => {
    const res = await request(app).get('/api/sessions/non-existent-uuid');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('POST /api/sessions/:id/chunks - should return 400 when audio file is missing', async () => {
    // Create session first
    const createRes = await request(app)
      .post('/api/sessions/start')
      .send({ title: 'Upload Test' });
    const sessionId = createRes.body.session.id;

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/chunks`)
      .field('sequenceNumber', '0');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('AUDIO_FILE_REQUIRED');
  });

  it('POST /api/sessions/:id/chunks - should successfully ingest and transcribe audio chunk', async () => {
    // Spy on Azure Whisper
    vi.spyOn(azureOpenAIService, 'transcribeAudio').mockResolvedValueOnce({
      fullText: 'Live transcribed audio chunk content.',
      chunks: [],
      durationSeconds: 5.0,
    });

    const createRes = await request(app)
      .post('/api/sessions/start')
      .send({ title: 'Full Chunk Integration Test' });
    const sessionId = createRes.body.session.id;

    const fakeAudioBuffer = Buffer.from('RIFF....WAVEfmt ....data....');

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/chunks`)
      .field('sequenceNumber', '0')
      .attach('audio', fakeAudioBuffer, 'chunk-0.webm');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.chunk.sequenceNumber).toBe(0);
    expect(res.body.chunk.text).toBe('Live transcribed audio chunk content.');
    expect(res.body.accumulatedTranscript).toBe('Live transcribed audio chunk content.');
  });

  it('POST /api/sessions/:id/stop - should finalize meeting session', async () => {
    const createRes = await request(app)
      .post('/api/sessions/start')
      .send({ title: 'Stop Test' });
    const sessionId = createRes.body.session.id;

    const stopRes = await request(app).post(`/api/sessions/${sessionId}/stop`);
    expect(stopRes.status).toBe(200);
    expect(stopRes.body.success).toBe(true);
    expect(stopRes.body.session.status).toBe('completed');
    expect(stopRes.body.session.endedAt).toBeDefined();
  });
});
