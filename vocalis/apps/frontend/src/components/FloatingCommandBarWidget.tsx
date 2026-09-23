import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useLiveMeetingStream } from '../hooks/useLiveMeetingStream';
import { askScribe } from '../services/apiClient';
import { useToast } from '../context/ToastContext';

export interface FloatingCommandBarWidgetProps {
  standaloneMode?: boolean;
  onExpandChange?: (expanded: boolean) => void;
}

export const FloatingCommandBarWidget: React.FC<FloatingCommandBarWidgetProps> = ({
  standaloneMode = false,
  onExpandChange,
}) => {
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [drawerTab, setDrawerTab] = useState<'transcript' | 'copilot' | 'actions'>('transcript');
  const [askQuery, setAskQuery] = useState<string>('');
  const [asking, setAsking] = useState<boolean>(false);
  const [copilotResponses, setCopilotResponses] = useState<Array<{ q: string; a: string }>>([]);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('scribe_floating_bar_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          if (parsed.x >= 0 && parsed.x < window.innerWidth - 100 && parsed.y >= 0 && parsed.y < window.innerHeight - 50) {
            return parsed;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const {
    isStreaming,
    interimTranscript,
    chunks,
    analysis,
    micEnabled,
    systemAudioEnabled,
    durationSeconds,
    startMeeting,
    stopMeeting,
    toggleMic,
    toggleSystemAudio,
  } = useLiveMeetingStream();

  const toggleExpand = (val?: boolean) => {
    const next = typeof val === 'boolean' ? val : !isExpanded;
    setIsExpanded(next);
    if (onExpandChange) onExpandChange(next);
  };

  useEffect(() => {
    if (isExpanded && transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [chunks, interimTranscript, isExpanded]);

  const formatTimer = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Dragging event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (standaloneMode) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('form')) {
      return;
    }

    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(10, Math.min(window.innerWidth - (rect.width || 400) - 10, dragStartRef.current.initialX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.initialY + dy));

      const newPos = { x: newX, y: newY };
      setPosition(newPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setPosition((curr) => {
        if (curr) {
          try {
            localStorage.setItem('scribe_floating_bar_pos', JSON.stringify(curr));
          } catch {}
        }
        return curr;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim()) return;
    const query = askQuery.trim();
    setAskQuery('');
    setAsking(true);
    try {
      const res = await askScribe(query);
      setCopilotResponses((prev) => [...prev, { q: query, a: res.answer }]);
      setDrawerTab('copilot');
      toggleExpand(true);
    } catch {
      showToast('Copilot query failed', '', 'error');
    } finally {
      setAsking(false);
    }
  };

  const launchPiPWindow = async () => {
    if ('documentPictureInPicture' in window) {
      try {
        const pipWin = await (window as any).documentPictureInPicture.requestWindow({
          width: 480,
          height: 64,
        });

        pipWin.document.body.style.margin = '0';
        pipWin.document.body.style.padding = '6px';
        pipWin.document.body.style.background = 'transparent';
        pipWin.document.body.style.overflow = 'hidden';
        pipWin.document.body.style.display = 'flex';
        pipWin.document.body.style.alignItems = 'center';
        pipWin.document.body.style.justifyContent = 'center';
        pipWin.document.documentElement.style.background = 'transparent';

        // Copy all stylesheets from main window
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            pipWin.document.head.appendChild(style);
          } catch {
            if (styleSheet.href) {
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = styleSheet.href;
              pipWin.document.head.appendChild(link);
            }
          }
        });

        const mountDiv = pipWin.document.createElement('div');
        mountDiv.id = 'pip-floating-root';
        mountDiv.style.width = '100%';
        pipWin.document.body.appendChild(mountDiv);

        const root = createRoot(mountDiv);
        root.render(
          <FloatingCommandBarWidget
            standaloneMode={true}
            onExpandChange={(expanded) => {
              pipWin.resizeTo(480, expanded ? 480 : 64);
            }}
          />
        );

        showToast('Floating Command Bar active over all tabs', '', 'success');
      } catch {
        window.open('/overlay/copilot', 'ScribeBar', 'width=480,height=80,top=100,left=1000,resizable=yes');
      }
    } else {
      window.open('/overlay/copilot', 'ScribeBar', 'width=480,height=80,top=100,left=1000,resizable=yes');
    }
  };

  const latestText = interimTranscript || (chunks.length > 0 ? chunks[chunks.length - 1].text : 'Ready to transcribe');

  // Closed state: discreet restore button
  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          padding: '8px 16px',
          borderRadius: '9999px',
          background: 'var(--color-ink)',
          color: 'var(--color-paper)',
          border: '1px solid var(--color-rule-focus)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
        title="Open Vocalis Floating Command Bar"
      >
        <span>✨ Vocalis Bar</span>
      </button>
    );
  }

  // Minimized state: sleek tiny pill
  if (isMinimized) {
    const customStyle: React.CSSProperties = !standaloneMode && position
      ? { position: 'fixed', left: `${position.x}px`, top: `${position.y}px`, bottom: 'auto', transform: 'none', zIndex: 9999 }
      : !standaloneMode
      ? { position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }
      : {};

    return (
      <div
        ref={barRef}
        style={customStyle}
        onMouseDown={handleMouseDown}
        onClick={() => setIsMinimized(false)}
        className="floating-command-bar"
        title="Click to expand Vocalis Command Bar"
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isStreaming ? 'var(--color-danger)' : 'var(--color-ink-subtle)',
            animation: isStreaming ? 'pipPulse 1.2s infinite ease-in-out' : 'none',
          }}
        />
        <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          {isStreaming ? formatTimer(durationSeconds) : 'Vocalis'}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-ink-muted)' }}>▲</span>
      </div>
    );
  }

  const wrapperStyle: React.CSSProperties = !standaloneMode && position
    ? { left: `${position.x}px`, top: `${position.y}px`, bottom: 'auto', transform: 'none' }
    : {};

  return (
    <div
      ref={barRef}
      style={wrapperStyle}
      className={standaloneMode ? 'floating-command-standalone' : 'floating-command-bar-wrapper'}
    >
      {/* Expanded Upward Drawer */}
      {isExpanded && (
        <div className="command-bar-drawer">
          {/* Drawer Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', borderBottom: '1px solid var(--color-rule)' }}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                className={`command-bar-btn ${drawerTab === 'transcript' ? 'active' : ''}`}
                onClick={() => setDrawerTab('transcript')}
                style={{ height: '26px', fontSize: '0.72rem' }}
              >
                Transcript ({chunks.length})
              </button>
              <button
                className={`command-bar-btn ${drawerTab === 'copilot' ? 'active' : ''}`}
                onClick={() => setDrawerTab('copilot')}
                style={{ height: '26px', fontSize: '0.72rem' }}
              >
                ✨ AI Copilot
              </button>
              <button
                className={`command-bar-btn ${drawerTab === 'actions' ? 'active' : ''}`}
                onClick={() => setDrawerTab('actions')}
                style={{ height: '26px', fontSize: '0.72rem' }}
              >
                ✓ Tasks ({analysis?.actionItems?.length || 0})
              </button>
            </div>

            <button
              onClick={() => toggleExpand(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--color-ink-muted)' }}
              title="Collapse"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div ref={transcriptScrollRef} style={{ padding: '0.75rem 1rem', maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.82rem' }}>
            {drawerTab === 'transcript' && (
              <>
                {chunks.length === 0 && !interimTranscript ? (
                  <div style={{ color: 'var(--color-ink-muted)', textAlign: 'center', padding: '1rem 0' }}>
                    {isStreaming ? 'Listening for speech in meeting...' : 'Click Record to start live speech transcription.'}
                  </div>
                ) : (
                  <>
                    {chunks.map((c, i) => (
                      <div key={i} style={{ borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.3rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-ink-subtle)', marginRight: '0.45rem' }}>
                          {c.timestamp}
                        </span>
                        <span>{c.text}</span>
                      </div>
                    ))}
                    {interimTranscript && (
                      <div style={{ color: 'var(--color-ink-muted)', fontStyle: 'italic' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginRight: '0.45rem' }}>Live:</span>
                        {interimTranscript}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {drawerTab === 'copilot' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {analysis?.keyPoints && analysis.keyPoints.length > 0 && (
                  <div style={{ backgroundColor: 'var(--color-paper-card)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-rule)' }}>
                    <strong style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--color-ink-muted)' }}>Key Topics</strong>
                    <ul style={{ margin: '0.2rem 0 0 1rem', padding: 0 }}>
                      {analysis.keyPoints.map((p, idx) => <li key={idx} style={{ marginTop: '0.15rem' }}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {copilotResponses.map((r, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--color-paper-card)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-rule-focus)' }}>
                    <strong style={{ fontSize: '0.74rem' }}>Q: {r.q}</strong>
                    <div style={{ color: 'var(--color-ink-muted)', marginTop: '0.2rem', lineHeight: 1.35 }}>{r.a}</div>
                  </div>
                ))}
              </div>
            )}

            {drawerTab === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {analysis?.decisions?.map((d, idx) => (
                  <div key={idx} style={{ fontSize: '0.78rem', color: 'var(--color-success)' }}>
                    ✓ <strong>Decision:</strong> {d}
                  </div>
                ))}
                {analysis?.actionItems?.map((a, idx) => (
                  <div key={idx} style={{ fontSize: '0.78rem', color: 'var(--color-ink)' }}>
                    📋 <strong>{a.task}</strong> {a.owner ? `(${a.owner})` : ''}
                  </div>
                ))}
                {(!analysis?.decisions || analysis.decisions.length === 0) && (!analysis?.actionItems || analysis.actionItems.length === 0) && (
                  <div style={{ color: 'var(--color-ink-muted)', textAlign: 'center', padding: '1rem 0' }}>
                    No decisions or action items detected yet.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer Query Input */}
          <form onSubmit={handleAsk} style={{ display: 'flex', padding: '0.45rem 0.65rem', borderTop: '1px solid var(--color-rule)', gap: '0.35rem', backgroundColor: 'var(--color-paper-card)' }}>
            <input
              type="text"
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              placeholder="Ask Copilot during call..."
              className="title-input"
              style={{ flex: 1, fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
            />
            <button type="submit" className="command-bar-btn active" disabled={asking || !askQuery.trim()}>
              {asking ? '...' : 'Ask'}
            </button>
          </form>
        </div>
      )}

      {/* Main Horizontal Floating Command Bar (Single Minimal Island) */}
      <div
        className="floating-command-bar"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Live Pulse & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }} onClick={() => toggleExpand()}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isStreaming ? 'var(--color-danger)' : 'var(--color-ink-subtle)',
              animation: isStreaming ? 'pipPulse 1.2s infinite ease-in-out' : 'none',
            }}
          />
          <span style={{ fontSize: '0.76rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: isStreaming ? 'var(--color-danger)' : 'var(--color-ink)' }}>
            {isStreaming ? formatTimer(durationSeconds) : 'Scribe'}
          </span>
        </div>

        <span style={{ width: '1px', height: '16px', backgroundColor: 'var(--color-rule)' }} />

        {/* Real-Time Speech Stream Ticker */}
        <div className="command-bar-ticker" onClick={() => toggleExpand()} style={{ cursor: 'pointer' }} title={latestText}>
          <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>💬</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{latestText}</span>
        </div>

        {/* Quick Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            className={`command-bar-btn ${micEnabled ? '' : 'btn-danger'}`}
            onClick={toggleMic}
            disabled={!isStreaming}
            title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            style={{ padding: '0 8px' }}
          >
            {micEnabled ? '🎙️' : '🔇'}
          </button>

          <button
            className={`command-bar-btn ${systemAudioEnabled ? 'active' : ''}`}
            onClick={toggleSystemAudio}
            disabled={!isStreaming}
            title={systemAudioEnabled ? 'Capturing Meeting Tab Audio' : 'Capture Google Meet / Zoom Audio'}
            style={{ padding: '0 8px' }}
          >
            {systemAudioEnabled ? '🔊 Tab' : '🔈 +Tab'}
          </button>

          {!standaloneMode && (
            <button
              className="command-bar-btn"
              onClick={launchPiPWindow}
              title="Float over other tabs (Picture-in-Picture)"
              style={{ padding: '0 8px' }}
            >
              🪟 Float
            </button>
          )}

          <button
            className={`command-bar-btn ${isExpanded ? 'active' : ''}`}
            onClick={() => toggleExpand()}
            title="Toggle AI Insights drawer"
            style={{ padding: '0 8px' }}
          >
            {isExpanded ? '▼' : '▲ Insights'}
          </button>

          {!isStreaming ? (
            <button
              className="command-bar-btn active"
              onClick={() => startMeeting('Live Meeting')}
              style={{ padding: '0 10px', backgroundColor: 'var(--color-ink)', color: 'var(--color-paper)' }}
            >
              ▶ Record
            </button>
          ) : (
            <button
              className="command-bar-btn btn-danger"
              onClick={stopMeeting}
              style={{ padding: '0 10px' }}
            >
              ■ End
            </button>
          )}

          {/* Minimize Button */}
          <button
            className="command-bar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
              setIsExpanded(false);
            }}
            title="Minimize floating bar"
            style={{ padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
              <path d="M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8z" />
            </svg>
          </button>

          {/* Close Button */}
          <button
            className="command-bar-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsVisible(false);
              setIsExpanded(false);
            }}
            title="Close floating bar (click bottom trigger to restore)"
            style={{ padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
