import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { fetchDecisions, updateDecisionStatus } from '../services/apiClient';
import { DecisionItem, DecisionStatus } from '@meeting-assistant/shared-types';

export const DecisionsPage: React.FC = () => {
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'superseded'>('all');

  const { navigate } = useRouter();
  const { showToast } = useToast();

  const loadDecisions = () => {
    setLoading(true);
    fetchDecisions().then((res) => {
      if (res.data) setDecisions(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadDecisions();
  }, []);

  const handleToggleStatus = async (decisionId: string, currentStatus: DecisionStatus) => {
    const newStatus: DecisionStatus = currentStatus === 'active' ? 'superseded' : 'active';
    const success = await updateDecisionStatus(decisionId, newStatus);
    if (success) {
      setDecisions((prev) =>
        prev.map((d) => (d.id === decisionId ? { ...d, status: newStatus } : d))
      );
      showToast(`Decision marked as ${newStatus}`, '', 'info');
    }
  };

  const filteredDecisions = decisions.filter((d) => {
    if (filter === 'all') return true;
    return d.status === filter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)' }}>
            Decisions Log
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
            Chronological register of all strategic and technical agreements made across team meetings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('all')}
          >
            All ({decisions.length})
          </button>
          <button
            className={`btn btn-sm ${filter === 'active' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('active')}
          >
            Active ({decisions.filter((d) => d.status === 'active').length})
          </button>
          <button
            className={`btn btn-sm ${filter === 'superseded' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter('superseded')}
          >
            Superseded ({decisions.filter((d) => d.status === 'superseded').length})
          </button>
        </div>
      </div>

      {/* Decisions List */}
      {loading ? (
        <div className="placeholder-box">Loading decisions log...</div>
      ) : filteredDecisions.length === 0 ? (
        <div className="placeholder-box">No decisions found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {filteredDecisions.map((item) => (
            <div
              key={item.id}
              className="card"
              style={{
                padding: '1.25rem',
                gap: '0.65rem',
                opacity: item.status === 'superseded' ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={{ color: item.status === 'active' ? 'var(--color-success)' : 'var(--color-ink-subtle)', fontSize: '1.1rem' }}>
                    {item.status === 'active' ? '✓' : '⊘'}
                  </span>
                  <strong style={{ fontSize: '1rem', color: 'var(--color-ink)' }}>
                    {item.decision}
                  </strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: item.status === 'active' ? 'var(--color-success-bg)' : 'var(--color-paper-subtle)',
                      color: item.status === 'active' ? 'var(--color-success)' : 'var(--color-ink-subtle)',
                      fontWeight: 600,
                    }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() => handleToggleStatus(item.id, item.status)}
                  >
                    {item.status === 'active' ? 'Mark Superseded' : 'Mark Active'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-rule)', paddingTop: '0.5rem', fontSize: '0.78rem', color: 'var(--color-ink-muted)' }}>
                <span>
                  Meeting: <strong onClick={() => navigate(`/meetings/${item.meetingId}`)} style={{ color: 'var(--color-accent)', cursor: 'pointer' }}>{item.meetingTitle} ↗</strong>
                </span>
                <span>Participants: {item.participants?.join(', ') || 'Rahul, Eklavya'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
