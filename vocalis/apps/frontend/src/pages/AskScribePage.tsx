import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { askScribe } from '../services/apiClient';
import { Citation } from '@meeting-assistant/shared-types';
import { usePageTransition } from '../hooks/useGsapAnimations';
import { Skiper83 } from '../components/ui/skiper-ui/skiper83';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  timestamp: string;
}

export const AskScribePage: React.FC = () => {
  const { navigate } = useRouter();
  const containerRef = usePageTransition();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'assistant',
      text: 'Hello! I am Vocalis, your meeting intelligence assistant. Ask me anything about your past meetings, decisions, or assigned tasks across all sessions.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSend = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await askScribe(queryText);
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: res.answer,
        citations: res.citations,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue retrieving memories. Please ensure the backend server is reachable.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '900px', margin: '0 auto', height: 'calc(100vh - 140px)' }}>
      {/* Header */}
      <div className="gsap-stagger">
        <div className="brand-badge">
          <span className="pill">Global Meeting AI</span>
          <span>· Grounded Citations</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)' }}>
          Ask Vocalis Assistant
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
          Conversational reasoning grounded in your complete meeting transcripts and indexed semantic memory.
        </p>
      </div>

      {/* Chat Messages Log */}
      <div
        className="gsap-stagger"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          paddingRight: '0.5rem',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: msg.sender === 'user' ? '80%' : '90%',
              gap: '0.35rem',
            }}
          >
            <div
              className={msg.sender === 'user' ? '' : 'luxury-card'}
              style={{
                backgroundColor: msg.sender === 'user' ? 'var(--color-ink)' : 'var(--color-paper-card)',
                color: msg.sender === 'user' ? '#ffffff' : 'var(--color-ink)',
                borderRadius: 'var(--radius-lg)',
                padding: '1rem 1.25rem',
                lineHeight: 1.6,
                fontSize: '0.92rem',
              }}
            >
              {msg.text}
            </div>

            {/* Citations Footer */}
            {msg.citations && msg.citations.length > 0 && (() => {
              // Deduplicate citations by meetingId + timestamp + snippet
              const uniqueCitations = msg.citations.filter(
                (c, i, arr) =>
                  arr.findIndex(
                    (other) =>
                      other.meetingId === c.meetingId &&
                      other.timestamp === c.timestamp &&
                      other.snippet === c.snippet
                  ) === i
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.45rem' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}>
                    Grounded Sources ({uniqueCitations.length})
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {uniqueCitations.map((c, idx) => (
                      <div
                        key={idx}
                        onClick={() => c.meetingId && c.meetingId !== 'global' && navigate(`/meetings/${c.meetingId}`)}
                        className="luxury-card"
                        title={c.snippet ? `"${c.snippet}"` : undefined}
                        style={{
                          padding: '0.45rem 0.75rem',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--color-rule)',
                          backgroundColor: 'var(--color-paper-card)',
                          boxShadow: 'var(--shadow-subtle)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ color: 'var(--color-accent)' }}>📍</span>
                        <strong style={{ color: 'var(--color-ink)' }}>{c.meetingTitle || 'Meeting'}</strong>
                        {c.speakerName && (
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-paper-subtle)',
                            color: 'var(--color-ink-muted)',
                            fontWeight: 600,
                          }}>
                            👤 {c.speakerName.replace(/\s*\(You\)/i, '')}
                          </span>
                        )}
                        {c.timestamp && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', color: 'var(--color-ink-subtle)' }}>
                            ⏱️ {c.timestamp}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-ink-muted)', fontSize: '0.88rem' }}>
            <span className="recording-pulse" />
            <span>Vocalis is reading meeting memories and synthesizing answer...</span>
          </div>
        )}
      </div>

      {/* Skiper83 AI Input */}
      <div className="gsap-stagger">
        <Skiper83
          onSend={(msg) => handleSend(msg)}
          isLoading={loading}
          placeholder="Ask anything about meetings, tasks, or decisions... Type '@' to scope context"
        />
      </div>
    </div>
  );
};

