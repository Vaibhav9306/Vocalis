import path from 'path';
import fs from 'fs';
import {
  LiveMeetingSession,
  TaskItem,
  DecisionItem,
} from '@meeting-assistant/shared-types';
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

// Dynamically load native Node 24 SQLite module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NodeDatabaseSync: new (location: string, options?: any) => DatabaseSync = (
  eval('require')('node:sqlite')
).DatabaseSync;

interface SessionRow {
  id: string;
  title: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  accumulated_transcript: string;
  last_analyzed_chunk_index: number;
  saved_memories_count: number;
  is_favorite: number;
  tags: string | null;
  participants: string | null;
  chunks_json: string;
  analysis_json: string | null;
  chapters_json: string | null;
  comments_json: string | null;
}

export class SqliteSessionStore {
  private db: DatabaseSync;
  private readonly dbPath: string;

  private stmtUpsertSession!: StatementSync;
  private stmtGetSession!: StatementSync;
  private stmtGetAllSessions!: StatementSync;
  private stmtDeleteSession!: StatementSync;

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
      db.exec('PRAGMA busy_timeout = 5000;');
      db.exec('PRAGMA synchronous = NORMAL;');

      // Create sessions table
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          duration_seconds INTEGER,
          accumulated_transcript TEXT NOT NULL DEFAULT '',
          last_analyzed_chunk_index INTEGER NOT NULL DEFAULT -1,
          saved_memories_count INTEGER NOT NULL DEFAULT 0,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          tags TEXT,
          participants TEXT,
          chunks_json TEXT NOT NULL DEFAULT '[]',
          analysis_json TEXT,
          chapters_json TEXT,
          comments_json TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_is_favorite ON sessions(is_favorite);
      `);

      logger.info('SQLite session store initialized', { dbPath: this.dbPath }, 'SqliteSessionStore');
      return db;
    } catch (err) {
      logger.error('Failed to initialize SQLite session store', { error: String(err) }, 'SqliteSessionStore');
      throw err;
    }
  }

  private prepareStatements(): void {
    this.stmtUpsertSession = this.db.prepare(`
      INSERT INTO sessions (
        id, title, status, started_at, ended_at, duration_seconds,
        accumulated_transcript, last_analyzed_chunk_index, saved_memories_count,
        is_favorite, tags, participants, chunks_json, analysis_json, chapters_json, comments_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        status = excluded.status,
        ended_at = excluded.ended_at,
        duration_seconds = excluded.duration_seconds,
        accumulated_transcript = excluded.accumulated_transcript,
        last_analyzed_chunk_index = excluded.last_analyzed_chunk_index,
        saved_memories_count = excluded.saved_memories_count,
        is_favorite = excluded.is_favorite,
        tags = excluded.tags,
        participants = excluded.participants,
        chunks_json = excluded.chunks_json,
        analysis_json = excluded.analysis_json,
        chapters_json = excluded.chapters_json,
        comments_json = excluded.comments_json
    `);

    this.stmtGetSession = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`);
    this.stmtGetAllSessions = this.db.prepare(`SELECT * FROM sessions ORDER BY started_at DESC`);
    this.stmtDeleteSession = this.db.prepare(`DELETE FROM sessions WHERE id = ?`);
  }

  public saveSession(session: LiveMeetingSession): void {
    try {
      this.stmtUpsertSession.run(
        session.id,
        session.title,
        session.status,
        session.startedAt,
        session.endedAt || null,
        session.durationSeconds || null,
        session.accumulatedTranscript || '',
        session.lastAnalyzedChunkIndex,
        session.savedMemoriesCount,
        session.isFavorite ? 1 : 0,
        session.tags ? JSON.stringify(session.tags) : null,
        session.participants ? JSON.stringify(session.participants) : null,
        JSON.stringify(session.chunks || []),
        session.latestAnalysis ? JSON.stringify(session.latestAnalysis) : null,
        session.chapters ? JSON.stringify(session.chapters) : null,
        session.comments ? JSON.stringify(session.comments) : null
      );
    } catch (err) {
      logger.error('Failed to save session to SQLite', { sessionId: session.id, error: String(err) }, 'SqliteSessionStore');
    }
  }

  public getSession(id: string): LiveMeetingSession | undefined {
    try {
      const row = this.stmtGetSession.get(id) as SessionRow | undefined;
      if (!row) return undefined;
      return this.rowToSession(row);
    } catch (err) {
      logger.error('Failed to retrieve session from SQLite', { id, error: String(err) }, 'SqliteSessionStore');
      return undefined;
    }
  }

  public getAllSessions(): LiveMeetingSession[] {
    try {
      const rows = this.stmtGetAllSessions.all() as SessionRow[];
      return rows.map((r) => this.rowToSession(r));
    } catch (err) {
      logger.error('Failed to retrieve all sessions from SQLite', { error: String(err) }, 'SqliteSessionStore');
      return [];
    }
  }

  public deleteSession(id: string): boolean {
    try {
      const res = this.stmtDeleteSession.run(id);
      return Number(res.changes) > 0;
    } catch (err) {
      logger.error('Failed to delete session from SQLite', { id, error: String(err) }, 'SqliteSessionStore');
      return false;
    }
  }

  public getAllTasks(): TaskItem[] {
    const sessions = this.getAllSessions();
    const tasks: TaskItem[] = [];

    for (const session of sessions) {
      if (session.latestAnalysis?.actionItems) {
        session.latestAnalysis.actionItems.forEach((act, idx) => {
          tasks.push({
            id: `task-${session.id}-${idx}`,
            title: act.task,
            task: act.task,
            assignee: act.owner || 'Unassigned',
            dueDate: act.deadline || 'This week',
            priority: idx === 0 ? 'high' : 'medium',
            status: idx % 3 === 2 ? 'done' : idx % 3 === 1 ? 'in_progress' : 'todo',
            meetingId: session.id,
            meetingTitle: session.title,
            createdAt: session.startedAt,
          });
        });
      }
    }
    return tasks;
  }

  public getAllDecisions(): DecisionItem[] {
    const sessions = this.getAllSessions();
    const decisions: DecisionItem[] = [];

    for (const session of sessions) {
      if (session.latestAnalysis?.decisions) {
        session.latestAnalysis.decisions.forEach((dec, idx) => {
          decisions.push({
            id: `dec-${session.id}-${idx}`,
            decision: dec,
            status: 'active',
            meetingId: session.id,
            meetingTitle: session.title,
            participants: session.participants || ['Rahul', 'Eklavya'],
            createdAt: session.startedAt,
          });
        });
      }
    }
    return decisions;
  }

  private rowToSession(row: SessionRow): LiveMeetingSession {
    let chunks = [];
    try { chunks = JSON.parse(row.chunks_json); } catch { /* ignore */ }
    let latestAnalysis;
    try { if (row.analysis_json) latestAnalysis = JSON.parse(row.analysis_json); } catch { /* ignore */ }
    let tags = [];
    try { if (row.tags) tags = JSON.parse(row.tags); } catch { /* ignore */ }
    let participants = [];
    try { if (row.participants) participants = JSON.parse(row.participants); } catch { /* ignore */ }
    let chapters;
    try { if (row.chapters_json) chapters = JSON.parse(row.chapters_json); } catch { /* ignore */ }
    let comments;
    try { if (row.comments_json) comments = JSON.parse(row.comments_json); } catch { /* ignore */ }

    return {
      id: row.id,
      title: row.title,
      status: row.status as LiveMeetingSession['status'],
      startedAt: row.started_at,
      endedAt: row.ended_at || undefined,
      durationSeconds: row.duration_seconds || undefined,
      accumulatedTranscript: row.accumulated_transcript,
      lastAnalyzedChunkIndex: row.last_analyzed_chunk_index,
      savedMemoriesCount: row.saved_memories_count,
      isFavorite: row.is_favorite === 1,
      tags,
      participants,
      chunks,
      latestAnalysis,
      chapters,
      comments,
    };
  }
}

export const sqliteSessionStore = new SqliteSessionStore();
