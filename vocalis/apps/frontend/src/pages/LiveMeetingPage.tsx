import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { useLiveMeetingStream } from '../hooks/useLiveMeetingStream';
import { triggerSessionAnalysis, fetchSessions, askScribe } from '../services/apiClient';
import { LiveAudioVisualizer } from '../components/LiveAudioVisualizer';
import { ShinyText } from '../components/motion';

export const LiveMeetingPage: React.FC = () => {
  const { params, navigate } = useRouter();
  const { showToast } = useToast();

  const [meetingTitle, setMeetingTitle] = useState<string>(
    params.roomId ? `P2P Room: #${params.roomId}` : 'Meeting #1'
  );

  useEffect(() => {
    if (!params.roomId) {
      fetchSessions().then(({ data }) => {
        const count = (data && data.length) || 0;
        setMeetingTitle(`Meeting #${count + 1}`);
      }).catch(() => {});
    }
  }, [params.roomId]);

  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isWrappingUp, setIsWrappingUp] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeRightTab, setActiveRightTab] = useState<'insights' | 'speakers' | 'ask'>('insights');
  const [copilotQuestion, setCopilotQuestion] = useState<string>('');
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [isCopilotThinking, setIsCopilotThinking] = useState<boolean>(false);

  const transcriptFeedRef = useRef<HTMLDivElement>(null);

  const {
    isStreaming,
    streamingStatus,
    interimTranscript,
    chunks,
    accumulatedTranscript,
    analysis,
    session,
    micEnabled,
    systemAudioEnabled,
    durationSeconds,
    startMeeting,
    stopMeeting,
    toggleMic,
    toggleSystemAudio,
  } = useLiveMeetingStream();

  // Sync title from active stream session if meeting started in popout or other window
  useEffect(() => {
    if (session?.title) {
      setMeetingTitle(session.title);
    }
  }, [session?.title]);

  // Auto-scroll transcript feed
  useEffect(() => {
    if (autoScroll && transcriptFeedRef.current) {
      transcriptFeedRef.current.scrollTop = transcriptFeedRef.current.scrollHeight;
    }
  }, [chunks, interimTranscript, autoScroll]);

  // Spacebar hotkey to toggle microphone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }
      if (e.code === 'Space' && isStreaming) {
        e.preventDefault();
        toggleMic();
        showToast(micEnabled ? 'Microphone Muted (Space)' : 'Microphone Active (Space)', '', 'info');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, micEnabled, toggleMic, showToast]);

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async (customTitle?: string) => {
    const titleToUse = customTitle || meetingTitle;
    await startMeeting(titleToUse);
    showToast('Live meeting started', 'Streaming voice to speech engine', 'info');
  };

  const handleMicClick = async () => {
    if (!isStreaming) {
      await handleStart();
    } else {
      toggleMic();
    }
  };

  const handleTabAudioClick = async () => {
    if (!isStreaming) {
      await startMeeting(meetingTitle);
      setTimeout(() => toggleSystemAudio(), 250);
      showToast('Meeting started, select tab to share audio', '', 'info');
    } else {
      toggleSystemAudio();
    }
  };

  const handleStop = async () => {
    setIsWrappingUp(true);
    setTimeout(async () => {
      await stopMeeting();
      setIsWrappingUp(false);
      showToast('Meeting finalized and indexed!', '', 'success');
      if (session) {
        navigate(`/meetings/${session.id}`);
      } else {
        navigate('/meetings');
      }
    }, 1800);
  };

  const handleTriggerAnalysis = async () => {
    if (!session) return;
    setIsAnalyzing(true);
    try {
      await triggerSessionAnalysis(session.id);
      showToast('Executive analysis refreshed', '', 'success');
    } catch {
      showToast('Analysis complete', '', 'info');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopilotAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = copilotQuestion.trim();
    if (!query || isCopilotThinking) return;

    setIsCopilotThinking(true);
    setCopilotAnswer(null);

    const fullLiveTranscript = chunks.length > 0
      ? chunks.map((c) => `[${c.timestamp}] ${c.speakerName || 'Speaker'}: ${c.text}`).join('\n')
      : accumulatedTranscript || interimTranscript;

    try {
      const res = await askScribe(query, session?.id, fullLiveTranscript);
      setCopilotAnswer(res.answer || 'No response generated.');
    } catch {
      setCopilotAnswer('Unable to query Copilot for this live meeting. Please ensure backend is reachable.');
    } finally {
      setIsCopilotThinking(false);
    }
  };


  // Speaker analytics computation for live meeting
  const liveSpeakerStats = React.useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    chunks.forEach((c) => {
      const spk = c.speakerName || 'Speaker 1';
      const words = c.text.split(/\s+/).filter(Boolean).length;
      map.set(spk, (map.get(spk) || 0) + words);
      total += words;
    });
    return Array.from(map.entries()).map(([name, words]) => ({
      name,
      words,
      percentage: total > 0 ? Math.round((words / total) * 100) : 0,
    }));
  }, [chunks]);

  const dynamicCopilotPlaceholder = React.useMemo(() => {
    if (analysis?.keyPoints?.[0]) {
      const cleanPoint = analysis.keyPoints[0].replace(/^[•\-\*\s]+/, '').trim();
      const snippet = cleanPoint.length > 50 ? `${cleanPoint.slice(0, 47)}...` : cleanPoint;
      return `Ask about "${snippet}"`;
    }
    if (meetingTitle && meetingTitle !== 'Live Meeting') {
      return `Ask about ${meetingTitle}...`;
    }
    return 'Ask a question about this meeting...';
  }, [analysis, meetingTitle]);

  const filteredChunks = chunks.filter((c) =>
    !searchQuery.trim() || c.text.toLowerCase().includes(searchQuery.toLowerCase()) || (c.speakerName && c.speakerName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Wrap up overlay modal
  if (isWrappingUp) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '65vh',
          gap: '1.5rem',
        }}
      >
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '4px solid var(--color-rule)', borderTopColor: 'var(--color-accent)', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--color-ink)', fontWeight: 700 }}>
            Indexing Meeting Intelligence
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--color-ink-muted)', marginTop: '0.35rem' }}>
            Transcribing speech, identifying speakers, and extracting action items...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* Studio Topbar Control Console */}
      <div
        className="luxury-card gsap-stagger"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderRadius: '20px',
          backgroundColor: 'var(--color-paper-card)',
          border: '1px solid var(--color-rule)',
        }}
      >
        {/* Left: Meeting Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '260px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isStreaming ? 'var(--color-danger)' : 'var(--color-ink-subtle)',
              boxShadow: isStreaming ? '0 0 10px rgba(220, 38, 38, 0.6)' : 'none',
              animation: isStreaming ? 'pulse 1.5s infinite' : 'none',
            }}
          />
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            placeholder="Session topic or room name..."
            disabled={isStreaming}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--color-ink)',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              flex: 1,
            }}
          />
        </div>

        {/* Center: Live Timer & Visualizer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '120px', height: '28px', display: 'flex', alignItems: 'center' }}>
            <LiveAudioVisualizer isActive={isStreaming && micEnabled} />
          </div>
          {isStreaming ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                backgroundColor: 'rgba(220, 38, 38, 0.12)',
                color: 'var(--color-danger)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.88rem',
                fontWeight: 700,
              }}
            >
              <span>REC</span>
              <span>{formatTimer(durationSeconds)}</span>
            </div>
          ) : (
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
              STANDBY
            </span>
          )}
        </div>

        {/* Right: Studio Primary Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-outline btn-sm ${isStreaming && micEnabled ? 'btn-active' : ''}`}
            onClick={handleMicClick}
            title="Toggle Microphone"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
            <span>{micEnabled ? 'Mic: On' : 'Mic: Muted'}</span>
          </button>

          <button
            className={`btn btn-outline btn-sm ${systemAudioEnabled ? 'btn-active' : ''}`}
            onClick={handleTabAudioClick}
            title="Capture tab/system audio"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>{systemAudioEnabled ? 'Tab Audio: On' : 'Tab Audio'}</span>
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => window.open('/overlay/copilot', 'VocalisCopilot', 'width=440,height=640,top=100,left=1000,resizable=yes')}
            title="Open floating copilot window"
          >
            Popout
          </button>

          {!isStreaming ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleStart()}
              disabled={streamingStatus === 'connecting'}
              style={{ fontWeight: 600 }}
            >
              <ShinyText text="Start Recording" speed="3s" color="#ffffff" />
            </button>
          ) : (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleStop}
              style={{ fontWeight: 600 }}
            >
              ⏹ End & Save
            </button>
          )}
        </div>
      </div>


      {/* Main 2-Column Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.95fr', gap: '1.5rem', alignItems: 'stretch' }}>
        {/* Left Stage: Live Speech Transcript Feed */}
        <div
          className="luxury-card"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            borderRadius: '20px',
            minHeight: '520px',
          }}
        >
          {/* Feed Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-ink)' }}>
                Live Discourse Stream
              </span>
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', backgroundColor: 'var(--color-paper-subtle)', color: 'var(--color-ink-muted)' }}>
                {chunks.length} chunks
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter transcript..."
                style={{
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.6rem',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--color-rule)',
                  backgroundColor: 'var(--color-paper-subtle)',
                  outline: 'none',
                  width: '140px',
                }}
              />
              <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', color: 'var(--color-ink-muted)' }}>
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Auto-scroll
              </label>
            </div>
          </div>

          {/* Transcript Content Area */}
          {chunks.length === 0 && !interimTranscript ? (
            <div
              style={{
                flex: 1,
                border: '1px dashed var(--color-rule)',
                borderRadius: '16px',
                padding: '2.5rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '0.85rem',
                margin: 'auto 0',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
              </div>
              <strong style={{ fontSize: '1.05rem', color: 'var(--color-ink)' }}>Awaiting Live Voice Stream</strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', maxWidth: '380px', lineHeight: 1.45 }}>
                Click <strong>"Start Recording"</strong> to begin streaming your microphone or tab audio in real time.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleStart()}
                style={{ marginTop: '0.35rem' }}
              >
                Start Recording Microphone →
              </button>
            </div>
          ) : (
            <div
              ref={transcriptFeedRef}
              style={{
                flex: 1,
                maxHeight: '520px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingRight: '0.35rem',
              }}
            >
              {filteredChunks.map((chunk) => {
                const isSpeaker1 = !chunk.speakerName || chunk.speakerName === 'Speaker 1';
                return (
                  <div
                    key={`c-${chunk.sequenceNumber}`}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '14px',
                      backgroundColor: isSpeaker1 ? 'var(--color-paper-subtle)' : 'var(--color-paper-card)',
                      border: '1px solid var(--color-rule)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: isSpeaker1 ? 'var(--color-accent)' : 'var(--color-accent-coral)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        👤 {chunk.speakerName || 'Speaker 1'}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
                        {chunk.timestamp}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-ink)', lineHeight: 1.5 }}>
                      {chunk.text}
                    </div>
                  </div>
                );
              })}

              {interimTranscript && (
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '14px',
                    backgroundColor: 'var(--color-accent-subtle)',
                    border: '1px solid var(--color-accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                      🎙️ Transcribing Live Speech...
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--color-ink)', fontStyle: 'italic' }}>
                    {interimTranscript}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Stage: Live Intelligence & Copilot */}
        <div
          className="luxury-card"
          style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            borderRadius: '20px',
            minHeight: '520px',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', backgroundColor: 'var(--color-paper-subtle)', borderRadius: 'var(--radius-pill)', padding: '3px', border: '1px solid var(--color-rule)', gap: '3px' }}>
            <button
              onClick={() => setActiveRightTab('insights')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: activeRightTab === 'insights' ? 'var(--color-paper-card)' : 'transparent',
                color: activeRightTab === 'insights' ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                fontWeight: activeRightTab === 'insights' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              ⚡ Live Intelligence
            </button>
            <button
              onClick={() => setActiveRightTab('speakers')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: activeRightTab === 'speakers' ? 'var(--color-paper-card)' : 'transparent',
                color: activeRightTab === 'speakers' ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                fontWeight: activeRightTab === 'speakers' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              👥 Speakers
            </button>
            <button
              onClick={() => setActiveRightTab('ask')}
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                backgroundColor: activeRightTab === 'ask' ? 'var(--color-paper-card)' : 'transparent',
                color: activeRightTab === 'ask' ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                fontWeight: activeRightTab === 'ask' ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              ✨ Ask Copilot
            </button>
          </div>

          {/* Tab 1: Live Intelligence Feed */}
          {activeRightTab === 'insights' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                  Autonomous Live Reasoning
                </span>
                {isStreaming && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleTriggerAnalysis}
                    disabled={isAnalyzing}
                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
                  >
                    {isAnalyzing ? 'Extracting...' : '⚡ Refresh Notes'}
                  </button>
                )}
              </div>

              {/* Live Key Discussion Points */}
              {analysis?.keyPoints && analysis.keyPoints.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 700 }}>
                    Live Key Discussion Points ({analysis.keyPoints.length})
                  </span>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: 0 }}>
                    {analysis.keyPoints.map((point, idx) => (
                      <li key={idx} style={{ fontSize: '0.84rem', color: 'var(--color-ink)', lineHeight: 1.45 }}>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Extracted Deliverables */}
              {analysis?.actionItems && analysis.actionItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-accent-coral)', fontWeight: 700 }}>
                    Extracted Deliverables ({analysis.actionItems.length})
                  </span>
                  {analysis.actionItems.map((act, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem 0.95rem',
                        borderRadius: '12px',
                        backgroundColor: 'var(--color-paper-subtle)',
                        border: '1px solid var(--color-rule)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.3rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.85rem', color: 'var(--color-ink)' }}>{act.task}</strong>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--color-ink-muted)' }}>
                        <span>👤 {act.owner || 'Unassigned'}</span>
                        <span>📅 {act.deadline || 'This week'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Agreed Decisions */}
              {analysis?.decisions && analysis.decisions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-success)', fontWeight: 700 }}>
                    Agreed Decisions ({analysis.decisions.length})
                  </span>
                  {analysis.decisions.map((dec, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '0.75rem 0.95rem',
                        borderRadius: '12px',
                        backgroundColor: 'var(--color-success-bg)',
                        border: '1px solid var(--color-success)',
                        fontSize: '0.85rem',
                        color: 'var(--color-ink)',
                      }}
                    >
                      ✓ {dec}
                    </div>
                  ))}
                </div>
              )}

              {(!analysis || (!analysis.keyPoints?.length && !analysis.actionItems?.length && !analysis.decisions?.length)) && (
                <div
                  style={{
                    border: '1px dashed var(--color-rule)',
                    borderRadius: '14px',
                    padding: '2rem 1.25rem',
                    textAlign: 'center',
                    color: 'var(--color-ink-muted)',
                    fontSize: '0.84rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.45rem',
                    margin: 'auto 0',
                  }}
                >
                  <span>🧠</span>
                  <span>Discussion points, tasks, and decisions extract automatically as speech streams in.</span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Live Speaker Participation */}
          {activeRightTab === 'speakers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1, overflowY: 'auto' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                Live Airtime & Turn Participation
              </span>
              {liveSpeakerStats.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-ink-muted)', fontSize: '0.84rem' }}>
                  Start speaking to see real-time diarization and airtime analytics.
                </div>
              ) : (
                liveSpeakerStats.map((spk, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>👤 {spk.name}</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{spk.percentage}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '7px', backgroundColor: 'var(--color-rule)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${spk.percentage}%`, height: '100%', backgroundColor: idx % 2 === 0 ? 'var(--color-accent)' : 'var(--color-accent-coral)' }} />
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-subtle)' }}>{spk.words} words spoken</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Ask Live Copilot */}
          {activeRightTab === 'ask' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                Ask Vocalis About This Session
              </span>
              <form onSubmit={handleCopilotAsk} style={{ display: 'flex', gap: '0.45rem' }}>
                <input
                  type="text"
                  value={copilotQuestion}
                  onChange={(e) => setCopilotQuestion(e.target.value)}
                  placeholder={dynamicCopilotPlaceholder}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-rule)',
                    backgroundColor: 'var(--color-paper-subtle)',
                    fontSize: '0.85rem',
                    color: 'var(--color-ink)',
                    outline: 'none',
                  }}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={isCopilotThinking}>
                  {isCopilotThinking ? '...' : 'Ask'}
                </button>
              </form>

              {copilotAnswer && (
                <div
                  style={{
                    padding: '0.85rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--color-paper-subtle)',
                    border: '1px solid var(--color-accent)',
                    fontSize: '0.85rem',
                    color: 'var(--color-ink)',
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--color-accent)', marginBottom: '0.35rem' }}>✨ Copilot Response:</div>
                  {copilotAnswer}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveMeetingPage;
