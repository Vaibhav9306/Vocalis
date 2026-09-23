import { IMemoryStore, MemoryRecord, MemorySearchResult, toMemoryDTO } from './types';
import { cosineSimilarity } from '../../utils/cosineSimilarity';
import { logger } from '../../utils/logger';

/**
 * In-Memory implementation of IMemoryStore for Phase 4B.
 *
 * Characteristics:
 * - Process-local ephemeral memory store
 * - Calculates cosine similarity against all stored embeddings
 * - Deterministic, sorted descending by similarity score
 * - Safe for empty stores and variable topK
 * - Does not mutate stored memories or input embeddings
 */
export class InMemoryMemoryStore implements IMemoryStore {
  private readonly records: Map<string, MemoryRecord> = new Map();

  public async add(record: MemoryRecord): Promise<MemoryRecord> {
    if (!record.id) {
      throw new Error('MemoryRecord must have a non-empty id');
    }
    if (!Array.isArray(record.embedding) || record.embedding.length === 0) {
      throw new Error('MemoryRecord must contain a valid non-empty embedding vector');
    }

    // Clone record to prevent external mutation
    const cloned: MemoryRecord = {
      ...record,
      embedding: [...record.embedding],
      metadata: record.metadata ? { ...record.metadata } : undefined,
    };

    this.records.set(cloned.id, cloned);
    logger.debug('Stored memory record in memory store', { id: cloned.id, total: this.records.size }, 'MemoryStore');
    return { ...cloned, embedding: [...cloned.embedding] };
  }

  public async getById(id: string): Promise<MemoryRecord | null> {
    const record = this.records.get(id);
    if (!record) return null;
    return {
      ...record,
      embedding: [...record.embedding],
      metadata: record.metadata ? { ...record.metadata } : undefined,
    };
  }

  public async getAll(): Promise<MemoryRecord[]> {
    return Array.from(this.records.values()).map((r) => ({
      ...r,
      embedding: [...r.embedding],
      metadata: r.metadata ? { ...r.metadata } : undefined,
    }));
  }

  public async deleteById(id: string): Promise<boolean> {
    const deleted = this.records.delete(id);
    if (deleted) {
      logger.debug('Deleted memory record from memory store', { id, remaining: this.records.size }, 'MemoryStore');
    }
    return deleted;
  }

  public async deleteByMeetingId(meetingId: string): Promise<boolean> {
    let deletedCount = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.meetingId === meetingId) {
        this.records.delete(id);
        deletedCount++;
      }
    }
    logger.debug('Deleted memory records by meeting ID', { meetingId, deletedCount, remaining: this.records.size }, 'MemoryStore');
    return deletedCount > 0;
  }

  public async clear(): Promise<void> {
    const count = this.records.size;
    this.records.clear();
    logger.debug('Cleared all memory records', { clearedCount: count }, 'MemoryStore');
  }

  public async search(queryEmbedding: number[], topK: number): Promise<MemorySearchResult[]> {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new Error('queryEmbedding must be a non-empty array of numbers');
    }

    const safeTopK = Math.max(1, Math.min(50, Math.floor(topK)));

    if (this.records.size === 0) {
      return [];
    }

    const scored: Array<{ record: MemoryRecord; similarity: number }> = [];

    for (const record of this.records.values()) {
      const similarity = cosineSimilarity(queryEmbedding, record.embedding);
      scored.push({
        record,
        similarity,
      });
    }

    // Sort descending by similarity
    scored.sort((a, b) => b.similarity - a.similarity);

    // Take topK
    const topResults = scored.slice(0, safeTopK);

    return topResults.map((item) => ({
      memory: toMemoryDTO(item.record),
      similarity: Number(item.similarity.toFixed(4)), // 4 decimal places for clean representation
    }));
  }

  public size(): number {
    return this.records.size;
  }
}
