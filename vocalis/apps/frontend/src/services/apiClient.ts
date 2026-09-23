import {
  HealthResponse,
  LiveMeetingSession,
  ChunkUploadResponse,
  MeetingAnalysis,
  TaskItem,
  DecisionItem,
  MemorySearchResult,
  MemoryRecordDTO,
  AskScribeResponse,
  UsageRecord,
  MeetingComment,
  User,
} from '@meeting-assistant/shared-types';
import { API_BASE_URL } from '../config/api';

export interface HealthCheckResult {
  data?: HealthResponse;
  error?: string;
  latencyMs?: number;
}

export const fetchHealth = async (): Promise<HealthCheckResult> => {
  const start = performance.now();
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      headers: { Accept: 'application/json' },
    });
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return {
        error: `Server responded with status ${res.status}`,
        latencyMs,
      };
    }

    const data: HealthResponse = await res.json();
    return { data, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      error: err instanceof Error ? err.message : 'Network error reaching backend',
      latencyMs,
    };
  }
};

// --- Live Meeting Sessions ---

export const fetchSessions = async (): Promise<{ data?: LiveMeetingSession[]; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || `Failed to fetch sessions (${res.status})` };
    }
    return { data: json.sessions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error fetching sessions' };
  }
};

export const startSession = async (
  title?: string,
  participants?: string[],
  tags?: string[]
): Promise<{ data?: LiveMeetingSession; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ title, participants, tags }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || `Failed to start session (${res.status})` };
    }
    return { data: json.session };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error starting session' };
  }
};

export const uploadAudioChunk = async (
  sessionId: string,
  sequenceNumber: number,
  audioBlob: Blob
): Promise<{ data?: ChunkUploadResponse; error?: string }> => {
  try {
    const formData = new FormData();
    const filename = `chunk-${sequenceNumber}.webm`;
    formData.append('audio', audioBlob, filename);
    formData.append('sequenceNumber', sequenceNumber.toString());

    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/chunks`, {
      method: 'POST',
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || `Chunk upload failed (${res.status})` };
    }
    return { data: json };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error uploading audio chunk' };
  }
};

export const getSession = async (
  sessionId: string
): Promise<{ data?: LiveMeetingSession; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || `Failed to fetch session (${res.status})` };
    }
    return { data: json.session };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error fetching session' };
  }
};

export const updateSession = async (
  sessionId: string,
  updates: Partial<LiveMeetingSession>
): Promise<{ data?: LiveMeetingSession; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || `Failed to update session (${res.status})` };
    }
    return { data: json.session };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error updating session' };
  }
};

export const deleteSession = async (
  sessionId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    return { success: res.ok && json.success, error: json.error?.message };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error deleting session' };
  }
};

export const stopSession = async (
  sessionId: string
): Promise<{ data?: LiveMeetingSession; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/stop`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || `Failed to stop session (${res.status})` };
    }
    return { data: json.session };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error stopping session' };
  }
};

export const triggerSessionAnalysis = async (
  sessionId: string
): Promise<{ data?: MeetingAnalysis; session?: LiveMeetingSession; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/analyze`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || `Failed to trigger analysis (${res.status})` };
    }
    return { data: json.analysis, session: json.session };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error triggering analysis' };
  }
};

export const askMeeting = async (
  sessionId: string,
  query: string
): Promise<AskScribeResponse> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      success: false,
      answer: err instanceof Error ? err.message : 'Network error querying meeting AI',
      citations: [],
    };
  }
};

export const addMeetingComment = async (
  sessionId: string,
  comment: { userId?: string; userName?: string; text: string; timestamp?: string }
): Promise<{ data?: MeetingComment; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(sessionId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(comment),
    });
    const json = await res.json();
    return { data: json.comment, error: json.error?.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error adding comment' };
  }
};

// --- Global / Live Ask Scribe ---

export const askScribe = async (
  query: string,
  meetingId?: string,
  transcript?: string
): Promise<AskScribeResponse> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, meetingId, transcript }),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      success: false,
      answer: err instanceof Error ? err.message : 'Network error querying Ask Scribe',
      citations: [],
    };
  }
};

// --- Tasks & Action Items ---

export const fetchTasks = async (): Promise<{ data?: TaskItem[]; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    return { data: json.tasks };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error fetching tasks' };
  }
};

export const createTask = async (
  taskData: { task: string; assignee?: string; status?: 'todo' | 'in_progress' | 'done'; dueDate?: string; meetingId?: string }
): Promise<{ data?: TaskItem; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(taskData),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error || 'Failed to create task' };
    }
    return { data: json.task };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error creating task' };
  }
};

export const updateTask = async (
  taskId: string,
  updates: { task?: string; assignee?: string; status?: 'todo' | 'in_progress' | 'done'; dueDate?: string }
): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
};

export const deleteTask = async (taskId: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
};

export const updateTaskStatus = async (
  taskId: string,
  status: 'todo' | 'in_progress' | 'done'
): Promise<boolean> => {
  return updateTask(taskId, { status });
};

// --- Decisions ---

export const fetchDecisions = async (): Promise<{ data?: DecisionItem[]; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/decisions`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    return { data: json.decisions };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error fetching decisions' };
  }
};

export const createDecision = async (
  decData: { decision: string; status?: 'active' | 'superseded'; meetingId?: string }
): Promise<{ data?: DecisionItem; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(decData),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error || 'Failed to create decision' };
    }
    return { data: json.decision };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error creating decision' };
  }
};

export const updateDecision = async (
  decisionId: string,
  updates: { decision?: string; status?: 'active' | 'superseded' }
): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/decisions/${encodeURIComponent(decisionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(updates),
    });
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
};

export const deleteDecision = async (decisionId: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/decisions/${encodeURIComponent(decisionId)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    return json.success === true;
  } catch {
    return false;
  }
};

export const updateDecisionStatus = async (
  decisionId: string,
  status: 'active' | 'superseded'
): Promise<boolean> => {
  return updateDecision(decisionId, { status });
};



// --- Authentication ---

export const loginUser = async (
  email: string,
  password: string
): Promise<{ user?: User; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || 'Invalid email or password' };
    }
    return { user: json.data?.user };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error reaching authentication server' };
  }
};

export const registerUser = async (
  email: string,
  name: string,
  password: string
): Promise<{ user?: User; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, name, password }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || 'Failed to create account' };
    }
    return { user: json.data?.user };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error reaching authentication server' };
  }
};

export const fetchUserProfile = async (
  email: string
): Promise<{ user?: User; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/me?email=${encodeURIComponent(email)}`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || 'User not found' };
    }
    return { user: json.data?.user };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error fetching user profile' };
  }
};

// --- SaaS Usage Metrics ---

export const fetchUsage = async (): Promise<{ data?: UsageRecord; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/usage`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    return { data: json.usage };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error fetching usage' };
  }
};

// --- Semantic Memory Vault ---

export const fetchMemories = async (): Promise<{ data?: MemoryRecordDTO[]; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/memory`, {
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || 'Failed to fetch memories' };
    }
    return { data: json.memories };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error fetching memories' };
  }
};

export const searchMemories = async (
  query: string,
  topK = 10
): Promise<{ data?: MemorySearchResult[]; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/memory/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, topK }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { error: json.error?.message || 'Failed to search memories' };
    }
    return { data: json.results };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error searching memories' };
  }
};

export const deleteMemory = async (
  id: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/memory/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    });
    const json = await res.json();
    return { success: res.ok && json.success, error: json.error?.message };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error deleting memory' };
  }
};



