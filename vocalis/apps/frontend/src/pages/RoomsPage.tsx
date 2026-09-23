import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';

interface P2PRoom {
  id: string;
  name: string;
  peers: number;
  isEncrypted: boolean;
  createdAt: string;
}

const STORAGE_KEY = 'Vocalis_custom_rooms';

export const RoomsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [roomCode, setRoomCode] = useState<string>('');
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [customRooms, setCustomRooms] = useState<P2PRoom[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveRooms = (rooms: P2PRoom[]) => {
    setCustomRooms(rooms);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    } catch {}
  };

  const handleJoin = (roomId: string) => {
    navigate(`/live/${roomId}`);
    showToast(`Connected to P2P room #${roomId}`, '', 'success');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newRoomName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `mesh-${Math.floor(Math.random() * 900 + 100)}`;
    const newRoom: P2PRoom = {
      id: code,
      name: newRoomName.trim() || `Room ${code}`,
      peers: 1,
      isEncrypted: true,
      createdAt: 'Just now',
    };

    const updated = [newRoom, ...customRooms.filter((r) => r.id !== code)];
    saveRooms(updated);
    setNewRoomName('');
    handleJoin(code);
  };

  const handleDeleteRoom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customRooms.filter((r) => r.id !== id);
    saveRooms(updated);
    showToast('Room removed', '', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <div className="brand-badge">
          <span className="pill">P2P Mesh Network</span>
          <span>· WebRTC Zero-Knowledge Stream</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', marginTop: '0.25rem' }}>
          Collaborative P2P Meeting Rooms
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
          Create or join private peer-to-peer rooms for synchronized real-time transcription and collaborative notes.
        </p>
      </div>

      {/* Join & Create Grid */}
      <div className="grid-2">
        {/* Create Room */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-ink)' }}>
            Create New P2P Room
          </h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="e.g. Weekly Product Sync"
              className="title-input"
            />
            <button type="submit" className="btn btn-primary">
              🔒 Create & Launch Room
            </button>
          </form>
        </div>

        {/* Join by Code */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-ink)' }}>
            Join Existing Room
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter room code (e.g. team-sync-101)"
              className="title-input"
            />
            <button
              className="btn btn-outline"
              disabled={!roomCode.trim()}
              onClick={() => handleJoin(roomCode.trim())}
            >
              Join Room →
            </button>
          </div>
        </div>
      </div>

      {/* Active Team Rooms */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem' }}>Your Mesh Rooms ({customRooms.length})</h2>
        {customRooms.length === 0 ? (
          <div className="placeholder-box">
            <p>No active mesh rooms created yet.</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)' }}>
              Create an encrypted room above to share instant live voice streaming with your team.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {customRooms.map((room) => (
              <div
                key={room.id}
                className="card"
                style={{
                  padding: '1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="status-dot connected" />
                    <strong style={{ fontSize: '0.98rem', color: 'var(--color-ink)' }}>{room.name}</strong>
                    <span className="badge-tag">#{room.id}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
                    Encrypted WebRTC P2P stream · Created {room.createdAt}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/live/${room.id}`);
                      showToast('Invite link copied!', '', 'success');
                    }}
                  >
                    🔗 Copy Link
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={(e) => handleDeleteRoom(room.id, e)}
                  >
                    Delete
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleJoin(room.id)}
                  >
                    Join Live →
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
