import { useState, useRef, useCallback, useEffect } from 'react';
import {
  LiveMeetingSession,
  SessionTranscriptChunk,
  MeetingAnalysis,
  LiveClientMessage,
  LiveServerMessage,
} from '@meeting-assistant/shared-types';
import { API_BASE_URL } from '../config/api';

export type StreamingStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'transcribing'
  | 'completed'
  | 'error';

export interface UseLiveMeetingStreamReturn {
  isStreaming: boolean;
  streamingStatus: StreamingStatus;
  interimTranscript: string;
  chunks: SessionTranscriptChunk[];
  accumulatedTranscript: string;
  analysis: MeetingAnalysis | null;
  savedMemoriesCount: number;
  session: LiveMeetingSession | null;
  micEnabled: boolean;
  systemAudioEnabled: boolean;
  systemAudioSupported: boolean;
  sharedTabTitle: string | null;
  durationSeconds: number;
  error: string | null;
  language: string;
  setLanguage: (lang: string) => void;
  startMeeting: (title?: string, lang?: string) => Promise<boolean>;
  stopMeeting: () => Promise<void>;
  toggleMic: () => void;
  toggleSystemAudio: () => Promise<void>;
  clearError: () => void;
}

export const LIVE_SYNC_STORAGE_KEY = 'vocalis_live_meeting_snapshot';
export const SYNC_CHANNEL_NAME = 'vocalis_live_stream_sync';

export interface StreamSyncSnapshot {
  isStreaming: boolean;
  streamingStatus: StreamingStatus;
  interimTranscript: string;
  chunks: SessionTranscriptChunk[];
  accumulatedTranscript: string;
  analysis: MeetingAnalysis | null;
  savedMemoriesCount: number;
  session: LiveMeetingSession | null;
  micEnabled: boolean;
  systemAudioEnabled: boolean;
  systemAudioSupported: boolean;
  sharedTabTitle: string | null;
  durationSeconds: number;
  language: string;
  updatedAt: number;
}

