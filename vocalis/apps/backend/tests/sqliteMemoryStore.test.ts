import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { SqliteMemoryStore } from '../src/services/memory/sqliteMemoryStore';
import { MemoryRecord } from '../src/services/memory/types';

describe('SqliteMemoryStore', () => {
  const testDbDir = path.resolve(process.cwd(), 'data/test');
  const testDbPath = path.resolve(testDbDir, 'test_memory.db');
  let store: SqliteMemoryStore;

  const sampleRecord1: MemoryRecord = {
    id: 'mem-sqlite-1',
    text: 'Sarah will implement push notifications before Friday.',
    embedding: [1, 0, 0],
    createdAt: '2026-09-21T10:00:00.000Z',
    meetingId: 'meet-101',
    meetingTitle: 'Sprint Planning',
    source: 'meeting',
    metadata: { author: 'Sarah', priority: 'high' },
  };

  const sampleRecord2: MemoryRecord = {
    id: 'mem-sqlite-2',
    text: 'The team decided that the mobile app will be released on Friday.',
    embedding: [0.8, 0.6, 0],
    createdAt: '2026-09-21T10:05:00.000Z',
    meetingId: 'meet-101',
    meetingTitle: 'Sprint Planning',
    source: 'meeting',
    metadata: { decisionType: 'release' },
  };

  const sampleRecord3: MemoryRecord = {
    id: 'mem-sqlite-3',
    text: 'The next meeting will discuss database performance.',
    embedding: [0, 1, 0],
    createdAt: '2026-09-21T10:10:00.000Z',
    meetingId: 'meet-102',
    meetingTitle: 'Architecture Review',
    source: 'meeting',
  };

  beforeEach(() => {
    // Clean up previous test DB if exists
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {
        // ignore
      }
    }
    store = new SqliteMemoryStore(testDbPath);
  });

  afterEach(() => {
    store.close();
    // Clean up test DB files (including wal and shm if present)
    const files = [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`];
    files.forEach((f) => {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // ignore
        }
      }
    });
  });

  // 1. Database initialization
  it('should initialize database file and schema automatically', () => {
    expect(fs.existsSync(testDbPath)).toBe(true);
    expect(store.size()).toBe(0);
  });

  // 2. Insert memory
  it('should successfully insert and count memory records', async () => {
    const added = await store.add(sampleRecord1);
    expect(added.id).toBe('mem-sqlite-1');
    expect(store.size()).toBe(1);
  });

  // 3. Retrieve memory
  it('should retrieve stored memory by ID with accurate fields and metadata', async () => {
    await store.add(sampleRecord1);

    const retrieved = await store.getById('mem-sqlite-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe('mem-sqlite-1');
    expect(retrieved?.text).toBe(sampleRecord1.text);
    expect(retrieved?.embedding).toEqual(sampleRecord1.embedding);
    expect(retrieved?.meetingId).toBe('meet-101');
    expect(retrieved?.meetingTitle).toBe('Sprint Planning');
    expect(retrieved?.source).toBe('meeting');
    expect(retrieved?.metadata).toEqual({ author: 'Sarah', priority: 'high' });
  });

  // 4. Semantic search & top-K ranking
  it('should perform semantic search and rank results by cosine similarity descending', async () => {
    await store.add(sampleRecord1); // [1, 0, 0] -> similarity 1.0
    await store.add(sampleRecord2); // [0.8, 0.6, 0] -> similarity 0.8
    await store.add(sampleRecord3); // [0, 1, 0] -> similarity 0.0

    const queryEmbedding = [1, 0, 0];
    const results = await store.search(queryEmbedding, 3);

    expect(results).toHaveLength(3);
    expect(results[0].memory.id).toBe('mem-sqlite-1');
    expect(results[0].similarity).toBeCloseTo(1.0, 2);

    expect(results[1].memory.id).toBe('mem-sqlite-2');
    expect(results[1].similarity).toBeCloseTo(0.8, 2);

    expect(results[2].memory.id).toBe('mem-sqlite-3');
    expect(results[2].similarity).toBeCloseTo(0.0, 2);

    // Verify topK limits
    const top1 = await store.search(queryEmbedding, 1);
    expect(top1).toHaveLength(1);
    expect(top1[0].memory.id).toBe('mem-sqlite-1');
  });

  // 5. Metadata preservation
  it('should preserve and parse complex JSON metadata correctly', async () => {
    const recordWithMeta: MemoryRecord = {
      id: 'mem-meta',
      text: 'Testing metadata fidelity',
      embedding: [0.5, 0.5, 0.5],
      createdAt: '2026-09-21T10:00:00.000Z',
      metadata: {
        tags: ['backend', 'sqlite'],
        metrics: { latencyMs: 42, score: 0.99 },
        flag: true,
      },
    };

    await store.add(recordWithMeta);
    const retrieved = await store.getById('mem-meta');
    expect(retrieved?.metadata).toEqual({
      tags: ['backend', 'sqlite'],
      metrics: { latencyMs: 42, score: 0.99 },
      flag: true,
    });
  });

  // 6. Duplicate ID handling
  it('should throw controlled 409 error on duplicate ID insertion', async () => {
    await store.add(sampleRecord1);

    await expect(store.add(sampleRecord1)).rejects.toThrow(
      'Memory record with ID "mem-sqlite-1" already exists'
    );
  });

  // 7. Delete and clear
  it('should delete memory by ID and clear all memories', async () => {
    await store.add(sampleRecord1);
    await store.add(sampleRecord2);
    expect(store.size()).toBe(2);

    const deleted = await store.deleteById('mem-sqlite-1');
    expect(deleted).toBe(true);
    expect(store.size()).toBe(1);
    expect(await store.getById('mem-sqlite-1')).toBeNull();

    await store.clear();
    expect(store.size()).toBe(0);
    expect(await store.getAll()).toEqual([]);
  });

  // 8. SIMULATED RESTART PERSISTENCE TEST (Requirement 12)
  it('should persist memories across server restart (close -> reopen -> search)', async () => {
    // Step 1: Insert memories into first store instance
    await store.add(sampleRecord1);
    await store.add(sampleRecord2);
    await store.add(sampleRecord3);
    expect(store.size()).toBe(3);

    // Step 2: Simulate backend shutdown by closing the SQLite database
    store.close();

    // Step 3: Simulate backend startup by creating a new store instance pointing to the same file
    const restartedStore = new SqliteMemoryStore(testDbPath);
    try {
      expect(restartedStore.size()).toBe(3);

      // Step 4: Verify all records exist after restart
      const allMemories = await restartedStore.getAll();
      expect(allMemories).toHaveLength(3);

      // Step 5: Perform semantic search on the restarted store
      const queryEmbedding = [1, 0, 0];
      const results = await restartedStore.search(queryEmbedding, 2);

      // Step 6: Verify correct semantic ranking preserved
      expect(results).toHaveLength(2);
      expect(results[0].memory.id).toBe('mem-sqlite-1');
      expect(results[0].similarity).toBeCloseTo(1.0, 2);
      expect(results[1].memory.id).toBe('mem-sqlite-2');
      expect(results[1].similarity).toBeCloseTo(0.8, 2);
    } finally {
      restartedStore.close();
    }
  });

  // 9. Invalid / corrupt embedding handling
  it('should reject invalid embedding when adding memory', async () => {
    const invalidRecord = {
      ...sampleRecord1,
      id: 'mem-invalid-emb',
      embedding: [],
    };
    await expect(store.add(invalidRecord)).rejects.toThrow('Cannot store empty embedding vector');
  });
});
