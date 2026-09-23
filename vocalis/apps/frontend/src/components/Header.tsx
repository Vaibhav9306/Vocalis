import React, { useState } from 'react';

interface HeaderProps {
  connected: boolean | null;
  latencyMs?: number;
}

export const Header: React.FC<HeaderProps> = ({ connected, latencyMs }) => {
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const getStatusText = () => {
    if (connected === null) return 'Connecting P2P Node...';
    if (connected) return `P2P Mesh Synced (${latencyMs ?? 0}ms)`;
    return 'Node Offline';
  };

  const getDotClass = () => {
    if (connected === null) return 'checking';
    return connected ? 'connected' : 'disconnected';
  };

  return (
    <header className="app-header">
      <div className="header-branding">
        <div className="brand-badge">
          <span className="pill">P2P Encrypted Mesh</span>
          <span>· Zero-Knowledge Scribe</span>
        </div>
        <h1>Vocalis</h1>
        <p>Private peer-to-peer live meeting transcription, autonomous action extraction & memory</p>
      </div>

      <div className="header-meta-group">
        <div className="status-badge" style={{ backgroundColor: 'var(--color-paper-subtle)' }} title="End-to-End Encrypted Room ID">
          <span>🔒 Room: <strong>#mesh-sync-802</strong></span>
        </div>

        <div className="status-badge" title="P2P Mesh Network Latency">
          <span className={`status-dot ${getDotClass()}`} />
          <span>{getStatusText()}</span>
        </div>

        <button
          className="btn btn-outline btn-sm"
          onClick={handleCopyInvite}
          title="Copy P2P meeting invite link"
        >
          {copiedLink ? '✓ Link Copied' : '🔗 Invite Peer'}
        </button>
      </div>
    </header>
  );
};
