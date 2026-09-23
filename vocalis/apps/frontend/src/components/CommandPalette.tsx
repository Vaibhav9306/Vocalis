import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { fetchSessions } from '../services/apiClient';
import { LiveMeetingSession } from '@meeting-assistant/shared-types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState<string>('');
  const [meetings, setMeetings] = useState<LiveMeetingSession[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { navigate } = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      fetchSessions().then((res) => {
        if (res.data) setMeetings(res.data);
      });
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickActions = [
    { id: 'start-live', title: 'Start Live Meeting', icon: '🎙️', action: () => { navigate('/live'); onClose(); showToast('Live Meeting Started'); } },
    { id: 'join-room', title: 'Join Mesh Room', icon: '🔒', action: () => { navigate('/rooms'); onClose(); } },
    { id: 'ask-vocalis', title: 'Ask Vocalis AI Assistant', icon: '✨', action: () => { navigate('/ask'); onClose(); } },
    { id: 'view-tasks', title: 'Open Action Items Board', icon: '✓', action: () => { navigate('/tasks'); onClose(); } },
    { id: 'view-settings', title: 'Workspace Settings & Privacy', icon: '⚙️', action: () => { navigate('/settings/profile'); onClose(); } },
  ];

  const filteredActions = quickActions.filter((a) =>
    a.title.toLowerCase().includes(query.toLowerCase())
  );

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(query.toLowerCase()) ||
    m.accumulatedTranscript.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(31, 27, 22, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'pageFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: 'var(--color-paper-card)',
          border: '1px solid var(--color-rule-focus)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.85rem 1.15rem',
            borderBottom: '1px solid var(--color-rule)',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '1.1rem', color: 'var(--color-ink-muted)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, meeting title, or search memory..."
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.95rem',
              color: 'var(--color-ink)',
            }}
          />
          <kbd
            style={{
              padding: '0.2rem 0.45rem',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-paper-subtle)',
              border: '1px solid var(--color-rule)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--color-ink-subtle)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.5rem' }}>
          {/* Quick Actions */}
          <div style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
            Commands & Navigation
          </div>
          {filteredActions.map((act) => (
            <div
              key={act.id}
              onClick={act.action}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.88rem',
                color: 'var(--color-ink)',
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span>{act.icon}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{act.title}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>Jump</span>
            </div>
          ))}

          {/* Meetings Search Matches */}
          {filteredMeetings.length > 0 && (
            <>
              <div style={{ padding: '0.65rem 0.65rem 0.35rem 0.65rem', fontSize: '0.72rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
                Matching Meetings ({filteredMeetings.length})
              </div>
              {filteredMeetings.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    navigate(`/meetings/${m.id}`);
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '0.86rem',
                    color: 'var(--color-ink)',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-paper-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontWeight: 600 }}>{m.title}</strong>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
                      {new Date(m.startedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.accumulatedTranscript || 'No transcript recorded'}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
