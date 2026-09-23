import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryMemoryStore } from '../src/services/memory/inMemoryStore';
import { MemoryRecord } from '../src/services/memory/types';

describe('InMemoryMemoryStore', () => {
  let store: InMemoryMemoryStore;

  const sampleRecord1: MemoryRecord = {
    id: 'mem-1',
    text: 'Sarah will implement push notifications before Friday.',
    embedding: [1, 0, 0],
    createdAt: '2026-09-21T10:00:00.000Z',
    meetingId: 'meet-101',
    meetingTitle: 'Sprint Planning',
    source: 'meeting',
  };

  const sampleRecord2: MemoryRecord = {
    id: 'mem-2',
    text: 'The team decided that the mobile app will be released on Friday.',
    embedding: [0.8, 0.6, 0],
    createdAt: '2026-09-21T10:05:00.000Z',
    meetingId: 'meet-101',
    meetingTitle: 'Sprint Planning',
    source: 'meeting',
  };

  const sampleRecord3: MemoryRecord = {
    id: 'mem-3',
    text: 'The next meeting will discuss database performance.',
    embedding: [0, 1, 0],
    createdAt: '2026-09-21T10:10:00.000Z',
    meetingId: 'meet-102',
    meetingTitle: 'Architecture Review',
    source: 'meeting',
  };

  beforeEach(() => {
    store = new InMemoryMemoryStore();
  });

  // 1. Add memory
  it('should successfully add and retrieve a memory record', async () => {
    const added = await store.add(sampleRecord1);
    expect(added.id).toBe('mem-1');
    expect(store.size()).toBe(1);

    const retrieved = await store.getById('mem-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.text).toBe(sampleRecord1.text);
    expect(retrieved?.embedding).toEqual(sampleRecord1.embedding);
  });

  // 2. Get memory by id (existing and non-existing)
  it('should return null when retrieving a non-existent memory id', async () => {
    const retrieved = await store.getById('non-existent');
    expect(retrieved).toBeNull();
  });

  // 3. Get all
  it('should retrieve all stored memories', async () => {
    await store.add(sampleRecord1);
    await store.add(sampleRecord2);
    await store.add(sampleRecord3);

    const all = await store.getAll();
    expect(all).toHaveLength(3);
    expect(all.map((m) => m.id)).toEqual(['mem-1', 'mem-2', 'mem-3']);
  });

  // 4. Delete memory
  it('should delete memory by id', async () => {
    await store.add(sampleRecord1);
    await store.add(sampleRecord2);

    const deleted = await store.deleteById('mem-1');
    expect(deleted).toBe(true);
    expect(store.size()).toBe(1);

    const check = await store.getById('mem-1');
    expect(check).toBeNull();

    const deleteAgain = await store.deleteById('mem-1');
    expect(deleteAgain).toBe(false);
  });

  // 5. Clear memory
  it('should clear all stored memories', async () => {
    await store.add(sampleRecord1);
    await store.add(sampleRecord2);
    expect(store.size()).toBe(2);

    await store.clear();
    expect(store.size()).toBe(0);
    expect(await store.getAll()).toEqual([]);
  });

  // 6. Empty store search
  it('should return an empty array when searching an empty memory store', async () => {
    const results = await store.search([1, 0, 0], 5);
    expect(results).toEqual([]);
  });

  // 7. Ranking by similarity descending
  it('should rank search results in descending order of cosine similarity', async () => {
    await store.add(sampleRecord1); // [1, 0, 0] -> similarity with [1, 0, 0] = 1.0
    await store.add(sampleRecord2); // [0.8, 0.6, 0] -> similarity with [1, 0, 0] = 0.8
    await store.add(sampleRecord3); // [0, 1, 0] -> similarity with [1, 0, 0] = 0.0

    const queryEmbedding = [1, 0, 0];
    const results = await store.search(queryEmbedding, 3);

    expect(results).toHaveLength(3);
    expect(results[0].memory.id).toBe('mem-1');
    expect(results[0].similarity).toBeCloseTo(1.0, 2);

    expect(results[1].memory.id).toBe('mem-2');
    expect(results[1].similarity).toBeCloseTo(0.8, 2);

    expect(results[2].memory.id).toBe('mem-3');
    expect(results[2].similarity).toBeCloseTo(0.0, 2);

    // Verify ordering
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    expect(results[1].similarity).toBeGreaterThan(results[2].similarity);
  });

  // 8. TopK behavior
  it('should respect topK parameter and return at most topK results', async () => {
    await store.add(sampleRecord1);
    await store.add(sampleRecord2);
    await store.add(sampleRecord3);

    const top1 = await store.search([1, 0, 0], 1);
    expect(top1).toHaveLength(1);
    expect(top1[0].memory.id).toBe('mem-1');

    const top2 = await store.search([1, 0, 0], 2);
    expect(top2).toHaveLength(2);

    // If topK exceeds available items, return all available items
    const top10 = await store.search([1, 0, 0], 10);
    expect(top10).toHaveLength(3);
  });

  // 9. Stored embeddings remain unchanged
  it('should protect stored embeddings against mutations', async () => {
    const inputEmbedding = [1, 0, 0];
    const record: MemoryRecord = {
      id: 'mem-mut',
      text: 'Mutation test',
      embedding: inputEmbedding,
      createdAt: '2026-09-21T10:00:00.000Z',
    };

    await store.add(record);

    // Mutate the original external array
    inputEmbedding[0] = 999;

    const retrieved = await store.getById('mem-mut');
    expect(retrieved?.embedding[0]).toBe(1);

    // Mutate the retrieved array
    if (retrieved) {
      retrieved.embedding[0] = 888;
    }

    const retrievedAgain = await store.getById('mem-mut');
    expect(retrievedAgain?.embedding[0]).toBe(1);
  });
});
