import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { fetchSessions } from '../services/apiClient';
import { LiveMeetingSession } from '@meeting-assistant/shared-types';

interface ScheduledEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  participants: string;
}

const STORAGE_KEY = 'Vocalis_scheduled_events';

export const CalendarPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pastSessions, setPastSessions] = useState<LiveMeetingSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isScheduling, setIsScheduling] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('');
  const [newParticipants, setNewParticipants] = useState<string>('');

  useEffect(() => {
    fetchSessions().then((res) => {
      if (res.data) setPastSessions(res.data);
      setLoading(false);
    });
  }, []);

  const saveEvents = (events: ScheduledEvent[]) => {
    setScheduledEvents(events);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch {}
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const event: ScheduledEvent = {
      id: `sched-${Date.now()}`,
      title: newTitle.trim(),
      date: newDate || new Date().toISOString().split('T')[0],
      time: newTime || '10:00 AM',
      participants: newParticipants.trim() || 'You (Host)',
    };

    const updated = [...scheduledEvents, event];
    saveEvents(updated);
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewParticipants('');
    setIsScheduling(false);
    showToast('Meeting scheduled successfully', '', 'success');
  };

  const handleDeleteEvent = (id: string) => {
    const updated = scheduledEvents.filter((e) => e.id !== id);
    saveEvents(updated);
    showToast('Event removed', '', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="brand-badge">
            <span className="pill">Meeting Schedule</span>
            <span>· Live Calendar & History</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', marginTop: '0.25rem' }}>
            Calendar & Meeting Timeline
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
            Schedule upcoming syncs or start instant P2P transcription sessions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-outline"
            onClick={() => setIsScheduling(!isScheduling)}
          >
            {isScheduling ? 'Cancel' : '📅 + Schedule Meeting'}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/live')}
          >
            🎙️ Start Live Meeting
          </button>
        </div>
      </div>

      {/* Schedule Form Modal/Card */}
      {isScheduling && (
        <div className="card" style={{ padding: '1.5rem', animation: 'pageFadeIn 0.2s ease-out' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', marginBottom: '0.75rem' }}>
            Schedule New Meeting
          </h2>
          <form onSubmit={handleSchedule} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Meeting Title</label>
              <input
                type="text"
                placeholder="e.g. Architecture Sync"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="title-input"
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="title-input"
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Time</label>
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="title-input"
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>Participants</label>
              <input
                type="text"
                placeholder="e.g. Rahul, Alex, Sarah"
                value={newParticipants}
                onChange={(e) => setNewParticipants(e.target.value)}
                className="title-input"
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-outline" onClick={() => setIsScheduling(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Confirm & Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming Scheduled Meetings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem' }}>Upcoming Scheduled Syncs ({scheduledEvents.length})</h2>
        {scheduledEvents.length === 0 ? (
          <div className="placeholder-box">
            <p>No upcoming meetings scheduled.</p>
            <button className="btn btn-outline btn-sm" onClick={() => setIsScheduling(true)}>
              Schedule a meeting
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {scheduledEvents.map((evt) => (
              <div
                key={evt.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="status-dot checking" />
                    <strong style={{ fontSize: '1rem', color: 'var(--color-ink)' }}>{evt.title}</strong>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
                    📅 {evt.date} · ⏰ {evt.time} · 👥 {evt.participants}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleDeleteEvent(evt.id)}
                  >
                    Delete
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate('/live')}
                  >
                    🎙️ Start Session →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Recorded Sessions Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem' }}>Past Meetings Timeline ({pastSessions.length})</h2>
        {loading ? (
          <div className="placeholder-box">Loading meeting history...</div>
        ) : pastSessions.length === 0 ? (
          <div className="placeholder-box">
            <p>No past meetings in memory database.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {pastSessions.map((session) => (
              <div
                key={session.id}
                className="card"
                style={{
                  padding: '1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/meetings/${session.id}`)}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="status-dot connected" />
                    <strong style={{ fontSize: '0.98rem', color: 'var(--color-ink)' }}>{session.title}</strong>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
                    📅 {new Date(session.startedAt).toLocaleString()} · {Math.round((session.durationSeconds || session.chunks.length * 5) / 60)} minutes · {session.chunks.length} segments
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge-tag">{session.savedMemoriesCount} memories</span>
                  <button className="btn btn-outline btn-sm">
                    View Intelligence →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
