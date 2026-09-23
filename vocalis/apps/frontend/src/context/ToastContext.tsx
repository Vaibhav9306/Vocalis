import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (title: string, message?: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((title: string, message?: string, type: Toast['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: Toast = { id, title, message, type };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 3800);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast Render Overlay */}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          pointerEvents: 'none',
          maxWidth: '380px',
          width: '100%',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              backgroundColor: 'var(--color-paper-card)',
              border: '1px solid var(--color-rule-focus)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              boxShadow: 'var(--shadow-elevated)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              animation: 'chunkReveal 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠' : toast.type === 'warning' ? '⚡' : 'ℹ'}
            </span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              <strong style={{ fontSize: '0.86rem', color: 'var(--color-ink)' }}>{toast.title}</strong>
              {toast.message && (
                <span style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)' }}>{toast.message}</span>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-ink-subtle)',
                fontSize: '0.85rem',
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
