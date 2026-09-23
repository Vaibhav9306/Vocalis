import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { memoryService } from '../src/services/memory';
import { AppError } from '../src/middleware/errorHandler';

describe('Memory Routes (/api/memory)', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/memory', () => {
    // 1. Valid request
    it('should return 200 and stored memory DTO without raw embeddings', async () => {
      const mockMemoryDTO = {
        id: 'mem-uuid-1',
        text: 'We decided to release the mobile app on Friday.',
        meetingId: 'meeting-123',
        meetingTitle: 'Release Planning',
        source: 'meeting',
        createdAt: '2026-09-21T10:00:00.000Z',
      };

      vi.spyOn(memoryService, 'addTextMemory').mockResolvedValueOnce(mockMemoryDTO);

      const res = await request(app)
        .post('/api/memory')
        .send({
          text: 'We decided to release the mobile app on Friday.',
          meetingId: 'meeting-123',
          meetingTitle: 'Release Planning',
          source: 'meeting',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.memory).toEqual(mockMemoryDTO);
      // Ensure embedding is NOT returned
      expect(res.body.memory.embedding).toBeUndefined();
    });

    // 2. Missing text
    it('should return 400 when text is missing', async () => {
      const res = await request(app)
        .post('/api/memory')
        .send({ meetingId: 'meet-1' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toContain('Text is required');
    });

    // 3. Empty text
    it('should return 400 when text is empty or whitespace only', async () => {
      const res = await request(app)
        .post('/api/memory')
        .send({ text: '    ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
      expect(res.body.error.message).toContain('Text must not be empty');
    });

    // 4. Service failure
    it('should return error response when memoryService throws', async () => {
      vi.spyOn(memoryService, 'addTextMemory').mockRejectedValueOnce(
        new AppError('Azure OpenAI service is not configured', 503, 'AZURE_OPENAI_NOT_CONFIGURED')
      );

      const res = await request(app)
        .post('/api/memory')
        .send({ text: 'Some text' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AZURE_OPENAI_NOT_CONFIGURED');
    });
  });

  describe('POST /api/memory/search', () => {
    // 5. Valid search query
    it('should return 200 with ranked search results', async () => {
      const mockResults = [
        {
          memory: {
            id: 'mem-1',
            text: 'We decided to release the mobile app on Friday.',
            meetingId: 'meeting-123',
            meetingTitle: 'Release Planning',
            createdAt: '2026-09-21T10:00:00.000Z',
          },
          similarity: 0.91,
        },
      ];

      vi.spyOn(memoryService, 'searchMemory').mockResolvedValueOnce(mockResults);

      const res = await request(app)
        .post('/api/memory/search')
        .send({
          query: 'When are we releasing the mobile app?',
          topK: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toEqual(mockResults);
      expect(res.body.results[0].memory.embedding).toBeUndefined();
    });

    // 6. Empty search query
    it('should return 400 when search query is empty or missing', async () => {
      const res1 = await request(app)
        .post('/api/memory/search')
        .send({});

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.error.code).toBe('INVALID_REQUEST');

      const res2 = await request(app)
        .post('/api/memory/search')
        .send({ query: '   ' });

      expect(res2.status).toBe(400);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe('INVALID_REQUEST');
    });

    // 7. Invalid topK (0, negative, >50, float)
    it('should return 400 when topK is invalid', async () => {
      const resZero = await request(app)
        .post('/api/memory/search')
        .send({ query: 'release date', topK: 0 });

      expect(resZero.status).toBe(400);
      expect(resZero.body.error.code).toBe('INVALID_REQUEST');

      const resTooLarge = await request(app)
        .post('/api/memory/search')
        .send({ query: 'release date', topK: 51 });

      expect(resTooLarge.status).toBe(400);
      expect(resTooLarge.body.error.code).toBe('INVALID_REQUEST');

      const resFloat = await request(app)
        .post('/api/memory/search')
        .send({ query: 'release date', topK: 3.5 });

      expect(resFloat.status).toBe(400);
      expect(resFloat.body.error.code).toBe('INVALID_REQUEST');
    });

    // 8. Empty memory store search
    it('should return 200 with empty results array when store is empty', async () => {
      vi.spyOn(memoryService, 'searchMemory').mockResolvedValueOnce([]);

      const res = await request(app)
        .post('/api/memory/search')
        .send({ query: 'database optimization' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.results).toEqual([]);
    });
  });
});
