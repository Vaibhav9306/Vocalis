import React, { useState, useEffect, useRef } from 'react';
import { useLiveMeetingStream } from '../hooks/useLiveMeetingStream';
import { askScribe } from '../services/apiClient';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

export const MeetingCopilotOverlay: React.FC = () => {
  const { showToast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  const [activeTab, setActiveTab] = useState<'transcript' | 'copilot' | 'notes'>('transcript');
  const [isCompact, setIsCompact] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [meetingTitle] = useState<string>('Live Meeting');

  // AI Copilot Q&A state
  const [askInput, setAskInput] = useState<string>('');
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [copilotHistory, setCopilotHistory] = useState<Array<{ id: string; q: string; a: string; time: string }>>([
    {
      id: 'welcome',
      q: 'How does Vocalis Copilot assist during this live meeting?',
      a: 'I am transcribing your conversation and analyzing key takeaways in real time. Ask me questions, check agreed decisions, or inspect action items as the meeting progresses.',
      time: 'Live',
    },
  ]);

  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const liveTickerRef = useRef<HTMLDivElement>(null);
  const compactTickerRef = useRef<HTMLDivElement>(null);

  const {
    isStreaming,
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

  const formatTimer = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Keep title & document styling consistent
  useEffect(() => {
    document.title = isStreaming ? `🔴 [${formatTimer(durationSeconds)}] Vocalis Copilot` : 'Vocalis Meeting Copilot';
  }, [isStreaming, durationSeconds]);

  // Auto-scroll transcript feed smoothly when new chunks arrive
  useEffect(() => {
    if (autoScroll && transcriptScrollRef.current) {
      const el = transcriptScrollRef.current;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [chunks.length, autoScroll]);

  // Auto-scroll live tickers to always show the most recent incoming words
  useEffect(() => {
    if (liveTickerRef.current) {
      liveTickerRef.current.scrollLeft = liveTickerRef.current.scrollWidth;
    }
    if (compactTickerRef.current) {
      compactTickerRef.current.scrollLeft = compactTickerRef.current.scrollWidth;
    }
  }, [interimTranscript, chunks.length]);

  const dynamicPlaceholder = React.useMemo(() => {
    if (analysis?.keyPoints?.[0]) {
      const clean = analysis.keyPoints[0].replace(/^[•\-\*\s]+/, '').trim();
      const snippet = clean.length > 45 ? `${clean.slice(0, 42)}...` : clean;
      return `Ask about "${snippet}"`;
    }
    return 'Ask Vocalis about this live meeting...';
  }, [analysis]);

  const handleAsk = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const query = (customQuery || askInput).trim();
    if (!query || isAsking) return;

    setAskInput('');
    setIsAsking(true);
    const newEntry = {
      id: `q-${Date.now()}`,
      q: query,
      a: 'Synthesizing live meeting context...',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setCopilotHistory((prev) => [...prev, newEntry]);

    const fullLiveTranscript = chunks.length > 0
      ? chunks.map((c) => `[${c.timestamp}] ${c.speakerName || 'Speaker'}: ${c.text}`).join('\n')
      : accumulatedTranscript || interimTranscript;

    try {
      const res = await askScribe(query, session?.id, fullLiveTranscript);
      setCopilotHistory((prev) =>
        prev.map((item) => (item.id === newEntry.id ? { ...item, a: res.answer } : item))
      );
    } catch {
      setCopilotHistory((prev) =>
        prev.map((item) =>
          item.id === newEntry.id
            ? { ...item, a: 'Unable to query context. Ensure speech is streaming.' }
            : item
        )
      );
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopyTranscript = () => {
    const fullText = chunks.map((c) => `[${c.timestamp}] ${c.speakerName || 'Speaker 1'}: ${c.text}`).join('\n');
    if (!fullText) {
      showToast('Transcript is currently empty', '', 'info');
      return;
    }
    navigator.clipboard.writeText(fullText);
    showToast('Full transcript copied to clipboard!', '', 'success');
  };

  const filteredChunks = chunks.filter((c) =>
    searchQuery.trim() ? c.text.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--color-paper)',
        color: 'var(--color-ink)',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--color-paper-card)',
          borderBottom: '1px solid var(--color-rule)',
          flexShrink: 0,
          gap: '0.75rem',
        }}
      >
        {/* Left: Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-accent)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: 800,
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            V
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', fontFamily: 'var(--font-display)', color: 'var(--color-ink)' }}>
                Vocalis Copilot
              </span>
              {isStreaming ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: 'var(--color-danger)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-danger)',
                    }}
                  />
                  <span>{formatTimer(durationSeconds)}</span>
                </span>
              ) : (
                <span style={{ fontSize: '0.7rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
                  Idle
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {/* Mic Toggle */}
          <button
            onClick={() => (!isStreaming ? startMeeting(meetingTitle) : toggleMic())}
            title={!isStreaming ? 'Start Meeting' : micEnabled ? 'Mute Mic' : 'Unmute Mic'}
            className="btn btn-outline btn-sm"
            style={{
              fontSize: '0.76rem',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-pill)',
              color: isStreaming && !micEnabled ? 'var(--color-danger)' : undefined,
              borderColor: isStreaming && micEnabled ? 'var(--color-accent)' : undefined,
            }}
          >
            {isStreaming && !micEnabled ? '🔇 Muted' : '🎙️ Mic'}
          </button>

          {/* Tab Audio Toggle */}
          <button
            onClick={() => toggleSystemAudio()}
            title="Capture meeting tab audio (Google Meet / Zoom)"
            className="btn btn-outline btn-sm"
            style={{
              fontSize: '0.76rem',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: systemAudioEnabled ? 'var(--color-accent-subtle)' : undefined,
              color: systemAudioEnabled ? 'var(--color-accent)' : undefined,
              borderColor: systemAudioEnabled ? 'var(--color-accent)' : undefined,
            }}
          >
            {systemAudioEnabled ? '🔊 Tab On' : '🔈 +Tab Audio'}
          </button>

          {/* Record / Stop Button */}
          {!isStreaming ? (
            <button
              onClick={() => startMeeting(meetingTitle)}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.76rem', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-pill)' }}
            >
              ▶ Start
            </button>
          ) : (
            <button
              onClick={() => stopMeeting()}
              className="btn btn-danger btn-sm"
              style={{ fontSize: '0.76rem', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-pill)' }}
            >
              ⏹ End
            </button>
          )}

          {/* Dark / Light Mode Switch */}
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            className="btn btn-outline btn-sm"
            style={{ padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-pill)', fontSize: '0.76rem' }}
          >
            {resolvedTheme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Compact View Toggle */}
          <button
            onClick={() => setIsCompact(!isCompact)}
            title={isCompact ? 'Expand view' : 'Compact bar'}
            className="btn btn-outline btn-sm"
            style={{ padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-pill)', fontSize: '0.76rem' }}
          >
            {isCompact ? '▼ Expand' : '▲ Compact'}
          </button>
        </div>
      </header>

      {/* Compact Mode: Live Speech Ticker */}
      {isCompact && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1rem',
            backgroundColor: 'var(--color-paper-card)',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-accent)', fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>LIVE:</span>
            <div
              ref={compactTickerRef}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: '0.84rem',
                color: 'var(--color-ink)',
                whiteSpace: 'nowrap',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20px)',
                maskImage: 'linear-gradient(to right, transparent 0%, black 20px)',
                fontStyle: interimTranscript ? 'italic' : 'normal',
              }}
            >
              {interimTranscript || (chunks.length > 0 ? chunks[chunks.length - 1].text : 'Ready to capture meeting voice...')}
            </div>
          </div>

          <button
            onClick={() => setIsCompact(false)}
            className="btn btn-outline btn-sm"
            style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', whiteSpace: 'nowrap' }}
          >
            Expand Panel →
          </button>
        </div>
      )}

      {/* Full Companion Panel Mode */}
      {!isCompact && (
        <>
          {/* Navigation Tab Strip */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.45rem 1rem',
              backgroundColor: 'var(--color-paper-subtle)',
              borderBottom: '1px solid var(--color-rule)',
              flexShrink: 0,
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', backgroundColor: 'var(--color-paper-card)', borderRadius: 'var(--radius-pill)', padding: '2px', border: '1px solid var(--color-rule)', gap: '2px' }}>
              <button
                onClick={() => setActiveTab('transcript')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  backgroundColor: activeTab === 'transcript' ? 'var(--color-accent)' : 'transparent',
                  color: activeTab === 'transcript' ? '#ffffff' : 'var(--color-ink-muted)',
                  fontWeight: activeTab === 'transcript' ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>Transcript</span>
                <span style={{ opacity: 0.85, fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>({chunks.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('copilot')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  backgroundColor: activeTab === 'copilot' ? 'var(--color-accent)' : 'transparent',
                  color: activeTab === 'copilot' ? '#ffffff' : 'var(--color-ink-muted)',
                  fontWeight: activeTab === 'copilot' ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                ✨ Ask Vocalis
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  backgroundColor: activeTab === 'notes' ? 'var(--color-accent)' : 'transparent',
                  color: activeTab === 'notes' ? '#ffffff' : 'var(--color-ink-muted)',
                  fontWeight: activeTab === 'notes' ? 700 : 500,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>Tasks & Decisions</span>
                {((analysis?.actionItems?.length || 0) + (analysis?.decisions?.length || 0)) > 0 && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '0.05rem 0.35rem',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: activeTab === 'notes' ? 'rgba(255,255,255,0.25)' : 'var(--color-accent-subtle)',
                      color: activeTab === 'notes' ? '#ffffff' : 'var(--color-accent)',
                      fontWeight: 700,
                    }}
                  >
                    {(analysis?.actionItems?.length || 0) + (analysis?.decisions?.length || 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Sub actions */}
            {activeTab === 'transcript' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  onClick={handleCopyTranscript}
                  title="Copy full transcript"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: 'var(--radius-pill)' }}
                >
                  Copy
                </button>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`btn btn-sm ${autoScroll ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-pill)' }}
                >
                  {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
                </button>
              </div>
            )}
          </nav>

          {/* TAB 1: LIVE TRANSCRIPT FEED */}
          {activeTab === 'transcript' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Transcript Search Bar */}
              <div style={{ padding: '0.35rem 0.85rem', borderBottom: '1px solid var(--color-rule)', backgroundColor: 'var(--color-paper-card)', flexShrink: 0 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search spoken words in this meeting..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: 'var(--color-paper-subtle)',
                    border: '1px solid var(--color-rule)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-ink)',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Rolling Transcript Body */}
              <div
                ref={transcriptScrollRef}
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  maxWidth: '900px',
                  margin: '0 auto',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {filteredChunks.length === 0 && !interimTranscript ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      color: 'var(--color-ink-muted)',
                      gap: '0.5rem',
                      padding: '2rem 1rem',
                    }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                    </div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--color-ink)' }}>
                      {isStreaming ? 'Listening for speech input...' : 'Ready for Meeting Stream'}
                    </strong>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', maxWidth: '300px', lineHeight: 1.4, margin: 0 }}>
                      {isStreaming
                        ? 'Spoken dialogue will transcribe here in real time with automatic speaker segmentation.'
                        : 'Click "▶ Start" in the toolbar above to begin recording.'}
                    </p>
                  </div>
                ) : (
                  filteredChunks.map((chunk, idx) => {
                    const isSpeaker1 = !chunk.speakerName || chunk.speakerName === 'Speaker 1';
                    return (
                      <div
                        key={idx}
                        className="luxury-card"
                        style={{
                          backgroundColor: isSpeaker1 ? 'var(--color-paper-card)' : 'var(--color-paper-subtle)',
                          border: '1px solid var(--color-rule)',
                          borderRadius: '10px',
                          padding: '0.55rem 0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          flexShrink: 0,
                          boxShadow: 'var(--shadow-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              color: isSpeaker1 ? 'var(--color-accent)' : 'var(--color-accent-coral)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            👤 {chunk.speakerName || 'Speaker 1'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
                            {chunk.timestamp} · #{chunk.sequenceNumber}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.82rem', lineHeight: 1.45, color: 'var(--color-ink)' }}>
                          {chunk.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Docked Live Speech Ticker (Always shows the most recent incoming words) */}
              {interimTranscript && (
                <div
                  style={{
                    padding: '0.45rem 0.85rem',
                    backgroundColor: 'var(--color-accent-subtle)',
                    borderTop: '1px solid var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-ink)',
                    flexShrink: 0,
                    minWidth: 0,
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--color-accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    🎙️ Live:
                  </span>
                  <div
                    ref={liveTickerRef}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontStyle: 'italic',
                      whiteSpace: 'nowrap',
                      overflowX: 'auto',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 24px)',
                      maskImage: 'linear-gradient(to right, transparent 0%, black 24px)',
                    }}
                  >
                    {interimTranscript}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ASK VOCALIS COPILOT */}
          {activeTab === 'copilot' && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', maxWidth: '850px', margin: '0 auto', width: '100%' }}>
              {/* Quick AI Chips */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  padding: '0.5rem 1rem',
                  overflowX: 'auto',
                  borderBottom: '1px solid var(--color-rule)',
                  flexShrink: 0,
                  backgroundColor: 'var(--color-paper-card)',
                }}
              >
                {[
                  'Summarize discussion so far',
                  'What key decisions were agreed?',
                  'What are the action deliverables?',
                  'Who spoke the most?',
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAsk(undefined, chip)}
                    className="btn btn-outline btn-sm"
                    style={{
                      borderRadius: 'var(--radius-pill)',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.74rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Chat Thread */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                {copilotHistory.map((item) => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {/* User Question */}
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        backgroundColor: 'var(--color-accent)',
                        color: '#ffffff',
                        borderRadius: '14px 14px 2px 14px',
                        padding: '0.55rem 0.85rem',
                        maxWidth: '85%',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        boxShadow: 'var(--shadow-subtle)',
                      }}
                    >
                      {item.q}
                    </div>

                    {/* AI Response */}
                    <div
                      className="luxury-card"
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: 'var(--color-paper-card)',
                        border: '1px solid var(--color-rule)',
                        borderRadius: '14px 14px 14px 2px',
                        padding: '0.75rem 1rem',
                        maxWidth: '92%',
                        fontSize: '0.84rem',
                        lineHeight: 1.55,
                        color: 'var(--color-ink)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                          ✨ Vocalis Copilot
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>{item.time}</span>
                      </div>
                      <div>{item.a}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Form */}
              <form
                onSubmit={handleAsk}
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  padding: '0.65rem 1rem',
                  borderTop: '1px solid var(--color-rule)',
                  backgroundColor: 'var(--color-paper-card)',
                }}
              >
                <input
                  type="text"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  placeholder={dynamicPlaceholder}
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--color-paper-subtle)',
                    border: '1px solid var(--color-rule)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.84rem',
                    color: 'var(--color-ink)',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={isAsking || !askInput.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ borderRadius: 'var(--radius-pill)', padding: '0.45rem 1rem', fontSize: '0.8rem' }}
                >
                  {isAsking ? 'Thinking...' : 'Ask'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: TASKS & DECISIONS */}
          {activeTab === 'notes' && (
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                maxWidth: '850px',
                margin: '0 auto',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {/* Key Discussion Points */}
              <div className="luxury-card" style={{ padding: '1rem', borderRadius: '16px', border: '1px solid var(--color-rule)' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-accent)', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                  Executive Discussion Points
                </div>
                {analysis?.keyPoints && analysis.keyPoints.length > 0 ? (
                  <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: 0 }}>
                    {analysis.keyPoints.map((point, idx) => (
                      <li key={idx} style={{ fontSize: '0.84rem', color: 'var(--color-ink)', lineHeight: 1.45 }}>
                        {point}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>
                    Discussion points extract automatically as the conversation flows.
                  </div>
                )}
              </div>

              {/* Extracted Decisions */}
              <div className="luxury-card" style={{ padding: '1rem', borderRadius: '16px', border: '1px solid var(--color-rule)' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-success)', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                  Agreed Key Decisions
                </div>
                {analysis?.decisions && analysis.decisions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {analysis.decisions.map((dec, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--color-success-bg)',
                          border: '1px solid var(--color-success)',
                          borderRadius: '10px',
                          padding: '0.55rem 0.75rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.45rem',
                          fontSize: '0.84rem',
                          color: 'var(--color-ink)',
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ color: 'var(--color-success)', fontWeight: 800 }}>✓</span>
                        <span>{dec}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>
                    No decisions recorded yet. Agreed resolutions appear here.
                  </div>
                )}
              </div>

              {/* Extracted Action Items */}
              <div className="luxury-card" style={{ padding: '1rem', borderRadius: '16px', border: '1px solid var(--color-rule)' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-accent-coral)', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                  Assigned Deliverables
                </div>
                {analysis?.actionItems && analysis.actionItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {analysis.actionItems.map((act, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'var(--color-paper-subtle)',
                          border: '1px solid var(--color-rule)',
                          borderRadius: '10px',
                          padding: '0.6rem 0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                          <span style={{ color: 'var(--color-accent)' }}>📋</span>
                          <span>{act.task}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.74rem', color: 'var(--color-ink-muted)', paddingLeft: '1.25rem' }}>
                          <span>👤 {act.owner || 'Unassigned'}</span>
                          <span>📅 {act.deadline || 'This week'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)' }}>
                    No actionable tasks detected yet. Tasks with assignees appear automatically.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};

export default MeetingCopilotOverlay;
