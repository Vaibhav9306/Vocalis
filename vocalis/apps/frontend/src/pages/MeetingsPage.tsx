import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { fetchSessions, deleteSession, updateSession } from '../services/apiClient';
import { LiveMeetingSession } from '@meeting-assistant/shared-types';

import { ConfirmModal } from '../components/ConfirmModal';

export const MeetingsPage: React.FC = () => {
  const [meetings, setMeetings] = useState<LiveMeetingSession[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'recent'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState<boolean>(true);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);

  const { navigate } = useRouter();
  const { showToast } = useToast();

  const loadMeetings = () => {
    setLoading(true);
    fetchSessions().then((res) => {
      if (res.data) setMeetings(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleToggleFavorite = async (e: React.MouseEvent, meeting: LiveMeetingSession) => {
    e.stopPropagation();
    const updated = await updateSession(meeting.id, { isFavorite: !meeting.isFavorite });
    if (updated.data) {
      setMeetings((prev) => prev.map((m) => (m.id === meeting.id ? updated.data! : m)));
      showToast(meeting.isFavorite ? 'Removed from favorites' : 'Marked as favorite', '', 'info');
    }
  };

  const handleConfirmDelete = async () => {
    if (!meetingToDelete) return;
    const meetingId = meetingToDelete;
    const res = await deleteSession(meetingId);
    if (res.success) {
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
      showToast('Meeting record & associated memories deleted', '', 'success');
    } else {
      showToast('Failed to delete meeting', res.error, 'error');
    }
    setMeetingToDelete(null);
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.accumulatedTranscript.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeFilter === 'favorites') return matchesSearch && m.isFavorite;
    return matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)' }}>
            Meetings Library
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
            Search, filter, and review transcripts and extracted intelligence from your meetings.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/live')}
        >
          🎙️ Start Live Meeting
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          backgroundColor: 'var(--color-paper-card)',
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.85rem 1.15rem',
        }}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
          <span>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings by title, transcript, or topic..."
            className="title-input"
            style={{ border: 'none', background: 'transparent' }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${activeFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveFilter('all')}
          >
            All ({meetings.length})
          </button>
          <button
            className={`btn btn-sm ${activeFilter === 'favorites' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveFilter('favorites')}
          >
            ★ Favorites ({meetings.filter((m) => m.isFavorite).length})
          </button>
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: '0.25rem', borderLeft: '1px solid var(--color-rule)', paddingLeft: '0.75rem' }}>
          <button
            className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            ☰
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            ☷
          </button>
        </div>
      </div>

      {/* Meetings Grid / List */}
      {loading ? (
        <div className="placeholder-box">Loading meetings library...</div>
      ) : filteredMeetings.length === 0 ? (
        <div className="placeholder-box">
          <p>No meetings match your query.</p>
          <button className="btn btn-outline btn-sm" onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}>
            Reset Filters
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
            gap: '1rem',
          }}
        >
          {filteredMeetings.map((meeting) => (
            <div
              key={meeting.id}
              className="card"
              onClick={() => navigate(`/meetings/${meeting.id}`)}
              style={{
                cursor: 'pointer',
                padding: '1.25rem',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                    {meeting.title}
                  </h3>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
                    {new Date(meeting.startedAt).toLocaleDateString()} · {Math.round((meeting.durationSeconds || meeting.chunks.length * 5) / 60)} mins · {meeting.chunks.length} segments
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    onClick={(e) => handleToggleFavorite(e, meeting)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: meeting.isFavorite ? 'var(--color-accent)' : 'var(--color-ink-subtle)' }}
                    title={meeting.isFavorite ? 'Remove from favorites' : 'Star meeting'}
                  >
                    ★
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMeetingToDelete(meeting.id);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-ink-subtle)' }}
                    title="Delete meeting"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <p
                style={{
                  fontSize: '0.86rem',
                  color: 'var(--color-ink-muted)',
                  lineHeight: 1.55,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {meeting.latestAnalysis?.keyPoints?.[0] || meeting.accumulatedTranscript || 'No transcript available.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-rule)', paddingTop: '0.65rem' }}>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {meeting.tags?.map((t) => (
                    <span key={t} className="badge-tag">
                      #{t}
                    </span>
                  ))}
                  {meeting.latestAnalysis?.decisions && meeting.latestAnalysis.decisions.length > 0 && (
                    <span className="badge-tag" style={{ color: 'var(--color-success)' }}>
                      {meeting.latestAnalysis.decisions.length} decisions
                    </span>
                  )}
                </div>

                <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', fontWeight: 600 }}>
                  Inspect Meeting →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(meetingToDelete)}
        title="Delete Meeting Record?"
        message="Are you sure you want to permanently delete this meeting and its associated memories? This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setMeetingToDelete(null)}
      />
    </div>
  );
};
