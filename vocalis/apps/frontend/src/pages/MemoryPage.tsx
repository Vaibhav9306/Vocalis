import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { searchMemories, fetchMemories, fetchSessions, deleteMemory } from '../services/apiClient';
import { MemoryRecordDTO, MemorySearchResult } from '@meeting-assistant/shared-types';
import { ConfirmModal } from '../components/ConfirmModal';

export const MemoryPage: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [memories, setMemories] = useState<MemoryRecordDTO[]>([]);
  const [searchResults, setSearchResults] = useState<MemorySearchResult[] | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'relevance'>('recent');
  const [loading, setLoading] = useState<boolean>(true);
  const [memoryToDelete, setMemoryToDelete] = useState<MemoryRecordDTO | null>(null);

  const { navigate } = useRouter();
  const { showToast } = useToast();

  const loadAllMemories = async () => {
    setLoading(true);
    try {
      const [memRes, sessRes] = await Promise.all([fetchMemories(), fetchSessions()]);
      const sessionMap = new Map((sessRes.data || []).map((s) => [s.id, s]));

      if (memRes.data) {
        // Enrich memories with session meeting date if available and sort by meeting date descending
        const enriched = memRes.data.map((m: any) => {
          const matchedSession = m.meetingId ? sessionMap.get(m.meetingId) : null;
          const meetingDate = matchedSession?.startedAt || m.createdAt || m.created_at;
          return {
            ...m,
            meetingDate,
            meetingTitle: m.meetingTitle || matchedSession?.title || 'Meeting Session',
          };
        });

        // Sort based on when meeting was conducted (most recent on top)
        enriched.sort((a: any, b: any) => {
          const timeA = new Date(a.meetingDate || a.createdAt || 0).getTime();
          const timeB = new Date(b.meetingDate || b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        setMemories(enriched);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMemories();
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) {
      setSearchResults(null);
      setSortBy('recent');
      return;
    }

    setLoading(true);
    try {
      const res = await searchMemories(query.trim(), 25);
      if (res.data) {
        setSearchResults(res.data);
        setSortBy('relevance');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleResetSearch = () => {
    setQuery('');
    setSearchResults(null);
    setSortBy('recent');
  };

  const handleConfirmDeleteMemory = async () => {
    if (!memoryToDelete) return;
    const targetId = memoryToDelete.id;
    try {
      const res = await deleteMemory(targetId);
      if (res.success) {
        setMemories((prev) => prev.filter((m) => m.id !== targetId));
        if (searchResults) {
          setSearchResults((prev) => prev ? prev.filter((r) => r.memory.id !== targetId) : null);
        }
        showToast('Memory deleted from vault', '', 'success');
      } else {
        showToast(res.error || 'Failed to delete memory', '', 'error');
      }
    } catch {
      showToast('Error deleting memory', '', 'error');
    } finally {
      setMemoryToDelete(null);
    }
  };

  // Determine items to display
  const displayItems = React.useMemo(() => {
    if (searchResults && searchResults.length > 0) {
      if (sortBy === 'recent') {
        return [...searchResults].sort((a, b) => {
          const timeA = new Date((a.memory as any).meetingDate || a.memory.createdAt || 0).getTime();
          const timeB = new Date((b.memory as any).meetingDate || b.memory.createdAt || 0).getTime();
          return timeB - timeA;
        });
      }
      return searchResults;
    }

    // Default: all memories sorted by recent meeting date
    return memories.map((m) => ({
      memory: m,
      similarity: 1.0,
    }));
  }, [searchResults, memories, sortBy]);

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'Recent';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Private Memory Vault
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
            · {memories.length} indexed memories
          </span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', marginTop: '0.2rem', fontWeight: 700 }}>
          Meeting Memory Bank
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)', marginTop: '0.25rem' }}>
          Chronologically indexed meeting decisions, strategic discussion points, and key deliverables stored in your private on-device vault.
        </p>
      </div>

      {/* Search Input Bar */}
      <form
        onSubmit={handleSearch}
        className="luxury-card"
        style={{
          display: 'flex',
          gap: '0.75rem',
          backgroundColor: 'var(--color-paper-card)',
          border: '1px solid var(--color-rule)',
          borderRadius: '16px',
          padding: '0.75rem 1rem',
        }}
      >
        <span style={{ fontSize: '1.1rem', color: 'var(--color-ink-muted)', display: 'flex', alignItems: 'center' }}>🔍</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memories across past meetings..."
          className="title-input"
          style={{ border: 'none', background: 'transparent', flex: 1, fontSize: '0.88rem' }}
        />
        {query && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleResetSearch}
            style={{ fontSize: '0.78rem' }}
          >
            Clear
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
          {loading ? 'Searching...' : 'Search Memories'}
        </button>
      </form>

      {/* Sorting & Filter Strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', fontWeight: 600 }}>Sort by:</span>
          <button
            className={`btn btn-sm ${sortBy === 'recent' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSortBy('recent')}
            style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-pill)' }}
          >
            📅 Most Recent Meeting
          </button>
          {searchResults && (
            <button
              className={`btn btn-sm ${sortBy === 'relevance' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSortBy('relevance')}
              style={{ fontSize: '0.76rem', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-pill)' }}
            >
              ✨ Semantic Match
            </button>
          )}
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
          Showing {displayItems.length} memories
        </span>
      </div>

      {/* Results List */}
      {loading ? (
        <div className="placeholder-box">Loading memory bank...</div>
      ) : displayItems.length === 0 ? (
        <div className="placeholder-box" style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--color-ink-muted)' }}>
            No memory records found.
          </p>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-ink-subtle)', marginTop: '0.4rem', display: 'block' }}>
            Record meetings or start a live session to automatically extract and index memories.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {displayItems.map((item, idx) => {
            const mem = item.memory as any;
            const dateDisplay = formatDate(mem.meetingDate || mem.createdAt || mem.created_at);

            return (
              <div
                key={mem.id || idx}
                className="luxury-card"
                style={{
                  padding: '1.15rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--color-paper-card)',
                  border: '1px solid var(--color-rule)',
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--color-accent)',
                        backgroundColor: 'var(--color-accent-subtle)',
                        padding: '0.15rem 0.55rem',
                        borderRadius: 'var(--radius-pill)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      🧠 Memory #{idx + 1}
                    </span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--color-ink)' }}>
                      {mem.meetingTitle || 'Meeting Memory'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
                      🕒 {dateDisplay}
                    </span>
                    {searchResults && typeof item.similarity === 'number' && (
                      <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-success)', fontWeight: 700, backgroundColor: 'var(--color-success-bg)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-pill)' }}>
                        {(item.similarity * 100).toFixed(1)}% Match
                      </span>
                    )}
                    <button
                      onClick={() => setMemoryToDelete(mem)}
                      title="Delete this memory"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        fontSize: '0.82rem',
                        color: 'var(--color-ink-subtle)',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Memory Text */}
                <p style={{ fontSize: '0.88rem', color: 'var(--color-ink)', lineHeight: 1.55, margin: 0 }}>
                  {mem.text}
                </p>

                {/* Card Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-rule)', paddingTop: '0.55rem', fontSize: '0.76rem', color: 'var(--color-ink-muted)' }}>
                  <span>Source: {mem.source || 'AI Synthesis'}</span>
                  {mem.meetingId && (
                    <span
                      onClick={() => navigate(`/meetings/${mem.meetingId}`)}
                      style={{ color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <span>View Meeting</span>
                      <span>↗</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Individual Memory Deletion */}
      <ConfirmModal
        isOpen={Boolean(memoryToDelete)}
        title="Delete Memory Record?"
        message="Are you sure you want to delete this memory from your private vault? This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDeleteMemory}
        onClose={() => setMemoryToDelete(null)}
      />
    </div>
  );
};

export default MemoryPage;
