import {
  MemoryRecord,
  MemoryRecordDTO,
  MemorySearchResult,
} from '@meeting-assistant/shared-types';

export { MemoryRecord, MemoryRecordDTO, MemorySearchResult };

/**
 * Converts a full MemoryRecord into a client-safe DTO by omitting the raw embedding vector.
 */
export function toMemoryDTO(record: MemoryRecord): MemoryRecordDTO {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { embedding, ...dto } = record;
  return dto;
}

/**
 * Input for adding a new text memory record.
 */
export interface AddMemoryInput {
  text: string;
  meetingId?: string;
  meetingTitle?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Generic storage interface for semantic memory records.
 * Keeps memory storage abstracted from the concrete storage engine (e.g. In-Memory, Vector DB).
 */
export interface IMemoryStore {
  add(record: MemoryRecord): Promise<MemoryRecord>;
  getById(id: string): Promise<MemoryRecord | null>;
  getAll(): Promise<MemoryRecord[]>;
  deleteById(id: string): Promise<boolean>;
  deleteByMeetingId(meetingId: string): Promise<boolean>;
  clear(): Promise<void>;
  search(queryEmbedding: number[], topK: number): Promise<MemorySearchResult[]>;
}

/**
 * High-level service combining embedding generation with memory storage and search.
 */
export interface IMemoryService {
  addTextMemory(input: AddMemoryInput): Promise<MemoryRecordDTO>;
  searchMemory(query: string, topK?: number): Promise<MemorySearchResult[]>;
  getMemoryById(id: string): Promise<MemoryRecordDTO | null>;
  getAllMemories(): Promise<MemoryRecordDTO[]>;
  deleteMemoryById(id: string): Promise<boolean>;
  deleteByMeetingId(meetingId: string): Promise<boolean>;
  clearMemories(): Promise<void>;
}
