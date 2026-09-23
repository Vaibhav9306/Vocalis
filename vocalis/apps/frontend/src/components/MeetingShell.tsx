import React, { useState, useEffect, useRef } from 'react';
import { useLiveMeetingStream } from '../hooks/useLiveMeetingStream';
import { triggerSessionAnalysis } from '../services/apiClient';

export const MeetingShell: React.FC = () => {
  const [meetingTitle, setMeetingTitle] = useState<string>('P2P Strategy & Architecture Sync');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'summary' | 'actions' | 'questions'>('all');
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null);

  const transcriptFeedRef = useRef<HTMLDivElement>(null);

  const {
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
    durationSeconds,
    error,
    startMeeting,
    stopMeeting,
    toggleMic,
    toggleSystemAudio,
    clearError,
  } = useLiveMeetingStream();

  // Auto-scroll transcript feed when new chunks or interim text arrives
  useEffect(() => {
    if (autoScroll && transcriptFeedRef.current) {
      transcriptFeedRef.current.scrollTop = transcriptFeedRef.current.scrollHeight;
    }
  }, [chunks, interimTranscript, autoScroll]);

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    setManualError(null);
    clearError();
    await startMeeting(meetingTitle);
  };

  const handleStop = async () => {
    await stopMeeting();
  };

  const handleTriggerAnalysis = async () => {
    if (!session || !accumulatedTranscript) return;
    setIsAnalyzing(true);
    try {
      await triggerSessionAnalysis(session.id);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyTranscript = async () => {
    if (!accumulatedTranscript) return;
    try {
      await navigator.clipboard.writeText(accumulatedTranscript);
      setCopiedStatus('Transcript copied!');
      setTimeout(() => setCopiedStatus(null), 2000);
    } catch {
      setCopiedStatus('Failed to copy');
      setTimeout(() => setCopiedStatus(null), 2000);
    }
  };

  const activeError = manualError || error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Error Alert Banner */}
      {activeError && (
        <div className="alert-banner alert-danger">
          <span>⚠️ {activeError}</span>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setManualError(null);
              clearError();
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Meeting Action & Audio Source Controls Bar */}
      <div className="controls-bar">
        {/* Title Input */}
        <input
          type="text"
          className="title-input"
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          placeholder="Session Topic or Channel..."
          disabled={isStreaming}
        />

        {/* Start / Stop Button */}
        {!isStreaming ? (
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={streamingStatus === 'connecting'}
          >
            {streamingStatus === 'connecting' ? 'Connecting Mesh...' : '▶ Start P2P Session'}
          </button>
        ) : (
          <button
            className="btn btn-danger"
            onClick={handleStop}
          >
            ⏹ End & Save Session
          </button>
        )}

        {/* Audio Source Controls */}
        <button
          className={`btn btn-outline ${micEnabled ? 'btn-active' : ''}`}
          onClick={toggleMic}
          disabled={!isStreaming}
          title="Toggle microphone audio"
        >
          🎙️ {micEnabled ? 'Mic: On' : 'Mic: Muted'}
        </button>

        <button
          className={`btn btn-outline ${systemAudioEnabled ? 'btn-active' : ''}`}
          onClick={toggleSystemAudio}
          disabled={!systemAudioSupported || !isStreaming}
          title={
            systemAudioSupported
              ? 'Share system or browser tab meeting audio'
              : 'Tab audio sharing unsupported by current browser'
          }
        >
          🖥️ {systemAudioSupported ? (systemAudioEnabled ? 'System Audio: On' : 'System Audio: Off') : 'System Audio: N/A'}
        </button>

        {/* Live Audio Waveform Bars */}
        {isStreaming && micEnabled && (
          <div className="audio-visualizer-wave" title="P2P Audio stream active">
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
          </div>
        )}

        {/* Live Duration Timer */}
        {isStreaming && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span className="recording-pulse" />
            <span
              style={{
                fontSize: '0.86rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-danger)',
              }}
            >
              {formatTimer(durationSeconds)}
            </span>
          </div>
        )}

        {/* Encrypted Memory Counter Badge */}
        {savedMemoriesCount > 0 && (
          <div className="memory-counter-badge" title="Key decisions and tasks indexed to private local semantic memory">
            🔒 {savedMemoriesCount} {savedMemoriesCount === 1 ? 'Insight' : 'Insights'} Indexed
          </div>
        )}

        {/* Mesh Session Status */}
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>
          Mesh State:{' '}
          <strong
            style={{
              fontFamily: 'var(--font-mono)',
              color:
                streamingStatus === 'listening' || streamingStatus === 'transcribing'
                  ? 'var(--color-success)'
                  : streamingStatus === 'completed'
                    ? 'var(--color-accent)'
                    : 'var(--color-ink-muted)',
            }}
          >
            {streamingStatus === 'listening'
              ? 'Live Stream Active'
              : streamingStatus === 'transcribing'
                ? 'Transcribing Speech'
                : streamingStatus === 'connecting'
                  ? 'Connecting...'
                  : streamingStatus === 'completed'
                    ? 'Saved to Local Vault'
                    : 'Standby'}
          </strong>
        </span>
      </div>

      {/* Main Two-Column Intelligence Workspace */}
      <div className="grid-2">
        {/* Column 1: Live Speech-to-Text Transcription */}
        <div className="card">
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Live Room Transcription</span>
              {chunks.length > 0 && (
                <span className="badge-tag">
                  {chunks.length} {chunks.length === 1 ? 'chunk' : 'chunks'}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {accumulatedTranscript && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleCopyTranscript}
                  title="Copy full accumulated transcript"
                >
                  {copiedStatus || '📋 Copy Transcript'}
                </button>
              )}

              <label
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-ink-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Auto-scroll
              </label>
              <span className="badge-tag">Neural Speech Engine</span>
            </div>
          </div>

          {chunks.length === 0 && !interimTranscript ? (
            <div className="placeholder-box">
              <span className="phase-pill">Zero-Latency Scribe</span>
              <p><strong>Ready for Live Speech</strong></p>
              <p>
                Click <strong>Start P2P Session</strong> to initiate the audio stream. 
                Speech is transcribed in real-time with sub-second word-by-word hypotheses.
              </p>
            </div>
          ) : (
            <div className="transcript-feed" ref={transcriptFeedRef}>
              {/* Finalized Transcript Segments */}
              {chunks.map((chunk) => (
                <div key={`chunk-${chunk.sequenceNumber}`} className="chunk-card">
                  <div className="chunk-header">
                    <span className="chunk-seq">#{chunk.sequenceNumber}</span>
                    <span>
                      {chunk.durationSeconds ? `${chunk.durationSeconds.toFixed(1)}s · ` : ''}
                      {chunk.timestamp}
                    </span>
                  </div>
                  <div className="chunk-text">{chunk.text}</div>
                </div>
              ))}

              {/* Real-Time Interim Text */}
              {interimTranscript && (
                <div className="chunk-card chunk-interim">
                  <div className="chunk-header">
                    <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
                      🎙️ Capturing speech...
                    </span>
                    <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>live</span>
                  </div>
                  <div className="chunk-text">
                    {interimTranscript}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 2: AI Summarization, Action Items & Intelligence */}
        <div className="card">
          <div className="card-title">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Autonomous Meeting Intelligence</span>
              {analysis && (
                <span className="badge-tag" style={{ color: 'var(--color-success)', borderColor: 'var(--color-success-bg)' }}>
                  ✓ Synced
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {isStreaming && accumulatedTranscript.length >= 20 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={handleTriggerAnalysis}
                  disabled={isAnalyzing}
                  title="Generate instant intelligence pass on current transcript"
                >
                  {isAnalyzing ? 'Extracting...' : '⚡ Generate Notes'}
                </button>
              )}
              <span className="badge-tag">AI Intelligence</span>
            </div>
          </div>

          {/* Tab Filter Navigation */}
          {analysis && (
            <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.5rem' }}>
              <button
                className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('all')}
              >
                All
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'summary' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('summary')}
              >
                Executive Summary
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'actions' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('actions')}
              >
                Action Items ({analysis.actionItems?.length || 0})
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'questions' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('questions')}
              >
                Q&A ({analysis.detectedQuestions?.length || 0})
              </button>
            </div>
          )}

          {!analysis ? (
            <div className="placeholder-box">
              <span className="phase-pill">Real-Time Extraction</span>
              <p><strong>Autonomous Action & Decision Detection</strong></p>
              <p>
                As discussion progresses, the AI continuously identifies decisions, assigns action items, 
                and flags unresolved questions, securely indexing memories into your private vault.
              </p>
            </div>
          ) : (
            <div className="insights-container">
              {/* Key Discussion Points & Executive Summary */}
              {(activeTab === 'all' || activeTab === 'summary') && analysis.keyPoints && analysis.keyPoints.length > 0 && (
                <div className="insight-section">
                  <div className="insight-section-title">
                    <span>Executive Summary & Takeaways</span>
                  </div>
                  <ul
                    style={{
                      listStyleType: 'disc',
                      paddingLeft: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                    }}
                  >
                    {analysis.keyPoints.map((point, idx) => (
                      <li key={`kp-${idx}`} className="bullet-item">
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Items */}
              {(activeTab === 'all' || activeTab === 'actions') && analysis.actionItems && analysis.actionItems.length > 0 && (
                <div className="insight-section">
                  <div className="insight-section-title">
                    <span>Action Items & Assigned Tasks ({analysis.actionItems.length})</span>
                    <span style={{ color: 'var(--color-success)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                      🔒 Vault Synced
                    </span>
                  </div>
                  {analysis.actionItems.map((item, idx) => (
                    <div key={`act-${idx}`} className="action-card">
                      <div>
                        <strong>Task:</strong> {item.task}
                      </div>
                      <div className="action-meta">
                        {item.owner && (
                          <span>
                            👤 Assignee: <strong>{item.owner}</strong>
                          </span>
                        )}
                        {item.deadline && (
                          <span>
                            📅 Due: <strong>{item.deadline}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Decisions */}
              {(activeTab === 'all' || activeTab === 'summary') && analysis.decisions && analysis.decisions.length > 0 && (
                <div className="insight-section">
                  <div className="insight-section-title">
                    <span>Agreed Decisions ({analysis.decisions.length})</span>
                    <span style={{ color: 'var(--color-success)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                      🔒 Vault Synced
                    </span>
                  </div>
                  {analysis.decisions.map((decision, idx) => (
                    <div key={`dec-${idx}`} className="decision-card">
                      <span>✓</span>
                      <div>
                        <strong>Decision:</strong> {decision}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Questions Detected */}
              {(activeTab === 'all' || activeTab === 'questions') && analysis.detectedQuestions && analysis.detectedQuestions.length > 0 && (
                <div className="insight-section">
                  <div className="insight-section-title">
                    <span>Questions & Suggested Answers ({analysis.detectedQuestions.length})</span>
                  </div>
                  {analysis.detectedQuestions.map((q, idx) => (
                    <div key={`q-${idx}`} className="question-card">
                      <div>
                        <strong>Question:</strong> {q.question}
                      </div>
                      {q.suggestedAnswer && (
                        <div className="question-answer">
                          <strong>Suggested Answer:</strong> {q.suggestedAnswer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Topics */}
              {(activeTab === 'all' || activeTab === 'summary') && analysis.topics && analysis.topics.length > 0 && (
                <div className="insight-section">
                  <div className="insight-section-title">
                    <span>Session Tags</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {analysis.topics.map((topic, idx) => (
                      <span key={`top-${idx}`} className="badge-tag">
                        #{topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
