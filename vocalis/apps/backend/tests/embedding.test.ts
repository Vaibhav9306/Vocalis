import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { azureOpenAIService, AzureOpenAIService } from '../src/services/azure';
import { AppError } from '../src/middleware/errorHandler';

describe('POST /api/embeddings', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Missing text in request body
  it('should return 400 when text is missing from request body', async () => {
    const res = await request(app)
      .post('/api/embeddings')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toContain('Text is required');
  });

  // 2. Non-string text
  it('should return 400 when text is not a string', async () => {
    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: 12345 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  // 3. Empty string
  it('should return 400 when text is empty', async () => {
    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toContain('Text must not be empty');
  });

  // 4. Whitespace-only string
  it('should return 400 when text contains only whitespace', async () => {
    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: '    \n\t   ' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toContain('Text must not be empty');
  });

  // 5. Exceeding max length
  it('should return 400 when text exceeds maximum character limit', async () => {
    const longText = 'a'.repeat(32001);
    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: longText });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
    expect(res.body.error.message).toContain('exceeds maximum supported length');
  });

  // 6. Successful mocked embedding response
  it('should return 200 with vector and dimensions for valid text', async () => {
    const mockVector = new Array(1536).fill(0.0123);
    const mockResult = {
      embedding: mockVector,
      dimensions: 1536,
      deployment: 'text-embedding-3-small',
      model: 'text-embedding-3-small',
      usage: { promptTokens: 5, totalTokens: 5 },
    };

    const spy = vi.spyOn(azureOpenAIService, 'createEmbedding').mockResolvedValueOnce(mockResult);

    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: 'Hello, this is a test of the AI meeting assistant embedding pipeline.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.embedding).toBeDefined();
    expect(res.body.embedding.dimensions).toBe(1536);
    expect(res.body.embedding.vector).toHaveLength(1536);
    expect(res.body.embedding.vector[0]).toBe(0.0123);
    expect(spy).toHaveBeenCalledWith('Hello, this is a test of the AI meeting assistant embedding pipeline.');
  });

  // 7. Azure API 401 Unauthorized
  it('should return 401 when Azure authentication fails', async () => {
    vi.spyOn(azureOpenAIService, 'createEmbedding').mockRejectedValueOnce(
      new AppError('Azure OpenAI authentication failed. Verify API key in .env', 401, 'AZURE_UNAUTHORIZED')
    );

    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: 'Sample text' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AZURE_UNAUTHORIZED');
  });

  // 8. Azure API 404 Deployment not found
  it('should return 404 when embedding deployment is not found on Azure endpoint', async () => {
    vi.spyOn(azureOpenAIService, 'createEmbedding').mockRejectedValueOnce(
      new AppError('Embedding deployment "text-embedding-3-small" not found on Azure endpoint.', 404, 'DEPLOYMENT_NOT_FOUND')
    );

    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: 'Sample text' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DEPLOYMENT_NOT_FOUND');
  });

  // 9. Azure API 429 Rate limited
  it('should return 429 when Azure OpenAI rate limit is exceeded', async () => {
    vi.spyOn(azureOpenAIService, 'createEmbedding').mockRejectedValueOnce(
      new AppError('Azure OpenAI rate limit exceeded. Please retry shortly.', 429, 'RATE_LIMITED')
    );

    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: 'Sample text' });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  // 10. Azure API 500 / 502 error
  it('should return 502 when Azure OpenAI returns an internal error', async () => {
    vi.spyOn(azureOpenAIService, 'createEmbedding').mockRejectedValueOnce(
      new AppError('Azure Embedding error (500): Internal server error', 502, 'AZURE_EMBEDDING_ERROR')
    );

    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: 'Sample text' });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AZURE_EMBEDDING_ERROR');
  });

  // 11. Gateway timeout (AbortError)
  it('should return 504 when embedding request times out', async () => {
    vi.spyOn(azureOpenAIService, 'createEmbedding').mockRejectedValueOnce(
      new AppError('Embedding generation request timed out after 30 seconds', 504, 'GATEWAY_TIMEOUT')
    );

    const res = await request(app)
      .post('/api/embeddings')
      .send({ text: 'Sample text' });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('GATEWAY_TIMEOUT');
  });
});

describe('AzureOpenAIService.createEmbedding unit tests', () => {
  it('should reject unconfigured service', async () => {
    const unconfigured = new AzureOpenAIService({});
    await expect(unconfigured.createEmbedding('valid text')).rejects.toThrow(
      'Azure OpenAI service is not configured'
    );
  });

  it('should reject empty text', async () => {
    const service = new AzureOpenAIService({
      endpoint: 'https://test.openai.azure.com',
      apiKey: 'test-key',
    });
    await expect(service.createEmbedding('')).rejects.toThrow('Text must not be empty');
  });

  it('should reject whitespace-only text', async () => {
    const service = new AzureOpenAIService({
      endpoint: 'https://test.openai.azure.com',
      apiKey: 'test-key',
    });
    await expect(service.createEmbedding('   \t\n  ')).rejects.toThrow('Text must not be empty');
  });

  it('should reject text exceeding maximum length', async () => {
    const service = new AzureOpenAIService({
      endpoint: 'https://test.openai.azure.com',
      apiKey: 'test-key',
    });
    await expect(service.createEmbedding('x'.repeat(32001))).rejects.toThrow(
      'Text exceeds maximum supported length'
    );
  });

  it('should successfully parse mocked Azure fetch response', async () => {
    const service = new AzureOpenAIService({
      endpoint: 'https://test.openai.azure.com',
      apiKey: 'test-key',
      deploymentEmbedding: 'text-embedding-3-small',
    });

    const mockVector = new Array(1536).fill(0.005);
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ index: 0, embedding: mockVector }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 4, total_tokens: 4 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await service.createEmbedding('Test sentence for vector embedding');

    expect(result.dimensions).toBe(1536);
    expect(result.embedding).toEqual(mockVector);
    expect(result.deployment).toBe('text-embedding-3-small');
    expect(result.usage).toEqual({ promptTokens: 4, totalTokens: 4 });

    vi.unstubAllGlobals();
  });
});
