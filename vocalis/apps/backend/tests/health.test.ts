import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /health', () => {
  const app = createApp();

  it('should return 200 OK with valid health status and service metadata', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('azureOpenAI');
    expect(res.body.services).toHaveProperty('azureSpeech');
    expect(res.body.services.azureOpenAI).toHaveProperty('configured');
    expect(res.body.services.azureSpeech).toHaveProperty('configured');
  });

  it('should also respond at /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should return 404 for nonexistent routes', async () => {
    const res = await request(app).get('/nonexistent-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
