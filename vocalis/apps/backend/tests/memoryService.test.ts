import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryService } from '../src/services/memory/memoryService';
import { InMemoryMemoryStore } from '../src/services/memory/inMemoryStore';
import { IAzureOpenAIService, EmbeddingResult } from '../src/services/azure/types';
import { AppError } from '../src/middleware/errorHandler';

describe('MemoryService', () => {
  let store: InMemoryMemoryStore;
  let mockAzureService: IAzureOpenAIService;
  let service: MemoryService;

  beforeEach(() => {
    store = new InMemoryMemoryStore();
    mockAzureService = {
      getStatus: vi.fn(),
      isConfigured: vi.fn().mockReturnValue(true),
      transcribeAudio: vi.fn(),
      analyzeMeeting: vi.fn(),
      generateSummary: vi.fn(),
      detectQuestions: vi.fn(),
      extractActionItems: vi.fn(),
      queryAssistant: vi.fn(),
      createEmbedding: vi.fn(),
    };
    service = new MemoryService(mockAzureService, store);
  });

  // 1. Add text → embedding → store
  it('should generate an embedding and store the memory record', async () => {
    const mockVector = new Array(1536).fill(0.01);
    const mockResult: EmbeddingResult = {
      embedding: mockVector,
      dimensions: 1536,
      deployment: 'text-embedding-3-small',
    };

    vi.spyOn(mockAzureService, 'createEmbedding').mockResolvedValueOnce(mockResult);

    const memory = await service.addTextMemory({
      text: 'The team will release the mobile app on Friday.',
      meetingId: 'meet-101',
      meetingTitle: 'Sprint Planning',
      source: 'meeting',
    });

    expect(memory.id).toBeDefined();
    expect(memory.text).toBe('The team will release the mobile app on Friday.');
    expect(memory.meetingId).toBe('meet-101');
    expect(memory.meetingTitle).toBe('Sprint Planning');
    expect(memory.source).toBe('meeting');
    expect(memory.createdAt).toBeDefined();

    // Verify embedding was passed to Azure service
    expect(mockAzureService.createEmbedding).toHaveBeenCalledWith(
      'The team will release the mobile app on Friday.'
    );

    // Verify record is retrievable in store
    const stored = await store.getById(memory.id);
    expect(stored).not.toBeNull();
    expect(stored?.embedding).toEqual(mockVector);
  });

  // 2. Search text → embedding → similarity search
  it('should generate an embedding for query and return ranked search results', async () => {
    // Populate store with two memories
    const vecA = [1, 0, 0];
    const vecB = [0, 1, 0];

    vi.spyOn(mockAzureService, 'createEmbedding')
      .mockResolvedValueOnce({ embedding: vecA, dimensions: 3 })
      .mockResolvedValueOnce({ embedding: vecB, dimensions: 3 });

    await service.addTextMemory({ text: 'Memory A' });
    await service.addTextMemory({ text: 'Memory B' });

    // Search query matches Memory A
    vi.spyOn(mockAzureService, 'createEmbedding').mockResolvedValueOnce({
      embedding: [1, 0, 0],
      dimensions: 3,
    });

    const results = await service.searchMemory('Query matching Memory A', 5);

    expect(results).toHaveLength(2);
    expect(results[0].memory.text).toBe('Memory A');
    expect(results[0].similarity).toBeCloseTo(1.0, 2);
    expect(results[1].memory.text).toBe('Memory B');
    expect(results[1].similarity).toBeCloseTo(0.0, 2);
  });

  // 3. Embedding failure handling
  it('should propagate errors when Azure embedding generation fails', async () => {
    vi.spyOn(mockAzureService, 'createEmbedding').mockRejectedValueOnce(
      new AppError('Azure OpenAI rate limit exceeded', 429, 'RATE_LIMITED')
    );

    await expect(service.addTextMemory({ text: 'Sample text' })).rejects.toThrow(
      'Azure OpenAI rate limit exceeded'
    );
  });

  // 4. Empty text validation
  it('should reject empty or whitespace-only input text', async () => {
    await expect(service.addTextMemory({ text: '' })).rejects.toThrow(
      'Memory text must not be empty'
    );
    await expect(service.addTextMemory({ text: '    ' })).rejects.toThrow(
      'Memory text must not be empty'
    );
  });

  // 5. Empty query validation
  it('should reject empty or whitespace-only search queries', async () => {
    await expect(service.searchMemory('')).rejects.toThrow(
      'Search query must not be empty'
    );
    await expect(service.searchMemory('   ')).rejects.toThrow(
      'Search query must not be empty'
    );
  });

  // 6. Max length validation
  it('should reject text exceeding maximum length', async () => {
    await expect(service.addTextMemory({ text: 'x'.repeat(32001) })).rejects.toThrow(
      'exceeds maximum supported length'
    );
    await expect(service.searchMemory('x'.repeat(32001))).rejects.toThrow(
      'exceeds maximum supported length'
    );
  });
});
