import path from 'path';
import fs from 'fs';
import { IMemoryStore, MemoryRecord, MemorySearchResult, toMemoryDTO } from './types';
import { cosineSimilarity } from '../../utils/cosineSimilarity';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

interface StatementSync {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown | undefined;
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

interface DatabaseSync {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  isOpen: boolean;
}

// Dynamically load native Node 24 SQLite module to prevent Vite/Vitest static resolution failure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NodeDatabaseSync: new (location: string, options?: any) => DatabaseSync = (
  eval('require')('node:sqlite')
).DatabaseSync;

interface MemoryRow {
  id: string;
  text: string;
  embedding: Buffer | Uint8Array;
  created_at: string;
  meeting_id: string | null;
  meeting_title: string | null;
  source: string | null;
  metadata: string | null;
}

/**
 * SQLite-backed persistent implementation of IMemoryStore (Phase 4C).
 *
 * Characteristics:
 * - Persists meeting memories and embeddings across server restarts
 * - Binary BLOB storage for Float32 embeddings (6,144 bytes per 1536-dim vector)
 * - Automatic directory and schema migration on startup
 * - Indexed by meeting_id and created_at for fast retrieval
 * - Cosine similarity ranking preserving exact Phase 4B semantics
 */
export class SqliteMemoryStore implements IMemoryStore {
  private db: DatabaseSync;
  private readonly dbPath: string;

