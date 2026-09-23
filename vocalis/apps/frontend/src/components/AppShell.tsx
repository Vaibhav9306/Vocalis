import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { fetchTasks, fetchSessions } from '../services/apiClient';
import { CommandPalette } from './CommandPalette';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ThemeToggle } from './ThemeToggle';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { currentPath, navigate } = useRouter();
  const { user, logout } = useAuth();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

  // Live meeting cross-window sync indicator
  const [liveSnapshot, setLiveSnapshot] = useState<{ isStreaming: boolean; durationSeconds: number; title?: string } | null>(() => {
    try {
      const raw = localStorage.getItem('vocalis_live_meeting_snapshot');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.isStreaming && Date.now() - (parsed.updatedAt || 0) < 180000) {
          return { isStreaming: true, durationSeconds: parsed.durationSeconds || 0, title: parsed.session?.title || 'Live Meeting' };
        }
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'vocalis_live_meeting_snapshot') {
        try {
          if (e.newValue) {
            const parsed = JSON.parse(e.newValue);
            if (parsed.isStreaming) {
              setLiveSnapshot({ isStreaming: true, durationSeconds: parsed.durationSeconds || 0, title: parsed.session?.title || 'Live Meeting' });
            } else {
              setLiveSnapshot(null);
            }
          } else {
            setLiveSnapshot(null);
          }
        } catch {
          setLiveSnapshot(null);
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('vocalis_live_stream_sync');
      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === 'STREAM_SNAPSHOT') {
          if (payload?.isStreaming) {
            setLiveSnapshot({ isStreaming: true, durationSeconds: payload.durationSeconds || 0, title: payload.session?.title || 'Live Meeting' });
          } else {
            setLiveSnapshot(null);
          }
        }
      };
    }

    const timer = setInterval(() => {
      try {
        const raw = localStorage.getItem('vocalis_live_meeting_snapshot');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.isStreaming && Date.now() - (parsed.updatedAt || 0) < 180000) {
            setLiveSnapshot((prev) => ({
              isStreaming: true,
              durationSeconds: parsed.durationSeconds || (prev ? prev.durationSeconds + 1 : 0),
              title: parsed.session?.title || 'Live Meeting',
            }));
          } else {
            setLiveSnapshot(null);
          }
        } else {
          setLiveSnapshot(null);
        }
      } catch {}
    }, 1000);

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(timer);
      if (channel) channel.close();
    };
  }, []);

  const formatTimer = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Global Keyboard Listener for Cmd+K and Cmd+/
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      label: 'Live Session',
      path: '/live',
      badge: liveSnapshot?.isStreaming ? `REC ${formatTimer(liveSnapshot.durationSeconds)}` : 'Live',
      isLiveActive: Boolean(liveSnapshot?.isStreaming),
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      ),
    },
    {
      label: 'Meetings',
      path: '/meetings',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: 'Ask Vocalis',
      path: '/ask',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
      ),
    },
    {
      label: 'Tasks & Actions',
      path: '/tasks',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      label: 'Mesh Rooms',
      path: '/rooms',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      ),
    },
  ];

  const secondaryNavItems = [
    {
      label: 'Settings',
      path: '/settings/profile',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  const getReadNotifIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem('vocalis_read_notifications');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  };

  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; desc: string; time: string }>>([]);

  const handleMarkAllRead = () => {
    const currentIds = notifications.map((n) => n.id);
    const existing = getReadNotifIds();
    currentIds.forEach((id) => existing.add(id));
    try {
      localStorage.setItem('vocalis_read_notifications', JSON.stringify(Array.from(existing)));
    } catch {}
    setNotifications([]);
  };

  useEffect(() => {
    Promise.all([fetchTasks(), fetchSessions()]).then(([tasksRes, sessionsRes]) => {
      const readIds = getReadNotifIds();
      const notifs: Array<{ id: string; title: string; desc: string; time: string }> = [];
      if (tasksRes.data && tasksRes.data.length > 0) {
        const pending = tasksRes.data.filter((t) => t.status !== 'done').slice(0, 3);
        pending.forEach((t) => {
          const id = `task-${t.id}`;
          if (!readIds.has(id)) {
            notifs.push({
              id,
              title: `Task Pending: ${t.assignee}`,
              desc: t.task,
              time: t.dueDate ? `Due ${t.dueDate}` : 'Active',
            });
          }
        });
      }
      if (sessionsRes.data && sessionsRes.data.length > 0) {
        const latest = sessionsRes.data[0];
        const id = `session-${latest.id}`;
        if (!readIds.has(id)) {
          notifs.push({
            id,
            title: 'Meeting Indexed',
            desc: `${latest.title} (${latest.chunks.length} transcript segments)`,
            time: new Date(latest.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }
      setNotifications(notifs);
    }).catch(() => {});
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-paper)' }}>
      {/* Desktop Sidebar */}
      <aside
        style={{
          width: '240px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-paper-subtle)',
          borderRight: '1px solid var(--color-rule)',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem 0.85rem',
          flexShrink: 0,
          zIndex: 40,
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
        className="app-sidebar-desktop"
      >
        {/* Brand Logo & Workspace Switcher */}
        <div style={{ padding: '0 0.5rem 1.25rem 0.5rem', borderBottom: '1px solid var(--color-rule)', marginBottom: '1rem' }}>
          <div
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '11px',
                backgroundColor: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                flexShrink: 0,
              }}
            >
              <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', fill: '#ffffff' }}>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', color: 'var(--color-ink)', lineHeight: 1.1 }}>
                Vocalis
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
                Private AI Memory
              </div>
            </div>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
          <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-ink-subtle)', padding: '0 0.6rem 0.25rem 0.6rem' }}>
            Main
          </div>
          {navItems.map((item) => {
            const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.48rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--color-paper-card)' : 'transparent',
                  color: isActive ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isActive ? 'var(--shadow-subtle)' : 'none',
                  borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      backgroundColor: item.isLiveActive ? 'rgba(220, 38, 38, 0.15)' : 'var(--color-accent-subtle)',
                      color: item.isLiveActive ? 'var(--color-danger)' : 'var(--color-accent)',
                      border: item.isLiveActive ? '1px solid var(--color-danger)' : 'none',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 'var(--radius-pill)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      animation: item.isLiveActive ? 'pulse 1.5s infinite' : 'none',
                    }}
                  >
                    {item.isLiveActive && (
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
                    )}
                    <span>{item.badge}</span>
                  </span>
                )}
              </button>
            );
          })}

          <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-ink-subtle)', padding: '0.85rem 0.6rem 0.25rem 0.6rem' }}>
            Settings & Admin
          </div>
          {secondaryNavItems.map((item) => {
            const isActive = currentPath.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.48rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--color-paper-card)' : 'transparent',
                  color: isActive ? 'var(--color-ink)' : 'var(--color-ink-muted)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div style={{ borderTop: '1px solid var(--color-rule)', paddingTop: '0.85rem', position: 'relative' }}>
          <div
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.4rem 0.5rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-rule-focus)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--color-ink)',
              }}
            >
              {user?.name?.[0] || 'U'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-ink-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.email || 'user@Vocalis.ai'}
              </div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-subtle)' }}>⋯</span>
          </div>

          {/* User Popover Menu */}
          {isUserMenuOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '0.5rem',
                right: '0.5rem',
                backgroundColor: 'var(--color-paper-card)',
                border: '1px solid var(--color-rule-focus)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-elevated)',
                padding: '0.4rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                zIndex: 100,
              }}
            >
              <button
                onClick={() => { navigate('/settings/profile'); setIsUserMenuOpen(false); }}
                style={{ padding: '0.45rem 0.65rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.82rem', cursor: 'pointer', borderRadius: '4px' }}
              >
                Profile & Account
              </button>
              <button
                onClick={() => { navigate('/pricing'); setIsUserMenuOpen(false); }}
                style={{ padding: '0.45rem 0.65rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.82rem', cursor: 'pointer', borderRadius: '4px' }}
              >
                Upgrade to Pro (SaaS)
              </button>
              <button
                onClick={() => { setIsShortcutsModalOpen(true); setIsUserMenuOpen(false); }}
                style={{ padding: '0.45rem 0.65rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.82rem', cursor: 'pointer', borderRadius: '4px' }}
              >
                Keyboard Shortcuts (⌘/)
              </button>
              <div style={{ borderTop: '1px solid var(--color-rule)', margin: '0.2rem 0' }} />
              <button
                onClick={() => { logout(); navigate('/login'); setIsUserMenuOpen(false); }}
                style={{ padding: '0.45rem 0.65rem', textAlign: 'left', background: 'none', border: 'none', fontSize: '0.82rem', color: 'var(--color-danger)', cursor: 'pointer', borderRadius: '4px' }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          style={{
            height: '60px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            borderBottom: '1px solid var(--color-rule)',
            backgroundColor: 'var(--color-paper-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.5rem',
            gap: '1rem',
          }}
        >
          {/* Breadcrumb & Command Palette Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.75rem',
                backgroundColor: 'var(--color-paper-subtle)',
                border: '1px solid var(--color-rule)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-ink-muted)',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              <span>🔍</span>
              <span>Search or jump to...</span>
              <kbd
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: 'var(--color-paper-card)',
                  border: '1px solid var(--color-rule)',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '3px',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Header Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Theme Toggle Button (Skiper UI 26) */}
            <ThemeToggle />

            {/* Notifications Popover Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--color-paper-subtle)',
                  border: '1px solid var(--color-rule)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.95rem',
                  position: 'relative',
                  transition: 'background-color 0.15s ease',
                }}
                title="Notifications"
              >
                🔔
                {notifications.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-accent)',
                    }}
                  />
                )}
              </button>

              {/* Notifications Dropdown */}
              {isNotificationsOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    width: '320px',
                    backgroundColor: 'var(--color-paper-card)',
                    border: '1px solid var(--color-rule-focus)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-elevated)',
                    padding: '0.85rem',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.45rem' }}>
                    <strong style={{ fontSize: '0.86rem', color: 'var(--color-ink)' }}>Notifications</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-accent)', cursor: 'pointer' }} onClick={handleMarkAllRead}>
                      Mark all read
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', padding: '0.75rem 0.25rem', textAlign: 'center' }}>
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} style={{ padding: '0.45rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-paper-subtle)' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-ink)' }}>{n.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-ink-muted)' }}>{n.desc}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--color-ink-subtle)', marginTop: '0.2rem' }}>{n.time}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Start Live Meeting or Return to Live Meeting Action */}
            {liveSnapshot?.isStreaming ? (
              <button
                className="btn btn-sm"
                onClick={() => navigate('/live')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.84rem',
                  backgroundColor: 'rgba(220, 38, 38, 0.12)',
                  color: 'var(--color-danger)',
                  border: '1px solid var(--color-danger)',
                  boxShadow: '0 0 12px rgba(220, 38, 38, 0.25)',
                  cursor: 'pointer',
                }}
                title="Active live meeting in progress. Click to view stream."
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-danger)',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
                <span>REC {formatTimer(liveSnapshot.durationSeconds)} · View Live Stream →</span>
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/live')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 1rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                }}
              >
                <span>Start Meeting</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content Body */}
        <main style={{ flex: 1, padding: '1.75rem 2rem 5rem 2rem', maxWidth: '1440px', width: '100%', margin: '0 auto' }}>
          {children}
        </main>
      </div>

      {/* Global Command Palette & Shortcuts Modal */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
      <KeyboardShortcutsModal isOpen={isShortcutsModalOpen} onClose={() => setIsShortcutsModalOpen(false)} />
    </div>
  );
};
