import React, { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: '⌘ + K / Ctrl + K', description: 'Open global command palette & search' },
    { key: '⌘ + / / Ctrl + /', description: 'Show keyboard shortcuts cheat sheet' },
    { key: 'Space', description: 'Pause or resume microphone during live session' },
    { key: 'Esc', description: 'Close modals, drawers, and command palette' },
    { key: 'Tab', description: 'Cycle through interactive controls and tabs' },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(31, 27, 22, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'pageFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--color-paper-card)',
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-elevated)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.75rem' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-ink)' }}>
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--color-ink-muted)' }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {shortcuts.map((sc, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.86rem', color: 'var(--color-ink)' }}>{sc.description}</span>
              <kbd
                style={{
                  padding: '0.25rem 0.55rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-paper-subtle)',
                  border: '1px solid var(--color-rule)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-ink)',
                }}
              >
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--color-ink-subtle)', paddingTop: '0.5rem', borderTop: '1px solid var(--color-rule)' }}>
          Press <kbd style={{ fontFamily: 'var(--font-mono)' }}>Esc</kbd> anytime to dismiss
        </div>
      </div>
    </div>
  );
};
