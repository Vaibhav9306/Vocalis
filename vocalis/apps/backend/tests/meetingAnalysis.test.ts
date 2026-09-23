import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { azureOpenAIService } from '../src/services/azure';
import { AppError } from '../src/middleware/errorHandler';

describe('POST /api/ai/analyze', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Missing transcript
  it('should return 400 when transcript is missing', async () => {
    const res = await request(app)
      .post('/api/ai/analyze')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  // 2. Empty transcript
  it('should return 400 when transcript is empty or whitespace only', async () => {
    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: '    ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  // 3. Valid transcript with full analysis
  it('should return 200 with structured analysis for a valid transcript', async () => {
    const mockAnalysis = {
      detectedQuestions: [
        {
          question: 'Can we add push notifications before release?',
          context: 'Sarah asked during launch planning',
          suggestedAnswer: 'Alex approved adding push notifications.',
          confidence: 0.95,
        },
      ],
      keyPoints: ['Mobile app release scheduled for Friday', 'Push notifications will be included'],
      decisions: ['Include push notifications in release', 'Release scheduled for Friday'],
      actionItems: [
        {
          task: 'Implement push notifications',
          owner: 'Sarah',
          deadline: 'Friday',
        },
      ],
      topics: ['Mobile App Release', 'Push Notifications'],
    };

    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockResolvedValueOnce(mockAnalysis);

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({
        transcript: 'Alex: Release Friday. Sarah: Add push notifications? Alex: Yes. Sarah: I will do it.',
        meetingTitle: 'Sprint Planning',
        participants: ['Alex', 'Sarah'],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.analysis).toEqual(mockAnalysis);
  });

  // 4. Transcript containing questions
  it('should correctly return detected questions with confidence and suggested answers', async () => {
    const mockAnalysis = {
      detectedQuestions: [
        {
          question: 'Who will prepare the deployment checklist?',
          context: 'Discussion around release readiness',
          suggestedAnswer: 'David volunteered to prepare the checklist.',
          confidence: 0.9,
        },
      ],
      keyPoints: ['Checklist needs to be prepared'],
      decisions: [],
      actionItems: [{ task: 'Prepare checklist', owner: 'David', deadline: null }],
      topics: ['Deployment Readiness'],
    };

    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockResolvedValueOnce(mockAnalysis);

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'Who will prepare the deployment checklist? David: I will.' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.detectedQuestions).toHaveLength(1);
    expect(res.body.analysis.detectedQuestions[0].confidence).toBe(0.9);
    expect(res.body.analysis.detectedQuestions[0].question).toContain('checklist');
  });

  // 5. Transcript containing decisions
  it('should extract explicit decisions agreed upon in the meeting', async () => {
    const mockAnalysis = {
      detectedQuestions: [],
      keyPoints: ['Database migration completed'],
      decisions: ['Use PostgreSQL for production service', 'Retain Redis for session caching'],
      actionItems: [],
      topics: ['Database Architecture'],
    };

    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockResolvedValueOnce(mockAnalysis);

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'We agreed to use PostgreSQL and keep Redis.' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.decisions).toHaveLength(2);
    expect(res.body.analysis.decisions).toContain('Use PostgreSQL for production service');
  });

  // 6. Transcript containing action items
  it('should extract action items with owner and deadline or null', async () => {
    const mockAnalysis = {
      detectedQuestions: [],
      keyPoints: ['Testing deadline'],
      decisions: [],
      actionItems: [
        { task: 'Run integration test suite', owner: 'Emma', deadline: 'Tomorrow 5 PM' },
        { task: 'Update API documentation', owner: null, deadline: null },
      ],
      topics: ['Testing', 'Documentation'],
    };

    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockResolvedValueOnce(mockAnalysis);

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'Emma will run integration tests by tomorrow 5 PM. Documentation needs updating.' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.actionItems).toHaveLength(2);
    expect(res.body.analysis.actionItems[0].owner).toBe('Emma');
    expect(res.body.analysis.actionItems[1].owner).toBeNull();
  });

  // 7. Transcript with no questions
  it('should return an empty detectedQuestions array if no questions were asked', async () => {
    const mockAnalysis = {
      detectedQuestions: [],
      keyPoints: ['Status update provided'],
      decisions: [],
      actionItems: [],
      topics: ['General Update'],
    };

    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockResolvedValueOnce(mockAnalysis);

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'Everything is progressing according to schedule. No blockers.' });

    expect(res.status).toBe(200);
    expect(res.body.analysis.detectedQuestions).toEqual([]);
  });

  // 8. Invalid AI response (malformed / non-JSON)
  it('should return 502 when AI response fails schema or JSON parsing', async () => {
    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockRejectedValueOnce(
      new AppError('AI returned malformed JSON response', 502, 'MALFORMED_AI_RESPONSE')
    );

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'Test meeting transcript' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('MALFORMED_AI_RESPONSE');
  });

  // 9. Confidence outside 0-1
  it('should return 502 when AI response contains confidence score outside 0-1', async () => {
    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockRejectedValueOnce(
      new AppError('AI response failed schema validation: detectedQuestions.0.confidence: Confidence must be between 0 and 1', 502, 'INVALID_AI_SCHEMA')
    );

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'Will this fail validation?' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_AI_SCHEMA');
  });

  // 10. Azure timeout handling
  it('should return 504 when Azure OpenAI request times out', async () => {
    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockRejectedValueOnce(
      new AppError('Meeting analysis request timed out after 60 seconds', 504, 'GATEWAY_TIMEOUT')
    );

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'Very long complex meeting transcript...' });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GATEWAY_TIMEOUT');
  });

  // 11. Azure API error (rate limiting / 429)
  it('should return 429 when Azure OpenAI rate limits the request', async () => {
    vi.spyOn(azureOpenAIService, 'analyzeMeeting').mockRejectedValueOnce(
      new AppError('Azure OpenAI rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED')
    );

    const res = await request(app)
      .post('/api/ai/analyze')
      .send({ transcript: 'Testing rate limit error handling' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