  private stmtInsert!: StatementSync;
  private stmtGetById!: StatementSync;
  private stmtGetAll!: StatementSync;
  private stmtDeleteById!: StatementSync;
  private stmtDeleteByMeetingId!: StatementSync;
  private stmtClear!: StatementSync;
  private stmtCount!: StatementSync;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.resolve(process.cwd(), 'data/memory.db');
    this.db = this.initDatabase();
    this.prepareStatements();
  }

  private initDatabase(): DatabaseSync {
    try {
      if (this.dbPath !== ':memory:') {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      const db = new NodeDatabaseSync(this.dbPath);

      // Enable WAL mode, busy timeout, and normal synchronous for high reliability and concurrency
      db.exec('PRAGMA busy_timeout = 5000;');
      if (this.dbPath !== ':memory:') {
        db.exec('PRAGMA journal_mode = WAL;');
      }
      db.exec('PRAGMA synchronous = NORMAL;');

      // Create memories table
      db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          embedding BLOB NOT NULL,
          created_at TEXT NOT NULL,
          meeting_id TEXT,
          meeting_title TEXT,
          source TEXT,
          metadata TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_memories_meeting_id ON memories(meeting_id);
        CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
      `);

      logger.info('SQLite memory store initialized successfully', {
        dbPath: this.dbPath,
      }, 'SqliteMemoryStore');

      return db;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to initialize SQLite memory store', { error: message, dbPath: this.dbPath }, 'SqliteMemoryStore');
      throw new AppError(`Failed to initialize SQLite memory store: ${message}`, 500, 'DATABASE_INIT_ERROR');
    }
  }

  private prepareStatements(): void {
    this.stmtInsert = this.db.prepare(`
      INSERT INTO memories (id, text, embedding, created_at, meeting_id, meeting_title, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtGetById = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    this.stmtGetAll = this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC');
    this.stmtDeleteById = this.db.prepare('DELETE FROM memories WHERE id = ?');
    this.stmtDeleteByMeetingId = this.db.prepare('DELETE FROM memories WHERE meeting_id = ?');
    this.stmtClear = this.db.prepare('DELETE FROM memories');
    this.stmtCount = this.db.prepare('SELECT COUNT(*) as count FROM memories');
  }

  private serializeEmbedding(embedding: number[]): Buffer {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new AppError('Cannot store empty embedding vector', 400, 'INVALID_EMBEDDING');
    }
    const f32 = new Float32Array(embedding);
    return Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);
  }

  private deserializeEmbedding(blob: unknown): number[] {
    if (!blob || !(blob instanceof Uint8Array || Buffer.isBuffer(blob))) {
      throw new AppError('Invalid or corrupt embedding BLOB found in storage', 500, 'CORRUPT_EMBEDDING');
    }
    if (blob.byteLength % 4 !== 0) {
      throw new AppError(
        `Invalid embedding BLOB byteLength ${blob.byteLength}; expected multiple of 4`,
        500,
        'CORRUPT_EMBEDDING'
      );
    }
    const f32 = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
    return Array.from(f32);
  }

  private rowToRecord(row: MemoryRow): MemoryRecord {
    return {
      id: row.id,
      text: row.text,
      embedding: this.deserializeEmbedding(row.embedding),
      createdAt: row.created_at,
      meetingId: row.meeting_id || undefined,
      meetingTitle: row.meeting_title || undefined,
      source: row.source || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  public async add(record: MemoryRecord): Promise<MemoryRecord> {
    if (!record.id) {
      throw new AppError('MemoryRecord must have a non-empty id', 400, 'INVALID_RECORD_ID');
    }
    if (!record.text || !record.text.trim()) {
      throw new AppError('MemoryRecord text must not be empty', 400, 'EMPTY_TEXT');
    }

    const embeddingBlob = this.serializeEmbedding(record.embedding);
    const metadataStr = record.metadata ? JSON.stringify(record.metadata) : null;

    try {
      this.stmtInsert.run(
        record.id,
        record.text,
        embeddingBlob,
        record.createdAt,
        record.meetingId || null,
        record.meetingTitle || null,
        record.source || null,
        metadataStr
      );

      logger.debug('Stored memory record in SQLite', { id: record.id }, 'SqliteMemoryStore');
      return {
        ...record,
        embedding: [...record.embedding],
        metadata: record.metadata ? { ...record.metadata } : undefined,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('UNIQUE constraint failed') || errorMsg.includes('PRIMARY KEY')) {
        throw new AppError(`Memory record with ID "${record.id}" already exists`, 409, 'DUPLICATE_MEMORY_ID');
      }
      logger.error('Failed to insert memory record into SQLite', { id: record.id, error: errorMsg }, 'SqliteMemoryStore');
      throw new AppError(`Database error inserting memory: ${errorMsg}`, 500, 'DATABASE_ERROR');
    }
  }

  public async getById(id: string): Promise<MemoryRecord | null> {
    try {
      const row = this.stmtGetById.get(id) as MemoryRow | undefined;
      if (!row) return null;
      return this.rowToRecord(row);
    } catch (err) {
      if (err instanceof AppError) throw err;
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Database error reading memory by id: ${errorMsg}`, 500, 'DATABASE_ERROR');
    }
  }

  public async getAll(): Promise<MemoryRecord[]> {
    try {
      const rows = this.stmtGetAll.all() as MemoryRow[];
      return rows.map((row) => this.rowToRecord(row));
    } catch (err) {
      if (err instanceof AppError) throw err;
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Database error reading memories: ${errorMsg}`, 500, 'DATABASE_ERROR');
    }
  }

  public async deleteById(id: string): Promise<boolean> {
    try {
      const result = this.stmtDeleteById.run(id);
      return Number(result.changes) > 0;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Database error deleting memory: ${errorMsg}`, 500, 'DATABASE_ERROR');
    }
  }

  public async deleteByMeetingId(meetingId: string): Promise<boolean> {
    try {
      const result = this.stmtDeleteByMeetingId.run(meetingId);
      logger.info('Deleted memories associated with meeting', { meetingId, count: Number(result.changes) }, 'SqliteMemoryStore');
      return Number(result.changes) > 0;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Database error deleting memories for meeting: ${errorMsg}`, 500, 'DATABASE_ERROR');
    }
  }

  public async clear(): Promise<void> {
    try {
      this.stmtClear.run();
      logger.debug('Cleared all memory records in SQLite', {}, 'SqliteMemoryStore');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Database error clearing memories: ${errorMsg}`, 500, 'DATABASE_ERROR');
    }
  }

  public async search(queryEmbedding: number[], topK: number): Promise<MemorySearchResult[]> {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
      throw new AppError('queryEmbedding must be a non-empty array of numbers', 400, 'INVALID_QUERY_EMBEDDING');
    }

    const safeTopK = Math.max(1, Math.min(50, Math.floor(topK)));

    let rows: MemoryRow[];
    try {
      rows = this.stmtGetAll.all() as MemoryRow[];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Database error querying memories for search: ${errorMsg}`, 500, 'DATABASE_ERROR');
    }

    if (rows.length === 0) {
      return [];
    }

    const scored: Array<{ record: MemoryRecord; similarity: number }> = [];

    for (const row of rows) {
      try {
        const record = this.rowToRecord(row);
        const similarity = cosineSimilarity(queryEmbedding, record.embedding);
        scored.push({ record, similarity });
      } catch (err) {
        logger.warn('Skipping unreadable or corrupt memory row during vector search', {
          id: row.id,
          error: err instanceof Error ? err.message : String(err),
        }, 'SqliteMemoryStore');
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);
    const topResults = scored.slice(0, safeTopK);

    return topResults.map((item) => ({
      memory: toMemoryDTO(item.record),
      similarity: Number(item.similarity.toFixed(4)),
    }));
  }

  public size(): number {
    const result = this.stmtCount.get() as { count: number | bigint };
    return Number(result.count);
  }

  public close(): void {
    if (this.db.isOpen) {
      this.db.close();
      logger.info('Closed SQLite database connection', { dbPath: this.dbPath }, 'SqliteMemoryStore');
    }
  }

  public getPath(): string {
    return this.dbPath;
  }
}
