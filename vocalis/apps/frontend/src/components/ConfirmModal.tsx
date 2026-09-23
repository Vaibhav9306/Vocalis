import React, { useEffect } from 'react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Yes, Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onClose,
}) => {
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

  const getConfirmButtonClass = () => {
    if (variant === 'danger') return 'btn btn-danger';
    if (variant === 'warning') return 'btn btn-warning';
    return 'btn btn-primary';
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(20, 18, 16, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'pageFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={onClose}
    >
      <div
        className="luxury-card"
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--color-paper-card)',
          border: '1px solid var(--color-rule)',
          borderRadius: '20px',
          boxShadow: 'var(--shadow-elevated)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          transform: 'scale(1)',
          transition: 'transform 0.2s var(--ease-out)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Icon */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: variant === 'danger' ? 'var(--color-danger-bg)' : 'var(--color-accent-subtle)',
              color: variant === 'danger' ? 'var(--color-danger)' : 'var(--color-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '1.2rem',
            }}
          >
            {variant === 'danger' ? '⚠️' : '❓'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0, lineHeight: 1.3 }}>
              {title}
            </h3>
            <p style={{ fontSize: '0.86rem', color: 'var(--color-ink-muted)', lineHeight: 1.5, margin: 0 }}>
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', borderTop: '1px solid var(--color-rule)', paddingTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            style={{ fontSize: '0.84rem', padding: '0.45rem 1rem', borderRadius: 'var(--radius-pill)' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={getConfirmButtonClass()}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{ fontSize: '0.84rem', padding: '0.45rem 1.15rem', borderRadius: 'var(--radius-pill)', fontWeight: 600 }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
