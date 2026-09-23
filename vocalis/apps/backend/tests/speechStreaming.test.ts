import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import {
  AzureSpeechStreamingService,
} from '../src/services/azure/speechStreamingService';
import { SessionService } from '../src/services/session/sessionService';
import { IAzureOpenAIService } from '../src/services/azure/types';
import { IMemoryService } from '../src/services/memory/types';

// Mock the entire microsoft-cognitiveservices-speech-sdk module
vi.mock('microsoft-cognitiveservices-speech-sdk', () => {
  const mockPushStream = {
    write: vi.fn(),
    close: vi.fn(),
  };

  const mockAudioConfig = {};

  class MockSpeechRecognizer {
    public recognizing: ((s: unknown, e: { result: { text: string } }) => void) | null = null;
    public recognized: ((s: unknown, e: { result: { reason: number; text: string; duration?: number } }) => void) | null = null;
    public canceled: ((s: unknown, e: { reason: number; errorCode: number; errorDetails: string }) => void) | null = null;
    public sessionStopped: (() => void) | null = null;

    constructor() {
      (sdk as Record<string, unknown>).__latestMockRecognizer = this;
    }

    public startContinuousRecognitionAsync(onSuccess: () => void) {
      setTimeout(onSuccess, 5);
    }

    public stopContinuousRecognitionAsync(onSuccess: () => void) {
      setTimeout(onSuccess, 5);
    }

    public close = vi.fn();
  }

  return {
    __latestMockRecognizer: null as unknown,
    SpeechConfig: {
      fromSubscription: vi.fn().mockReturnValue({
        speechRecognitionLanguage: 'en-US',
        outputFormat: 1,
      }),
    },
    AudioStreamFormat: {
      getWaveFormatPCM: vi.fn().mockReturnValue({}),
    },
    AudioInputStream: {
      createPushStream: vi.fn().mockReturnValue(mockPushStream),
    },
    AudioConfig: {
      fromStreamInput: vi.fn().mockReturnValue(mockAudioConfig),
    },
    SpeechRecognizer: MockSpeechRecognizer,
    ResultReason: {
      RecognizedSpeech: 3,
      NoMatch: 1,
    },
    CancellationReason: {
      Error: 1,
      EndOfStream: 2,
    },
    OutputFormat: {
      Detailed: 1,
    },
  };
});

describe('AzureSpeechStreamingService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize and report configured state correctly', () => {
    const service = new AzureSpeechStreamingService('fake-speech-key', 'eastus2');
    expect(service.isConfigured()).toBe(true);

    const unconfigured = new AzureSpeechStreamingService('', '');
    expect(unconfigured.isConfigured()).toBe(false);
  });

  it('should start continuous recognition session and process audio frames', async () => {
    const service = new AzureSpeechStreamingService('fake-key', 'eastus2');

    const onInterim = vi.fn();
    const onFinal = vi.fn();
    const onError = vi.fn();

    const session = await service.startSession({
      onInterim,
      onFinal,
      onError,
    });

    expect(session.isActive()).toBe(true);

    // Feed audio buffer
    const pcmData = Buffer.from(new Int16Array([0, 100, 200, -100]).buffer);
    session.writeAudio(pcmData);

    const pushStream = sdk.AudioInputStream.createPushStream({} as never);
    expect(pushStream.write).toHaveBeenCalled();

    // Stop session
    await session.stop();
    expect(session.isActive()).toBe(false);
    expect(pushStream.close).toHaveBeenCalled();
  });

  it('should trigger onInterim callback when speech is recognizing', async () => {
    const service = new AzureSpeechStreamingService('fake-key', 'eastus2');
    const onInterim = vi.fn();

    const session = await service.startSession({
      onInterim,
      onFinal: vi.fn(),
      onError: vi.fn(),
    });

    // Simulate recognizer interim event
    const recognizerInstance = (sdk as Record<string, unknown>).__latestMockRecognizer as {
      recognizing: (s: unknown, e: unknown) => void;
    };
    recognizerInstance.recognizing(null, {
      result: { text: 'Hello team we are' },
    });

    expect(onInterim).toHaveBeenCalledWith('Hello team we are');
    await session.stop();
  });

  it('should trigger onFinal callback when speech is recognized with duration', async () => {
    const service = new AzureSpeechStreamingService('fake-key', 'eastus2');
    const onFinal = vi.fn();

    const session = await service.startSession({
      onInterim: vi.fn(),
      onFinal,
      onError: vi.fn(),
    });

    const recognizerInstance = (sdk as Record<string, unknown>).__latestMockRecognizer as {
      recognized: (s: unknown, e: unknown) => void;
    };
    recognizerInstance.recognized(null, {
      result: {
        reason: sdk.ResultReason.RecognizedSpeech,
        text: 'Welcome to the quarterly sync.',
        duration: 35000000, // 3.5 seconds in ticks
      },
    });

    expect(onFinal).toHaveBeenCalledWith('Welcome to the quarterly sync.', 3.5);
    await session.stop();
  });

  it('should propagate cancellation errors cleanly to onError callback', async () => {
    const service = new AzureSpeechStreamingService('fake-key', 'eastus2');
    const onError = vi.fn();

    const session = await service.startSession({
      onInterim: vi.fn(),
      onFinal: vi.fn(),
      onError,
    });

    const recognizerInstance = (sdk as Record<string, unknown>).__latestMockRecognizer as {
      canceled: (s: unknown, e: unknown) => void;
    };
    recognizerInstance.canceled(null, {
      reason: sdk.CancellationReason.Error,
      errorCode: 401,
      errorDetails: 'Authentication failed due to invalid subscription key',
    });

    expect(onError).toHaveBeenCalled();
    const callArg = onError.mock.calls[0][0];
    expect(callArg.message).toContain('Authentication failed');
    await session.stop();
  });
});

