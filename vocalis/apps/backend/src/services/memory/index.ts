import path from 'path';
import { env } from '../../config/env';
import { azureOpenAIService } from '../azure';
import { IMemoryStore } from './types';
import { InMemoryMemoryStore } from './inMemoryStore';
import { SqliteMemoryStore } from './sqliteMemoryStore';
import { MemoryService } from './memoryService';

export * from './types';
export * from './inMemoryStore';
export * from './sqliteMemoryStore';
export * from './memoryService';

/**
 * Factory function to instantiate the requested memory store engine.
 */
export function createMemoryStore(type: 'sqlite' | 'in-memory' = 'sqlite', dbPath?: string): IMemoryStore {
  if (type === 'sqlite') {
    const resolvedPath = dbPath || (path.isAbsolute(env.SQLITE_DB_PATH)
      ? env.SQLITE_DB_PATH
      : path.resolve(process.cwd(), env.SQLITE_DB_PATH));
    return new SqliteMemoryStore(resolvedPath);
  }
  return new InMemoryMemoryStore();
}

// Determine active store engine (default to SQLite in dev/prod, in-memory for tests unless overridden)
const activeStoreType: 'sqlite' | 'in-memory' =
  process.env.MEMORY_STORE_TYPE === 'sqlite'
    ? 'sqlite'
    : process.env.MEMORY_STORE_TYPE === 'in-memory'
      ? 'in-memory'
      : env.NODE_ENV === 'test'
        ? 'in-memory'
        : env.MEMORY_STORE_TYPE;

// Active singleton store instance configured via MEMORY_STORE_TYPE
export const memoryStore: IMemoryStore = createMemoryStore(
  activeStoreType,
  env.SQLITE_DB_PATH
);

// Singleton memory service instance wired with Azure OpenAI embeddings and the active store
export const memoryService = new MemoryService(azureOpenAIService, memoryStore);
