import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingDurationSeconds: number;
  micEnabled: boolean;
  systemAudioEnabled: boolean;
  systemAudioSupported: boolean;
  error: string | null;
  startRecording: (onChunkReady: (blob: Blob, sequenceNumber: number) => Promise<void>) => Promise<boolean>;
  stopRecording: () => void;
  toggleMic: () => void;
  toggleSystemAudio: () => Promise<void>;
  clearError: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState<number>(0);
  const [micEnabled, setMicEnabled] = useState<boolean>(true);
  const [systemAudioEnabled, setSystemAudioEnabled] = useState<boolean>(false);
  const [systemAudioSupported, setSystemAudioSupported] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isRecordingRef = useRef<boolean>(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const activeRecorderRef = useRef<MediaRecorder | null>(null);
  const chunkTimerRef = useRef<number | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const sequenceNumberRef = useRef<number>(0);
  const onChunkReadyRef = useRef<((blob: Blob, sequenceNumber: number) => Promise<void>) | null>(null);

  // Check browser capabilities on mount
  useEffect(() => {
    const hasDisplayMedia = Boolean(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
    );
    setSystemAudioSupported(hasDisplayMedia);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  };

  // Build or rebuild mixed stream from active mic and system audio sources
  const buildMixedStream = useCallback((): MediaStream | null => {
    const micStream = micStreamRef.current;
    const systemStream = systemStreamRef.current;

    const micTracks = micStream ? micStream.getAudioTracks().filter((t) => t.enabled) : [];
    const systemTracks = systemStream ? systemStream.getAudioTracks().filter((t) => t.enabled) : [];

    if (micTracks.length === 0 && systemTracks.length === 0) {
      return null;
    }

    // If only one stream is active, use it directly to save resources
    if (micTracks.length > 0 && systemTracks.length === 0) {
      return micStream;
    }
    if (systemTracks.length > 0 && micTracks.length === 0) {
      return systemStream;
    }

    // Mix both streams using Web Audio API
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const destination = ctx.createMediaStreamDestination();

      if (micStream && micTracks.length > 0) {
        const micSource = ctx.createMediaStreamSource(micStream);
        micSource.connect(destination);
      }

      if (systemStream && systemTracks.length > 0) {
        const sysSource = ctx.createMediaStreamSource(systemStream);
        sysSource.connect(destination);
      }

      mixedStreamRef.current = destination.stream;
      return destination.stream;
    } catch (err) {
      console.warn('Web Audio mixing failed, falling back to mic stream', err);
      return micStream;
    }
  }, []);

  // Discrete chunk recorder loop: runs 6-second cycles producing self-contained WebM chunks
  const scheduleNextChunk = useCallback(() => {
    if (!isRecordingRef.current) return;

    const stream = mixedStreamRef.current;
    if (!stream || stream.getAudioTracks().length === 0) {
      setError('No active audio tracks available to record.');
      return;
    }

    const mimeType = getSupportedMimeType();
    const options: MediaRecorderOptions = mimeType ? { mimeType } : {};

    try {
      const recorder = new MediaRecorder(stream, options);
      activeRecorderRef.current = recorder;
      const recordedBlobs: Blob[] = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedBlobs.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (recordedBlobs.length > 0 && onChunkReadyRef.current && isRecordingRef.current) {
          const finalBlob = new Blob(recordedBlobs, { type: recorder.mimeType || 'audio/webm' });
          const seq = sequenceNumberRef.current++;
          onChunkReadyRef.current(finalBlob, seq).catch((err) => {
            console.error(`Error processing chunk ${seq}:`, err);
          });
        }

        // Schedule next discrete chunk if recording continues
        if (isRecordingRef.current) {
          scheduleNextChunk();
        }
      };

      recorder.start();

      // Stop recorder after 6000ms (6 seconds) to produce a self-contained WebM file
      chunkTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 6000);
    } catch (err) {
      setError(`Audio recorder error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Request Microphone access
  const startRecording = useCallback(
    async (onChunkReady: (blob: Blob, sequenceNumber: number) => Promise<void>): Promise<boolean> => {
      setError(null);
      onChunkReadyRef.current = onChunkReady;
      sequenceNumberRef.current = 0;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Browser does not support audio capture via MediaDevices API.');
        return false;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        micStreamRef.current = stream;
        setMicEnabled(true);

        const mixed = buildMixedStream();
        if (!mixed) {
          setError('Failed to initialize audio stream.');
          return false;
        }

        mixedStreamRef.current = mixed;
        isRecordingRef.current = true;
        setIsRecording(true);
        setRecordingDurationSeconds(0);

        // Duration timer
        durationTimerRef.current = window.setInterval(() => {
          setRecordingDurationSeconds((prev) => prev + 1);
        }, 1000);

        // Start first chunk cycle
        scheduleNextChunk();
        return true;
      } catch (err: unknown) {
        let msg = 'Failed to access microphone.';
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = 'Microphone permission was denied. Please allow microphone permissions in your browser settings.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'No microphone device found on this system.';
          } else {
            msg = `Microphone error: ${err.message}`;
          }
        }
        setError(msg);
        return false;
      }
    },
    [buildMixedStream, scheduleNextChunk]
  );

  // Stop recording and cleanup
  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    setIsRecording(false);

    if (chunkTimerRef.current) {
      window.clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (durationTimerRef.current) {
      window.clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (activeRecorderRef.current && activeRecorderRef.current.state === 'recording') {
      try {
        activeRecorderRef.current.stop();
      } catch {
        // ignore stop errors on shutdown
      }
    }

    // Stop mic stream tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }

    // Stop system stream tracks
    if (systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach((track) => track.stop());
      systemStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    mixedStreamRef.current = null;
    activeRecorderRef.current = null;
  }, []);

  // Toggle Microphone mute/unmute
  const toggleMic = useCallback(() => {
    if (!micStreamRef.current) return;
    const tracks = micStreamRef.current.getAudioTracks();
    const nextState = !micEnabled;
    tracks.forEach((track) => {
      track.enabled = nextState;
    });
    setMicEnabled(nextState);
  }, [micEnabled]);

  // Toggle System / Tab Audio
  const toggleSystemAudio = useCallback(async () => {
    if (!systemAudioSupported) {
      setError('System audio capture is not supported by your browser or operating system.');
      return;
    }

    // If currently enabled, stop and disable
    if (systemAudioEnabled && systemStreamRef.current) {
      systemStreamRef.current.getTracks().forEach((t) => t.stop());
      systemStreamRef.current = null;
      setSystemAudioEnabled(false);
      if (isRecordingRef.current) {
        mixedStreamRef.current = buildMixedStream();
      }
      return;
    }

    // Request display media for tab / screen audio
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        // User didn't check "Share audio" or OS restricted it
        displayStream.getTracks().forEach((t) => t.stop());
        setError(
          'No audio track selected. When sharing, check "Share tab audio" or "Share system audio" in the browser dialog.'
        );
        return;
      }

      // Stop unnecessary video tracks to conserve CPU
      displayStream.getVideoTracks().forEach((t) => t.stop());

      // Auto-turn off when sharing is stopped
      audioTracks[0].onended = () => {
        setSystemAudioEnabled(false);
        systemStreamRef.current = null;
        if (isRecordingRef.current) {
          mixedStreamRef.current = buildMixedStream();
        }
      };

      systemStreamRef.current = displayStream;
      setSystemAudioEnabled(true);

      if (isRecordingRef.current) {
        mixedStreamRef.current = buildMixedStream();
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        // User cancelled picker, don't show error
        return;
      }
      setError(`System audio error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [systemAudioSupported, systemAudioEnabled, buildMixedStream]);

  return {
    isRecording,
    recordingDurationSeconds,
    micEnabled,
    systemAudioEnabled,
    systemAudioSupported,
    error,
    startRecording,
    stopRecording,
    toggleMic,
    toggleSystemAudio,
    clearError,
  };
}