// Convert Float32Array to 16kHz 16-bit Mono Linear PCM
function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === 16000) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  const ratio = inputSampleRate / 16000;
  const newLength = Math.floor(input.length / ratio);
  const output = new Int16Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const offset = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, input[offset]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export function useLiveMeetingStream(): UseLiveMeetingStreamReturn {
  // Try to hydrate initial state synchronously if a live meeting is already in progress in another tab/window
  const initialSnapshot = (() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem(LIVE_SYNC_STORAGE_KEY);
        if (raw) {
          const parsed: StreamSyncSnapshot = JSON.parse(raw);
          // Only hydrate if the meeting snapshot was updated recently (within last 3 minutes)
          if (parsed.isStreaming && Date.now() - (parsed.updatedAt || 0) < 180000) {
            return parsed;
          }
        }
      }
    } catch {}
    return null;
  })();

  const [isStreaming, setIsStreaming] = useState<boolean>(initialSnapshot?.isStreaming || false);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>(initialSnapshot?.streamingStatus || 'idle');
  const [interimTranscript, setInterimTranscript] = useState<string>(initialSnapshot?.interimTranscript || '');
  const [chunks, setChunks] = useState<SessionTranscriptChunk[]>(initialSnapshot?.chunks || []);
  const [accumulatedTranscript, setAccumulatedTranscript] = useState<string>(initialSnapshot?.accumulatedTranscript || '');
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(initialSnapshot?.analysis || null);
  const [savedMemoriesCount, setSavedMemoriesCount] = useState<number>(initialSnapshot?.savedMemoriesCount || 0);
  const [session, setSession] = useState<LiveMeetingSession | null>(initialSnapshot?.session || null);
  const [micEnabled, setMicEnabled] = useState<boolean>(initialSnapshot ? initialSnapshot.micEnabled : true);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState<boolean>(initialSnapshot?.systemAudioEnabled || false);
  const [systemAudioSupported, setSystemAudioSupported] = useState<boolean>(false);
  const [sharedTabTitle, setSharedTabTitle] = useState<string | null>(initialSnapshot?.sharedTabTitle || null);
  const [durationSeconds, setDurationSeconds] = useState<number>(initialSnapshot?.durationSeconds || 0);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>(initialSnapshot?.language || 'en-US');

  const languageRef = useRef<string>(initialSnapshot?.language || 'en-US');
  languageRef.current = language;

  const socketRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const durationTimerRef = useRef<number | null>(null);
  const isStreamingRef = useRef<boolean>(initialSnapshot?.isStreaming || false);
  const lastCommittedIndexRef = useRef<number>(-1);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Check if this instance is the physical audio stream owner (holds the real MediaStream / WebSocket)
  const isStreamOwner = useCallback(() => {
    return Boolean(socketRef.current && socketRef.current.readyState === WebSocket.OPEN);
  }, []);

  // Broadcast state changes across windows & tabs
  const broadcastState = useCallback((overrides?: Partial<StreamSyncSnapshot>) => {
    const snapshot: StreamSyncSnapshot = {
      isStreaming: isStreamingRef.current,
      streamingStatus,
      interimTranscript,
      chunks,
      accumulatedTranscript,
      analysis,
      savedMemoriesCount,
      session,
      micEnabled,
      systemAudioEnabled,
      systemAudioSupported,
      sharedTabTitle,
      durationSeconds,
      language: languageRef.current,
      updatedAt: Date.now(),
      ...overrides,
    };

    try {
      if (snapshot.isStreaming) {
        localStorage.setItem(LIVE_SYNC_STORAGE_KEY, JSON.stringify(snapshot));
      } else {
        localStorage.removeItem(LIVE_SYNC_STORAGE_KEY);
      }
    } catch {}

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'STREAM_SNAPSHOT',
          payload: snapshot,
        });
      } catch {}
    }
  }, [
    streamingStatus,
    interimTranscript,
    chunks,
    accumulatedTranscript,
    analysis,
    savedMemoriesCount,
    session,
    micEnabled,
    systemAudioEnabled,
    systemAudioSupported,
    sharedTabTitle,
    durationSeconds,
  ]);

  // Apply a snapshot received from another window
  const applySnapshot = useCallback((data: StreamSyncSnapshot) => {
    setIsStreaming(data.isStreaming);
    isStreamingRef.current = data.isStreaming;
    setStreamingStatus(data.streamingStatus);
    setInterimTranscript(data.interimTranscript || '');
    setChunks(data.chunks || []);
    setAccumulatedTranscript(data.accumulatedTranscript || '');
    setAnalysis(data.analysis || null);
    setSavedMemoriesCount(data.savedMemoriesCount || 0);
    setSession(data.session || null);
    setMicEnabled(data.micEnabled);
    setSystemAudioEnabled(data.systemAudioEnabled);
    setSharedTabTitle(data.sharedTabTitle);
    setDurationSeconds(data.durationSeconds || 0);
    if (data.language) setLanguage(data.language);
  }, []);

  // Check system audio support on mount & set up cross-window sync
  useEffect(() => {
    const hasDisplayMedia = Boolean(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    );
    setSystemAudioSupported(hasDisplayMedia);

    // Initialize BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload, action } = event.data || {};

        if (type === 'REQUEST_SNAPSHOT') {
          // If this window is the active streamer, reply immediately with current state
          if (isStreamingRef.current && isStreamOwner()) {
            broadcastState();
          }
        } else if (type === 'STREAM_SNAPSHOT') {
          // If this window is NOT the physical stream owner, adopt the broadcasted state
          if (!isStreamOwner()) {
            applySnapshot(payload as StreamSyncSnapshot);
          }
        } else if (type === 'STREAM_COMMAND') {
          // Command from a follower to the stream owner
          if (isStreamOwner()) {
            if (action === 'toggle_mic') {
              if (micStreamRef.current) {
                const tracks = micStreamRef.current.getAudioTracks();
                const nextState = !micEnabled;
                tracks.forEach((t) => (t.enabled = nextState));
                setMicEnabled(nextState);
                broadcastState({ micEnabled: nextState });
              }
            } else if (action === 'stop_meeting') {
              stopMeeting();
            }
          }
        }
      };

      // Request snapshot on mount from any active streamer
      channel.postMessage({ type: 'REQUEST_SNAPSHOT' });
    }

    // Storage event listener for multi-tab / multi-window resilience
    const handleStorage = (e: StorageEvent) => {
      if (e.key === LIVE_SYNC_STORAGE_KEY && !isStreamOwner()) {
        try {
          if (e.newValue) {
            const data: StreamSyncSnapshot = JSON.parse(e.newValue);
            applySnapshot(data);
          } else {
            setIsStreaming(false);
            isStreamingRef.current = false;
            setStreamingStatus('completed');
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // Focus / Visibility check to ensure state is fresh when user switches to tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !isStreamOwner()) {
        try {
          const raw = localStorage.getItem(LIVE_SYNC_STORAGE_KEY);
          if (raw) {
            const data: StreamSyncSnapshot = JSON.parse(raw);
            if (Date.now() - (data.updatedAt || 0) < 180000) {
              applySnapshot(data);
            }
          }
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isStreamOwner, broadcastState, applySnapshot, micEnabled]);

  // Sync state broadcast whenever streaming properties change on owner
  useEffect(() => {
    if (isStreamOwner() && isStreaming) {
      broadcastState();
    }
  }, [chunks, interimTranscript, analysis, durationSeconds, session, isStreaming, isStreamOwner, broadcastState]);

  const clearError = useCallback(() => setError(null), []);

  const getWsUrl = (): string => {
    const base = API_BASE_URL.replace(/^http/, 'ws');
    return `${base.replace(/\/+$/, '')}/api/sessions/live-stream`;
  };

  // Rebuild audio routing (mic + optional system audio -> AudioWorklet / ScriptProcessor -> WebSocket)
  const setupAudioCapture = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Browser does not support MediaDevices audio capture.');
      return false;
    }

    try {
      // 1. Microphone capture
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;
      setMicEnabled(true);

      // 2. Audio Context (request 16kHz if browser allows, otherwise downsample in software)
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      // Ensure context is running (browser autoplay policy)
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const sampleRate = audioCtx.sampleRate;
      const micSource = audioCtx.createMediaStreamSource(micStream);
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0;

      let useWorklet = false;
      try {
        if (audioCtx.audioWorklet) {
          const workletCode = `
            class ScribeAudioProcessor extends AudioWorkletProcessor {
              process(inputs) {
                const input = inputs[0];
                if (input && input.length > 0) {
                  const channelData = input[0];
                  if (channelData && channelData.length > 0) {
                    this.port.postMessage(channelData);
                  }
                }
                return true;
              }
            }
            registerProcessor('scribe-audio-processor', ScribeAudioProcessor);
          `;
          const blob = new Blob([workletCode], { type: 'application/javascript' });
          const workletUrl = URL.createObjectURL(blob);
          await audioCtx.audioWorklet.addModule(workletUrl);
          URL.revokeObjectURL(workletUrl);

          const workletNode = new AudioWorkletNode(audioCtx, 'scribe-audio-processor');
          workletNodeRef.current = workletNode;

          workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
            if (!isStreamingRef.current) return;
            const ws = socketRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
            const pcm16 = downsampleTo16k(e.data, sampleRate);
            ws.send(pcm16.buffer);
          };

          micSource.connect(workletNode);
          if (systemStreamRef.current && systemStreamRef.current.getAudioTracks().length > 0) {
            const sysSource = audioCtx.createMediaStreamSource(systemStreamRef.current);
            sysSource.connect(workletNode);
          }
          workletNode.connect(muteGain);
          muteGain.connect(audioCtx.destination);
          useWorklet = true;
        }
      } catch {
        // Fallback to ScriptProcessorNode
      }

      if (!useWorklet) {
        // 3. ScriptProcessorNode fallback
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (!isStreamingRef.current) return;
          const ws = socketRef.current;
          if (!ws || ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = downsampleTo16k(inputData, sampleRate);
          ws.send(pcm16.buffer);
        };

        micSource.connect(processor);
        if (systemStreamRef.current && systemStreamRef.current.getAudioTracks().length > 0) {
          const sysSource = audioCtx.createMediaStreamSource(systemStreamRef.current);
          sysSource.connect(processor);
        }
        processor.connect(muteGain);
        muteGain.connect(audioCtx.destination);
      }

      return true;
    } catch (err) {
      let msg = 'Failed to access microphone.';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
        } else if (err.name === 'NotFoundError') {
          msg = 'No microphone device found on this system.';
        } else {
          msg = `Microphone error: ${err.message}`;
        }
      }
      setError(msg);
      return false;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    isStreamingRef.current = false;
    setIsStreaming(false);

    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach((t) => t.stop());
      systemStreamRef.current = null;
    }
    setSharedTabTitle(null);

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    try {
      localStorage.removeItem(LIVE_SYNC_STORAGE_KEY);
    } catch {}
  }, []);

  // Start Meeting & Streaming
  const startMeeting = useCallback(
    async (title?: string, lang?: string): Promise<boolean> => {
      setError(null);
      setStreamingStatus('connecting');

      const activeLang = lang || languageRef.current || 'en-US';

      // 1. Initialize audio capture
      const audioOk = await setupAudioCapture();
      if (!audioOk) {
        setStreamingStatus('error');
        return false;
      }

      // 2. Open WebSocket connection
      return new Promise<boolean>((resolve) => {
        const wsUrl = getWsUrl();
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          const startMsg = {
            action: 'start',
            title: title || 'Live Meeting',
            language: activeLang,
          };
          ws.send(JSON.stringify(startMsg));
          setIsStreaming(true);
          isStreamingRef.current = true;
          setStreamingStatus('listening');
          setDurationSeconds(0);
          setChunks([]);
          setAccumulatedTranscript('');
          setInterimTranscript('');
          setAnalysis(null);
          setSavedMemoriesCount(0);
          lastCommittedIndexRef.current = -1;

          // Broadcast initial live meeting state immediately across windows
          const initialSnapshot: StreamSyncSnapshot = {
            isStreaming: true,
            streamingStatus: 'listening',
            interimTranscript: '',
            chunks: [],
            accumulatedTranscript: '',
            analysis: null,
            savedMemoriesCount: 0,
            session: null,
            micEnabled: true,
            systemAudioEnabled: false,
            systemAudioSupported: systemAudioSupported,
            sharedTabTitle: null,
            durationSeconds: 0,
            language: activeLang,
            updatedAt: Date.now(),
          };

          try {
            localStorage.setItem(LIVE_SYNC_STORAGE_KEY, JSON.stringify(initialSnapshot));
          } catch {}

          if (broadcastChannelRef.current) {
            try {
              broadcastChannelRef.current.postMessage({
                type: 'STREAM_SNAPSHOT',
                payload: initialSnapshot,
              });
            } catch {}
          }

          // 3. Initialize Browser Speech Recognition as simultaneous high-speed engine
          const SpeechRec =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;
          if (SpeechRec) {
            try {
              const recognition = new SpeechRec();
              recognition.continuous = true;
              recognition.interimResults = true;
              recognition.lang = activeLang;

              recognition.onresult = (event: any) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                  const textSegment = event.results[i][0]?.transcript || '';
                  if (event.results[i].isFinal) {
                    if (i > lastCommittedIndexRef.current && textSegment.trim()) {
                      lastCommittedIndexRef.current = i;
                      if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(
                          JSON.stringify({
                            action: 'client_transcript_segment',
                            text: textSegment.trim(),
                            durationSeconds: 4,
                          })
                        );
                      }
                    }
                  } else {
                    interim += textSegment;
                  }
                }
                if (interim) {
                  setInterimTranscript(interim);
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(
                      JSON.stringify({
                        action: 'client_interim_transcript',
                        interimText: interim,
                      })
                    );
                  }
                }
              };

              recognition.onerror = (e: any) => {
                console.warn('Browser SpeechRecognition event:', e.error);
              };

              recognition.onend = () => {
                if (isStreamingRef.current) {
                  try {
                    lastCommittedIndexRef.current = -1;
                    recognition.start();
                  } catch {}
                }
              };

              recognition.start();
              speechRecognitionRef.current = recognition;
            } catch (recErr) {
              console.warn('SpeechRecognition initialization notice:', recErr);
            }
          }

          durationTimerRef.current = window.setInterval(() => {
            setDurationSeconds((prev) => prev + 1);
          }, 1000);

          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data: LiveServerMessage = JSON.parse(event.data);

            if (data.type === 'session_started' && data.session) {
              setSession(data.session);
            }

            if (data.type === 'interim_transcript') {
              if (data.interimText) {
                setInterimTranscript(data.interimText);
                setStreamingStatus('transcribing');
              }
            }

            if (data.type === 'final_transcript') {
              setInterimTranscript('');
              setStreamingStatus('listening');

              if (data.chunk) {
                setChunks((prev) => [...prev, data.chunk!]);
              }
              if (data.accumulatedTranscript) {
                setAccumulatedTranscript(data.accumulatedTranscript);
              }
              if (data.latestAnalysis) {
                setAnalysis(data.latestAnalysis);
              }
              if (typeof data.savedMemoriesCount === 'number') {
                setSavedMemoriesCount(data.savedMemoriesCount);
              }
            }

            if (data.type === 'analysis_update') {
              if (data.latestAnalysis) {
                setAnalysis(data.latestAnalysis);
              }
              if (typeof data.savedMemoriesCount === 'number') {
                setSavedMemoriesCount(data.savedMemoriesCount);
              }
            }

            if (data.type === 'session_completed') {
              if (data.session) {
                setSession(data.session);
                if (data.session.latestAnalysis) {
                  setAnalysis(data.session.latestAnalysis);
                }
                setSavedMemoriesCount(data.session.savedMemoriesCount);
              }
              setStreamingStatus('completed');
              setInterimTranscript('');
            }

            if (data.type === 'error') {
              setError(data.error?.message || 'Streaming recognition error');
            }
          } catch {
            // ignore non-json messages
          }
        };

        ws.onerror = (err) => {
          console.error('Live meeting WebSocket error:', err);
          setError('WebSocket connection error with backend server.');
          setStreamingStatus('error');
          cleanupAudio();
          resolve(false);
        };

        ws.onclose = () => {
          cleanupAudio();
          if (streamingStatus !== 'completed') {
            setStreamingStatus('idle');
          }
        };
      });
    },
    [setupAudioCapture, cleanupAudio, streamingStatus, systemAudioSupported]
  );

  // Stop Meeting
  const stopMeeting = useCallback(async (): Promise<void> => {
    // If we are a follower window, send command to the real stream owner
    if (!isStreamOwner() && broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'STREAM_COMMAND',
          action: 'stop_meeting',
        });
      } catch {}
      cleanupAudio();
      setIsStreaming(false);
      isStreamingRef.current = false;
      setStreamingStatus('completed');
      return;
    }

    isStreamingRef.current = false;
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const stopMsg: LiveClientMessage = { action: 'stop' };
      ws.send(JSON.stringify(stopMsg));
    }

    cleanupAudio();

    // Close WS after short grace period to receive session_completed
    setTimeout(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      setStreamingStatus('completed');
    }, 500);
  }, [cleanupAudio, isStreamOwner]);

  // Toggle Mic mute/unmute
  const toggleMic = useCallback(() => {
    // If we are a follower window, send command to stream owner
    if (!isStreamOwner() && broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'STREAM_COMMAND',
          action: 'toggle_mic',
        });
      } catch {}
      setMicEnabled((prev) => !prev);
      return;
    }

    if (!micStreamRef.current) return;
    const tracks = micStreamRef.current.getAudioTracks();
    const nextState = !micEnabled;
    tracks.forEach((track) => {
      track.enabled = nextState;
    });
    setMicEnabled(nextState);
  }, [micEnabled, isStreamOwner]);

  // Toggle System Audio (tab/screen audio)
  const toggleSystemAudio = useCallback(async () => {
    if (!systemAudioSupported) {
      setError('System audio capture is not supported by your browser or operating system.');
      return;
    }

    if (systemAudioEnabled && systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach((t) => t.stop());
      systemStreamRef.current = null;
      setSystemAudioEnabled(false);
      setSharedTabTitle(null);
      return;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach((t) => t.stop());
        setError('No audio track shared. When sharing, select "Share tab audio" or "Share system audio".');
        setSharedTabTitle(null);
        return;
      }

      // Extract human-friendly tab / display title before stopping video track
      const rawTitle = displayStream.getVideoTracks()[0]?.label || audioTracks[0]?.label || 'Shared Tab';
      const cleanTitle = rawTitle.replace(/^(tab|screen|window|entire screen):\s*/i, '').trim() || 'Shared Tab';
      setSharedTabTitle(cleanTitle);

      // Stop unnecessary video tracks
      displayStream.getVideoTracks().forEach((t) => t.stop());

      audioTracks[0].onended = () => {
        setSystemAudioEnabled(false);
        setSharedTabTitle(null);
        systemStreamRef.current = null;
      };

      systemStreamRef.current = displayStream;
      setSystemAudioEnabled(true);

      // Connect to existing processor or worklet if active
      if (audioContextRef.current) {
        const sysSource = audioContextRef.current.createMediaStreamSource(displayStream);
        if (workletNodeRef.current) {
          sysSource.connect(workletNodeRef.current);
        } else if (processorNodeRef.current) {
          sysSource.connect(processorNodeRef.current);
        }
      }
    } catch (err) {
      setSharedTabTitle(null);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        return; // User cancelled picker
      }
      setError(`System audio error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [systemAudioSupported, systemAudioEnabled]);

  return {
    isStreaming,
    streamingStatus,
    interimTranscript,
    chunks,
    accumulatedTranscript,
    analysis,
    savedMemoriesCount,
    session,
    micEnabled,
    systemAudioEnabled,
    systemAudioSupported,
    sharedTabTitle,
    durationSeconds,
    error,
    language,
    setLanguage,
    startMeeting,
    stopMeeting,
    toggleMic,
    toggleSystemAudio,
    clearError,
  };
}
