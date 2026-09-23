import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { getSession, askMeeting, addMeetingComment } from '../services/apiClient';
import { LiveMeetingSession, AskScribeResponse } from '@meeting-assistant/shared-types';
import { usePageTransition } from '../hooks/useGsapAnimations';

export const MeetingDetailPage: React.FC = () => {
  const { params, navigate } = useRouter();
  const { showToast } = useToast();
  const meetingId = params.meetingId;
  const containerRef = usePageTransition([meetingId]);

  const [session, setSession] = useState<LiveMeetingSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'actions' | 'decisions' | 'speakers'>('summary');
  const [transcriptSearch, setTranscriptSearch] = useState<string>('');
  const [askQuery, setAskQuery] = useState<string>('');
  const [askResponse, setAskResponse] = useState<AskScribeResponse | null>(null);
  const [asking, setAsking] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [highlightTimestamp, setHighlightTimestamp] = useState<string | null>(null);

  // Dynamic contextual placeholder for "Ask Vocalis About This Meeting"
  const dynamicAskPlaceholder = React.useMemo(() => {
    if (!session) return 'Ask anything about this meeting...';
    if (session.latestAnalysis?.keyPoints?.[0]) {
      const cleanPoint = session.latestAnalysis.keyPoints[0].replace(/^[•\-\*\s]+/, '').trim();
      const snippet = cleanPoint.length > 55 ? `${cleanPoint.slice(0, 52)}...` : cleanPoint;
      return `Ask about "${snippet}"`;
    }
    if (session.latestAnalysis?.topics && session.latestAnalysis.topics.length > 0) {
      return `Ask about ${session.latestAnalysis.topics.slice(0, 2).join(' or ')}...`;
    }
    if (session.title && session.title !== 'Live Meeting') {
      return `Ask about ${session.title}...`;
    }
    return 'Ask anything about this meeting...';
  }, [session]);

  // Compute Speaker Analytics & "Who Spoke to Whom" Turn Interactions
  const speakerStats = React.useMemo(() => {
    if (!session || !session.chunks || session.chunks.length === 0) return { speakers: [], transitions: [], totalWords: 0 };

    const speakerMap = new Map<string, { name: string; words: number; turns: number }>();
    const transitions: Array<{ from: string; to: string; type: 'question' | 'handoff'; snippet: string; timestamp: string }> = [];

    let totalWords = 0;
    let prevSpeaker: string | null = null;
    let prevText: string = '';

    session.chunks.forEach((chunk) => {
      const spk = chunk.speakerName || 'Speaker 1';
      const words = chunk.text.split(/\s+/).filter(Boolean).length;
      totalWords += words;

      if (!speakerMap.has(spk)) {
        speakerMap.set(spk, { name: spk, words: 0, turns: 0 });
      }
      const current = speakerMap.get(spk)!;
      current.words += words;
      current.turns += 1;

      // Detect who spoke to whom transition
      if (prevSpeaker && prevSpeaker !== spk) {
        const isQuestion = prevText.trim().endsWith('?');
        transitions.push({
          from: prevSpeaker,
          to: spk,
          type: isQuestion ? 'question' : 'handoff',
          snippet: chunk.text.slice(0, 75),
          timestamp: chunk.timestamp,
        });
      }

      prevSpeaker = spk;
      prevText = chunk.text;
    });

    const speakers = Array.from(speakerMap.values()).map((s) => ({
      ...s,
      percentage: totalWords > 0 ? Math.round((s.words / totalWords) * 100) : 0,
    }));

    return { speakers, transitions, totalWords };
  }, [session]);

  useEffect(() => {
    if (!meetingId) return;
    setLoading(true);
    getSession(meetingId).then((res) => {
      if (res.data) setSession(res.data);
      setLoading(false);
    });
  }, [meetingId]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuery.trim() || !meetingId) return;
    setAsking(true);
    const res = await askMeeting(meetingId, askQuery);
    setAskResponse(res);
    setAsking(false);
  };

  const handleCopySummary = () => {
    if (!session) return;
    const summaryText = session.latestAnalysis?.keyPoints?.map((p) => `• ${p}`).join('\n') || session.accumulatedTranscript;
    navigator.clipboard.writeText(summaryText);
    showToast('Executive summary copied to clipboard!', '', 'success');
  };

  const handleAddComment = async (timestamp = '00:00') => {
    if (!newCommentText.trim() || !meetingId) return;
    const res = await addMeetingComment(meetingId, {
      text: newCommentText,
      timestamp,
    });
    if (res.data && session) {
      setSession({
        ...session,
        comments: [...(session.comments || []), res.data],
      });
      setNewCommentText('');
      showToast('Comment attached to transcript', '', 'success');
    }
  };

  const handleExport = (format: 'md' | 'json' | 'txt' | 'csv') => {
    if (!session) return;
    let content = '';
    let mime = 'text/plain';
    const filename = `${session.title.toLowerCase().replace(/\s+/g, '-')}.${format}`;

    if (format === 'md') {
      content = `# ${session.title}\nDate: ${new Date(session.startedAt).toLocaleString()}\n\n## Executive Summary\n${session.latestAnalysis?.keyPoints?.map((p) => `- ${p}`).join('\n') || 'None'}\n\n## Decisions\n${session.latestAnalysis?.decisions?.map((d) => `- ${d}`).join('\n') || 'None'}\n\n## Action Items\n${session.latestAnalysis?.actionItems?.map((a) => `- [ ] ${a.task} (Owner: ${a.owner || 'Unassigned'}, Due: ${a.deadline || 'TBD'})`).join('\n') || 'None'}\n\n## Transcript\n${session.accumulatedTranscript}`;
      mime = 'text/markdown';
    } else if (format === 'json') {
      content = JSON.stringify(session, null, 2);
      mime = 'application/json';
    } else if (format === 'csv') {
      content = `Task,Owner,Deadline\n` + (session.latestAnalysis?.actionItems?.map((a) => `"${a.task}","${a.owner || ''}","${a.deadline || ''}"`).join('\n') || '');
      mime = 'text/csv';
    } else {
      content = `MEETING: ${session.title}\nDATE: ${session.startedAt}\n\nTRANSCRIPT:\n${session.accumulatedTranscript}`;
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported as ${format.toUpperCase()}`, '', 'success');
  };

  if (loading) {
    return <div className="placeholder-box">Loading meeting details...</div>;
  }

  if (!session) {
    return (
      <div className="placeholder-box">
        <p>Meeting not found.</p>
        <button className="btn btn-primary btn-sm magnetic-btn" onClick={() => navigate('/meetings')}>
          Return to Meetings Library
        </button>
      </div>
    );
  }

  const filteredChunks = session.chunks.filter((c) =>
    c.text.toLowerCase().includes(transcriptSearch.toLowerCase())
  );

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Header & Actions */}
      <div
        className="gsap-stagger"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--color-rule)',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              onClick={() => navigate('/meetings')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-ink-muted)' }}
            >
              ← Back to Meetings
            </button>
            <span style={{ color: 'var(--color-rule-focus)' }}>/</span>
            <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
              #{session.id.slice(0, 8)}
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', marginTop: '0.35rem' }}>
            {session.title}
          </h1>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.35rem', fontSize: '0.82rem', color: 'var(--color-ink-muted)' }}>
            <span>📅 {new Date(session.startedAt).toLocaleString()}</span>
            <span>⏱️ {Math.round((session.durationSeconds || session.chunks.length * 5) / 60)} mins</span>
            <span>👥 {session.participants?.join(', ') || 'Rahul, Eklavya'}</span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline btn-sm magnetic-btn"
            onClick={handleCopySummary}
            title="Copy Executive Summary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy Summary</span>
          </button>
          <button
            className="btn btn-outline btn-sm magnetic-btn"
            onClick={() => handleExport('md')}
            title="Download as Markdown"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Markdown</span>
          </button>
          <button
            className="btn btn-outline btn-sm magnetic-btn"
            onClick={() => handleExport('json')}
            title="Download as JSON"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Two Column Grid: Transcript on Left, Intelligence Hub on Right */}
      <div className="grid-2 gsap-stagger">
        {/* Left: Full Searchable Transcript */}
        <div className="luxury-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              Full Meeting Transcript ({session.chunks.length})
            </h2>
            <input
              type="text"
              value={transcriptSearch}
              onChange={(e) => setTranscriptSearch(e.target.value)}
              placeholder="Search transcript..."
              style={{
                fontSize: '0.78rem',
                padding: '0.3rem 0.65rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-rule)',
                backgroundColor: 'var(--color-paper)',
                outline: 'none',
                width: '180px',
              }}
            />
          </div>

          <div style={{ maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredChunks.length === 0 ? (
              <div className="placeholder-box">No segments match your search.</div>
            ) : (
              filteredChunks.map((chunk) => {
                const isSpeaker1 = !chunk.speakerName || chunk.speakerName === 'Speaker 1';
                return (
                  <div
                    key={`chunk-${chunk.sequenceNumber}`}
                    className="chunk-card"
                    style={{
                      backgroundColor: highlightTimestamp === chunk.timestamp ? 'var(--color-accent-subtle)' : undefined,
                    }}
                  >
                    <div className="chunk-header">
                      <span className={`scribe-speaker-badge ${isSpeaker1 ? 'scribe-speaker-1' : 'scribe-speaker-2'}`}>
                        {chunk.speakerName || 'Speaker 1'}
                      </span>
                      <span
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => setHighlightTimestamp(chunk.timestamp)}
                      >
                        {chunk.timestamp}
                      </span>
                      <span className="chunk-seq">#{chunk.sequenceNumber}</span>
                    </div>
                    <div className="chunk-text">{chunk.text}</div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Annotation / Comment Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddComment(highlightTimestamp || '00:00');
            }}
            style={{ display: 'flex', gap: '0.45rem', marginTop: '0.5rem' }}
          >
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={highlightTimestamp ? `Add note at ${highlightTimestamp}...` : 'Add note to transcript...'}
              className="title-input"
              style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
            />
            <button type="submit" className="btn btn-outline btn-sm magnetic-btn" disabled={!newCommentText.trim()}>
              + Note
            </button>
          </form>
        </div>

        {/* Right: AI Intelligence & Ask Copilot Hub */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Tabs */}
          <div className="tab-strip luxury-card" style={{ padding: '4px', gap: '4px' }}>
            <button
              className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              Summary
            </button>
            <button
              className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
              onClick={() => setActiveTab('actions')}
            >
              Action Items ({session.latestAnalysis?.actionItems?.length || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === 'decisions' ? 'active' : ''}`}
              onClick={() => setActiveTab('decisions')}
            >
              Decisions ({session.latestAnalysis?.decisions?.length || 0})
            </button>
            <button
              className={`tab-btn ${activeTab === 'speakers' ? 'active' : ''}`}
              onClick={() => setActiveTab('speakers')}
            >
              👥 Speakers ({speakerStats.speakers.length})
            </button>
          </div>

          {/* Active Tab Panel */}
          <div className="luxury-card" style={{ padding: '1.25rem' }}>
            {activeTab === 'summary' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                  Executive Discussion Points
                </h3>
                {session.latestAnalysis?.keyPoints && session.latestAnalysis.keyPoints.length > 0 ? (
                  <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {session.latestAnalysis.keyPoints.map((p, idx) => (
                      <li key={idx} className="bullet-item" style={{ fontSize: '0.88rem', color: 'var(--color-ink)' }}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
                    No summarized bullet points recorded for this meeting.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'actions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                  Detected Action Items
                </h3>
                {session.latestAnalysis?.actionItems && session.latestAnalysis.actionItems.length > 0 ? (
                  session.latestAnalysis.actionItems.map((act, idx) => (
                    <div key={idx} className="action-card">
                      <strong>{act.task}</strong>
                      <div className="action-meta">
                        <span>👤 Owner: {act.owner || 'Unassigned'}</span>
                        <span>📅 Due: {act.deadline || 'This week'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
                    No actionable tasks detected in this conversation.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'decisions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                  Agreed Key Decisions
                </h3>
                {session.latestAnalysis?.decisions && session.latestAnalysis.decisions.length > 0 ? (
                  session.latestAnalysis.decisions.map((dec, idx) => (
                    <div key={idx} className="decision-card">
                      <span>✓</span>
                      <div><strong>Decision:</strong> {dec}</div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
                    No explicit decisions logged for this sync.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'speakers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                    Speaker Participation & Airtime
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', marginTop: '0.15rem' }}>
                    Airtime percentage and conversational turn-taking distribution.
                  </p>
                </div>

                {/* Speaker Distribution Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {speakerStats.speakers.map((spk, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>👤 {spk.name}</span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--color-ink-subtle)' }}>({spk.turns} turns · {spk.words} words)</span>
                        </div>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>{spk.percentage}%</strong>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-paper-subtle)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${spk.percentage}%`,
                            height: '100%',
                            backgroundColor: idx === 0 ? 'var(--color-accent)' : 'var(--color-accent-coral)',
                            borderRadius: 'var(--radius-pill)',
                            transition: 'width 0.4s var(--ease-out)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Who Spoke to Whom / Interaction Flow */}
                {speakerStats.transitions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px solid var(--color-rule)', paddingTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-ink)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>🔄</span>
                      <span>Discourse Flow ("Who Spoke to Whom")</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                      {speakerStats.transitions.slice(0, 8).map((t, idx) => (
                        <div
                          key={idx}
                          className="card"
                          style={{
                            padding: '0.65rem 0.85rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--color-paper-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <strong style={{ color: 'var(--color-ink)' }}>{t.from}</strong>
                            <span style={{ color: t.type === 'question' ? 'var(--color-accent)' : 'var(--color-ink-subtle)' }}>
                              {t.type === 'question' ? 'asked ➔' : 'handed off to ➔'}
                            </span>
                            <strong style={{ color: 'var(--color-accent-coral)' }}>{t.to}</strong>
                            <span style={{ color: 'var(--color-ink-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>
                              "{t.snippet}..."
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-ink-subtle)' }}>
                            {t.timestamp}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ask AI Copilot in this Meeting */}
          <div className="luxury-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              Ask Vocalis About This Meeting
            </h3>
            <form onSubmit={handleAsk} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                placeholder={dynamicAskPlaceholder}
                className="title-input"
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button type="submit" className="btn btn-primary btn-sm magnetic-btn" disabled={asking || !askQuery.trim()}>
                {asking ? 'Thinking...' : 'Ask'}
              </button>
            </form>

            {askResponse && (
              <div style={{ backgroundColor: 'var(--color-paper-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-rule)' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-ink)' }}>AI Response:</strong>
                <p style={{ fontSize: '0.86rem', color: 'var(--color-ink-muted)', marginTop: '0.35rem', lineHeight: 1.55 }}>
                  {askResponse.answer}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
