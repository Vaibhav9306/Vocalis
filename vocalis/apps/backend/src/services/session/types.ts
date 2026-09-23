import {
  LiveMeetingSession,
  SessionTranscriptChunk,
  MeetingAnalysis,
} from '@meeting-assistant/shared-types';

export interface ProcessChunkResult {
  chunk: SessionTranscriptChunk;
  accumulatedTranscript: string;
  latestAnalysis?: MeetingAnalysis;
  savedMemoriesCount: number;
}

export interface ISessionService {
  createSession(title?: string): LiveMeetingSession;
  processAudioChunk(
    sessionId: string,
    sequenceNumber: number,
    audioBuffer: Buffer,
    filename?: string,
    mimeType?: string
  ): Promise<ProcessChunkResult>;
  addLiveTranscriptSegment(
    sessionId: string,
    text: string,
    durationSeconds?: number
  ): Promise<ProcessChunkResult>;
  runAnalysisAndPersist(sessionId: string, force?: boolean): Promise<MeetingAnalysis | undefined>;
  endSession(sessionId: string): Promise<LiveMeetingSession>;
  getSession(sessionId: string): LiveMeetingSession | null;
  listSessions(): LiveMeetingSession[];
  deleteSession(sessionId: string): boolean;
}
