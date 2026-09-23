import { randomUUID } from 'crypto';
import {
  IMemoryService,
  IMemoryStore,
  AddMemoryInput,
  MemoryRecord,
  MemoryRecordDTO,
  MemorySearchResult,
  toMemoryDTO,
} from './types';
import { IAzureOpenAIService } from '../azure/types';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export class MemoryService implements IMemoryService {
  private readonly azureOpenAIService: IAzureOpenAIService;
  private readonly store: IMemoryStore;

  constructor(azureOpenAIService: IAzureOpenAIService, store: IMemoryStore) {
    this.azureOpenAIService = azureOpenAIService;
    this.store = store;
  }

  public async addTextMemory(input: AddMemoryInput): Promise<MemoryRecordDTO> {
    const trimmedText = (input.text || '').trim();
    if (!trimmedText) {
      throw new AppError('Memory text must not be empty', 400, 'EMPTY_TEXT');
    }

    if (trimmedText.length > 32000) {
      throw new AppError(
        'Memory text exceeds maximum supported length (32,000 characters)',
        413,
        'TEXT_TOO_LARGE'
      );
    }

    logger.info('Generating embedding for new memory record', {
      textLength: trimmedText.length,
      meetingId: input.meetingId,
    }, 'MemoryService');

    const embeddingResult = await this.azureOpenAIService.createEmbedding(trimmedText);

    const record: MemoryRecord = {
      id: randomUUID(),
      text: trimmedText,
      embedding: embeddingResult.embedding,
      createdAt: new Date().toISOString(),
      meetingId: input.meetingId?.trim() || undefined,
      meetingTitle: input.meetingTitle?.trim() || undefined,
      source: input.source?.trim() || 'manual',
      metadata: input.metadata,
    };

    const stored = await this.store.add(record);
    logger.info('Successfully stored memory record', {
      id: stored.id,
      meetingId: stored.meetingId,
      dimensions: stored.embedding.length,
    }, 'MemoryService');

    return toMemoryDTO(stored);
  }

  public async searchMemory(query: string, topK = 5): Promise<MemorySearchResult[]> {
    const trimmedQuery = (query || '').trim();
    if (!trimmedQuery) {
      throw new AppError('Search query must not be empty', 400, 'EMPTY_QUERY');
    }

    if (trimmedQuery.length > 32000) {
      throw new AppError(
        'Search query exceeds maximum supported length (32,000 characters)',
        413,
        'QUERY_TOO_LARGE'
      );
    }

    const safeTopK = Number.isInteger(topK) && topK >= 1 ? Math.min(topK, 50) : 5;

    logger.info('Generating embedding for search query', {
      queryLength: trimmedQuery.length,
      topK: safeTopK,
    }, 'MemoryService');

    const queryEmbedding = await this.azureOpenAIService.createEmbedding(trimmedQuery);
    const results = await this.store.search(queryEmbedding.embedding, safeTopK);

    logger.info('Memory search completed', {
      matchesFound: results.length,
      topSimilarity: results[0]?.similarity,
    }, 'MemoryService');

    return results;
  }

  public async getMemoryById(id: string): Promise<MemoryRecordDTO | null> {
    const record = await this.store.getById(id);
    return record ? toMemoryDTO(record) : null;
  }

  public async getAllMemories(): Promise<MemoryRecordDTO[]> {
    const records = await this.store.getAll();
    return records.map(toMemoryDTO);
  }

  public async deleteMemoryById(id: string): Promise<boolean> {
    return this.store.deleteById(id);
  }

  public async deleteByMeetingId(meetingId: string): Promise<boolean> {
    return this.store.deleteByMeetingId(meetingId);
  }

  public async clearMemories(): Promise<void> {
    return this.store.clear();
  }
}
