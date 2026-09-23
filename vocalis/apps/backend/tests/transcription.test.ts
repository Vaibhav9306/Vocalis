import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { azureOpenAIService } from '../src/services/azure';
import { AppError } from '../src/middleware/errorHandler';

describe('POST /api/transcription', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 400 if no audio file is provided', async () => {
    const res = await request(app)
      .post('/api/transcription')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUDIO_FILE_REQUIRED');
  });

  it('should return 415 if an unsupported file type is provided', async () => {
    const res = await request(app)
      .post('/api/transcription')
      .attach('audio', Buffer.from('plain text content'), 'document.txt');

    expect(res.status).toBe(415);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('should return 200 with transcript when Azure Whisper returns valid result', async () => {
    vi.spyOn(azureOpenAIService, 'transcribeAudio').mockResolvedValueOnce({
      fullText: 'Good morning everyone, let us begin the quarterly planning meeting.',
      chunks: [
        {
          id: 'seg-0',
          timestamp: '0.00s - 3.50s',
          text: 'Good morning everyone, let us begin the quarterly planning meeting.',
          isFinal: true,
        },
      ],
      durationSeconds: 3.5,
      language: 'en',
    });

    const fakeWavBuffer = Buffer.from('RIFF....WAVEfmt ....data....');

    const res = await request(app)
      .post('/api/transcription')
      .attach('audio', fakeWavBuffer, 'meeting_recording.wav');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.transcript).toBe('Good morning everyone, let us begin the quarterly planning meeting.');
    expect(res.body.language).toBe('en');
    expect(res.body.durationSeconds).toBe(3.5);
    expect(res.body.segments).toHaveLength(1);
  });

  it('should cleanly handle Azure failure and propagate appropriate error response', async () => {
    vi.spyOn(azureOpenAIService, 'transcribeAudio').mockRejectedValueOnce(
      new AppError('Azure Whisper rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED')
    );

    const fakeWavBuffer = Buffer.from('RIFF....WAVEfmt ....data....');

    const res = await request(app)
      .post('/api/transcription')
      .attach('audio', fakeWavBuffer, 'meeting_recording.mp3');

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.body.error.message).toContain('rate limit exceeded');
  });
});
