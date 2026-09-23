/**
 * Shared Type Definitions for ScribeP2P - AI Meeting Assistant & Intelligence Hub
 */

// --- System & Health Types ---
export interface ServiceStatus {
  configured: boolean;
  region?: string;
  endpoint?: string;
  deployment?: string;
  notes?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  services: {
    azureOpenAI: ServiceStatus;
    azureSpeech: ServiceStatus;
  };
}

// --- User, Auth & Workspace Types ---
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role?: 'owner' | 'admin' | 'member';
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  type: 'personal' | 'team' | 'enterprise';
  retentionDays: number;
  membersCount: number;
  createdAt: string;
}

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'invited' | 'inactive';
  joinedAt: string;
  avatarUrl?: string;
}

export interface OnboardingState {
  completed: boolean;
  step: number;
  useCase?: string;
  priority?: string;
  workspaceName?: string;
  workspaceType?: string;
  invitedEmails?: string[];
}

// --- Audio & Transcription Types ---
export interface TranscriptionChunk {
  id: string;
  timestamp: string;
  speakerId?: string;
  speakerName?: string;
  text: string;
  isFinal: boolean;
  confidence?: number;
}

export interface TranscriptionResponse {
  success: boolean;
  transcript: string;
  language?: string;
  durationSeconds?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

// --- AI Analysis Types ---
export interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface DetectedQuestion {
  id: string;
  question: string;
  askedBy?: string;
  suggestedAnswer?: string;
  timestamp: string;
}

export interface DetectedMeetingQuestion {
  question: string;
  context: string;
  suggestedAnswer: string;
  confidence: number;
}

export interface MeetingActionItem {
  task: string;
  owner: string | null;
  deadline: string | null;
}

export interface MeetingAnalysis {
  detectedQuestions: DetectedMeetingQuestion[];
  keyPoints: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  topics: string[];
}

export interface MeetingAnalysisRequest {
  transcript: string;
  context?: string;
  meetingTitle?: string;
  participants?: string[];
}

export interface MeetingAnalysisResponse {
  success: boolean;
  analysis: MeetingAnalysis;
}

export interface MeetingSummary {
  meetingId: string;
  title: string;
  executiveSummary: string;
  keyDiscussionPoints: string[];
  actionItems: ActionItem[];
  questionsDetected: DetectedQuestion[];
  generatedAt: string;
}

export interface EmbeddingRequest {
  text: string;
}

export interface EmbeddingData {
  dimensions: number;
  vector: number[];
}

export interface EmbeddingResponse {
  success: boolean;
  embedding: EmbeddingData;
}

export interface MeetingChapter {
  id: string;
  title: string;
  timestamp: string;
  timeSeconds: number;
  summary?: string;
}

export interface MeetingComment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
  createdAt: string;
  resolved?: boolean;
}

export interface SpeakerStat {
  name: string;
  speakingTimeSeconds: number;
  percentage: number;
  turnsCount: number;
}

// --- Live Meeting Session Types ---
export type LiveSessionStatus = 'idle' | 'active' | 'paused' | 'completed' | 'failed';