describe('SessionService Live Streaming Segment Integration', () => {
  let mockAzure: Partial<IAzureOpenAIService>;
  let mockMemory: Partial<IMemoryService>;
  let service: SessionService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAzure = {
      analyzeMeeting: vi.fn().mockResolvedValue({
        detectedQuestions: [
          {
            question: 'When is the code freeze?',
            context: 'Meeting sync',
            suggestedAnswer: 'Friday 5 PM',
            confidence: 0.95,
          },
        ],
        keyPoints: ['Live streaming recognition active'],
        decisions: ['Approved switching to Azure Speech continuous streaming'],
        actionItems: [
          {
            task: 'Deploy live streaming WebSocket to staging',
            owner: 'Agam',
            deadline: 'Tomorrow',
          },
        ],
        topics: ['Speech Streaming', 'Deployment'],
      }),
    };

    mockMemory = {
      addTextMemory: vi.fn().mockResolvedValue({
        id: 'mem-live-1',
        text: 'Decision: Approved switching to Azure Speech continuous streaming',
        createdAt: new Date().toISOString(),
      }),
    };

    service = new SessionService(
      mockAzure as IAzureOpenAIService,
      mockMemory as IMemoryService,
      { analysisCooldownMs: 0, minWordThreshold: 5 }
    );
  });

  it('should add live speech segments sequentially with correct ordering', async () => {
    const session = service.createSession('Live Stream Test');

    const r0 = await service.addLiveTranscriptSegment(
      session.id,
      'First recognized sentence.',
      2.5
    );
    expect(r0.chunk.sequenceNumber).toBe(0);
    expect(r0.chunk.text).toBe('First recognized sentence.');
    expect(r0.accumulatedTranscript).toBe('First recognized sentence.');

    const r1 = await service.addLiveTranscriptSegment(
      session.id,
      'Second recognized sentence.',
      3.0
    );
    expect(r1.chunk.sequenceNumber).toBe(1);
    expect(r1.chunk.text).toBe('Second recognized sentence.');
    expect(r1.accumulatedTranscript).toBe('First recognized sentence. Second recognized sentence.');

    const stored = service.getSession(session.id);
    expect(stored?.chunks).toHaveLength(2);
    expect(stored?.chunks[0].sequenceNumber).toBe(0);
    expect(stored?.chunks[1].sequenceNumber).toBe(1);
  });

  it('should trigger debounced analysis and persist decisions/actions to SQLite memory on live speech', async () => {
    const session = service.createSession('Live Analysis & Memory Test');

    // Add speech that meets the word threshold (>= 5 words)
    const result = await service.addLiveTranscriptSegment(
      session.id,
      'We decided to approve switching to Azure Speech continuous streaming and Agam will deploy tomorrow.',
      4.2
    );

    expect(mockAzure.analyzeMeeting).toHaveBeenCalled();
    expect(result.latestAnalysis).toBeDefined();
    expect(result.latestAnalysis?.decisions).toContain(
      'Approved switching to Azure Speech continuous streaming'
    );

    // Verified decisions and action items reached memory store
    expect(mockMemory.addTextMemory).toHaveBeenCalledTimes(2);
    expect(result.savedMemoriesCount).toBe(2);
  });

  it('should cleanly finalize live session on endSession', async () => {
    const session = service.createSession('Finalize Test');
    await service.addLiveTranscriptSegment(session.id, 'Final closing thoughts from the live sync.');

    const finalized = await service.endSession(session.id);
    expect(finalized.status).toBe('completed');
    expect(finalized.endedAt).toBeDefined();

    // Reject new live segments after session is completed
    await expect(
      service.addLiveTranscriptSegment(session.id, 'Post-meeting speech')
    ).rejects.toThrow('already completed');
  });
});
