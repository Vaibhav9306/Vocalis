import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import { User } from '@meeting-assistant/shared-types';
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

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export class SqliteUserStore {
  private db: DatabaseSync;
  private readonly dbPath: string;

  private stmtInsertUser!: StatementSync;
  private stmtGetUserByEmail!: StatementSync;
  private stmtGetUserById!: StatementSync;
  private stmtUpdateLastLogin!: StatementSync;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.resolve(process.cwd(), 'data/memory.db');
    this.db = this.initDatabase();
    this.prepareStatements();
  }

  private initDatabase(): DatabaseSync {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new NodeDatabaseSync(this.dbPath);

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'owner',
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    logger.info('SQLite user auth store initialized', { dbPath: this.dbPath }, 'SqliteUserStore');
    return db;
  }

  private prepareStatements(): void {
    this.stmtInsertUser = this.db.prepare(`
      INSERT INTO users (id, email, name, password_hash, role, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtGetUserByEmail = this.db.prepare(`
      SELECT * FROM users WHERE LOWER(email) = LOWER(?)
    `);

    this.stmtGetUserById = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);

    this.stmtUpdateLastLogin = this.db.prepare(`
      UPDATE users SET last_login_at = ? WHERE id = ?
    `);
  }


  public getUserByEmail(email: string): UserRow | null {
    const row = this.stmtGetUserByEmail.get(email.trim().toLowerCase()) as UserRow | undefined;
    return row || null;
  }

  public getUserById(id: string): User | null {
    const row = this.stmtGetUserById.get(id) as UserRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as 'owner' | 'admin' | 'member',
      createdAt: row.created_at,
    };
  }

  public registerUser(email: string, name: string, password: string): User {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = this.getUserByEmail(normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists');
    }

    const id = `usr-${crypto.randomUUID()}`;
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    this.stmtInsertUser.run(
      id,
      normalizedEmail,
      name.trim() || normalizedEmail.split('@')[0],
      passwordHash,
      'owner',
      createdAt,
      createdAt
    );

    return {
      id,
      email: normalizedEmail,
      name: name.trim() || normalizedEmail.split('@')[0],
      role: 'owner',
      createdAt,
    };
  }

  public authenticate(email: string, password: string): User | null {
    const userRow = this.getUserByEmail(email);
    if (!userRow) {
      return null;
    }

    const isValid = verifyPassword(password, userRow.password_hash);
    if (!isValid) {
      return null;
    }

    const lastLogin = new Date().toISOString();
    this.stmtUpdateLastLogin.run(lastLogin, userRow.id);

    return {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role as 'owner' | 'admin' | 'member',
      createdAt: userRow.created_at,
    };
  }
}

export const sqliteUserStore = new SqliteUserStore();