export interface SessionTranscriptChunk {
  sequenceNumber: number;
  receivedAt: string;
  timestamp: string;
  text: string;
  durationSeconds?: number;
  speakerName?: string;
  status: 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface LiveMeetingSession {
  id: string;
  title: string;
  status: LiveSessionStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  chunks: SessionTranscriptChunk[];
  accumulatedTranscript: string;
  latestAnalysis?: MeetingAnalysis;
  lastAnalyzedChunkIndex: number;
  savedMemoriesCount: number;
  participants?: string[];
  tags?: string[];
  isFavorite?: boolean;
  chapters?: MeetingChapter[];
  comments?: MeetingComment[];
}

export interface StartSessionRequest {
  title?: string;
  participants?: string[];
  tags?: string[];
}

export interface StartSessionResponse {
  success: boolean;
  session: LiveMeetingSession;
}

export interface ChunkUploadResponse {
  success: boolean;
  chunk: SessionTranscriptChunk;
  accumulatedTranscript: string;
  latestAnalysis?: MeetingAnalysis;
  savedMemoriesCount: number;
}

export interface StopSessionResponse {
  success: boolean;
  session: LiveMeetingSession;
}

export interface GetSessionResponse {
  success: boolean;
  session: LiveMeetingSession;
}

// --- Tasks / Action Items Model ---
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskItem {
  id: string;
  title: string;
  task: string;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  meetingId: string;
  meetingTitle: string;
  timestamp?: string;
  createdAt: string;
}

// --- Decisions Model ---
export type DecisionStatus = 'active' | 'superseded';

export interface DecisionItem {
  id: string;
  decision: string;
  status: DecisionStatus;
  meetingId: string;
  meetingTitle: string;
  timestamp?: string;
  participants?: string[];
  rationale?: string;
  createdAt: string;
}

// --- Semantic Memory Types ---
export type MemoryCategory = 'projects' | 'people' | 'decisions' | 'actions' | 'topics' | 'facts';

export interface MemoryRecord {
  id: string;
  text: string;
  embedding: number[];
  createdAt: string;
  meetingId?: string;
  meetingTitle?: string;
  source?: string;
  category?: MemoryCategory;
  metadata?: Record<string, unknown>;
}

export type MemoryRecordDTO = Omit<MemoryRecord, 'embedding'>;

export interface MemorySearchResult {
  memory: MemoryRecordDTO;
  similarity: number;
}

export interface AddMemoryRequest {
  text: string;
  meetingId?: string;
  meetingTitle?: string;
  source?: string;
  category?: MemoryCategory;
  metadata?: Record<string, unknown>;
}

export interface AddMemoryResponse {
  success: boolean;
  memory: MemoryRecordDTO;
}

export interface SearchMemoryRequest {
  query: string;
  topK?: number;
  category?: MemoryCategory;
}

export interface SearchMemoryResponse {
  success: boolean;
  results: MemorySearchResult[];
}

// --- Ask Scribe & Grounded AI Q&A Types ---
export interface Citation {
  meetingId: string;
  meetingTitle: string;
  timestamp?: string;
  speakerName?: string;
  snippet: string;
  relevanceScore?: number;
}

export interface AskScribeRequest {
  query: string;
  meetingId?: string; // If scoping to a specific meeting
}

export interface AskScribeResponse {
  success: boolean;
  answer: string;
  citations: Citation[];
}

// --- Rooms & P2P Mesh Types ---
export interface MeetingRoom {
  id: string;
  name: string;
  code: string;
  activePeersCount: number;
  isEncrypted: boolean;
  createdBy: string;
  createdAt: string;
  status: 'active' | 'idle' | 'ended';
}

// --- Notifications Types ---
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'action_assigned' | 'meeting_shared' | 'deadline' | 'mention' | 'summary_ready';
  read: boolean;
  createdAt: string;
  link?: string;
}

// --- Billing & Usage Types ---
export interface BillingPlan {
  id: 'free' | 'pro' | 'team';
  name: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  maxMinutesMonthly: number;
  maxAiQueries: number;
}

export interface UsageRecord {
  minutesUsed: number;
  minutesLimit: number;
  aiQueriesUsed: number;
  aiQueriesLimit: number;
  storageMbUsed: number;
  storageMbLimit: number;
  activeRoomsCount: number;
}

// --- WebSocket Messages ---
export type LiveClientAction = 'start' | 'stop' | 'ping';

export interface LiveClientMessage {
  action: LiveClientAction;
  sessionId?: string;
  title?: string;
}

export type LiveServerMessageType =
  | 'session_started'
  | 'interim_transcript'
  | 'final_transcript'
  | 'analysis_update'
  | 'session_completed'
  | 'error'
  | 'pong';

export interface LiveServerMessage {
  type: LiveServerMessageType;
  sessionId?: string;
  interimText?: string;
  chunk?: SessionTranscriptChunk;
  accumulatedTranscript?: string;
  latestAnalysis?: MeetingAnalysis;
  savedMemoriesCount?: number;
  session?: LiveMeetingSession;
  error?: {
    code: string;
    message: string;
  };
}

// --- API Standard Response Types ---
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
