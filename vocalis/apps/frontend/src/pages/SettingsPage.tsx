import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePageTransition } from '../hooks/useGsapAnimations';
import { MemoryPage } from './MemoryPage';
import { ConfirmModal } from '../components/ConfirmModal';

export const SettingsPage: React.FC<{ defaultTab?: string }> = ({ defaultTab }) => {
  const { user, workspace } = useAuth();
  const { params, navigate } = useRouter();
  const { showToast } = useToast();
  const containerRef = usePageTransition([params.tab || defaultTab]);

  const activeTab = params.tab || defaultTab || 'profile';

  const [name, setName] = useState<string>(user?.name || 'Rahul Sharma');
  const userEmail = user?.email || 'rahul@vocalis.ai';
  const [retentionDays, setRetentionDays] = useState<number>(workspace?.retentionDays || 90);
  const [localOnlyMemory, setLocalOnlyMemory] = useState<boolean>(true);
  const [telemetry, setTelemetry] = useState<boolean>(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Settings saved successfully', '', 'success');
  };

  const handleConfirmClearCache = () => {
    showToast('Local cache reset complete', 'All temporary cached memories re-indexed.', 'warning');
  };

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'privacy', label: 'Privacy & Retention' },
    { id: 'memory', label: 'Memory Bank' },
    { id: 'billing', label: 'Billing & Plans' },
    { id: 'data', label: 'Data & Export' },
  ];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px' }}>
      {/* Header */}
      <div className="gsap-stagger">
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)' }}>
          Settings & Preferences
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
          Manage your personal profile, local memory vault retention, and data export.
        </p>
      </div>

      {/* Tabs */}
      <div className="tab-strip luxury-card gsap-stagger" style={{ padding: '4px', gap: '4px' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => navigate(`/settings/${t.id}`)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSave} className="luxury-card gsap-stagger" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Profile Information</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="title-input"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Email Address</label>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>
                🔒 Permanent (Cannot be altered)
              </span>
            </div>
            <input
              type="email"
              value={userEmail}
              disabled
              readOnly
              className="title-input"
              style={{
                backgroundColor: 'var(--color-paper-subtle)',
                color: 'var(--color-ink-muted)',
                cursor: 'not-allowed',
                opacity: 0.85,
              }}
              title="Email address cannot be altered after sign up."
            />
          </div>

          <button type="submit" className="btn btn-primary magnetic-btn" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }}>
            Save Changes
          </button>
        </form>
      )}

      {/* Privacy & Retention Settings */}
      {activeTab === 'privacy' && (
        <form onSubmit={handleSave} className="luxury-card gsap-stagger" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Privacy & Memory Vault</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Meeting Transcript Retention</label>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="title-input"
            >
              <option value={30}>30 Days (Automatic Purge)</option>
              <option value={90}>90 Days (Recommended)</option>
              <option value={365}>1 Year</option>
              <option value={0}>Indefinite (No Auto-Deletion)</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={localOnlyMemory}
              onChange={(e) => setLocalOnlyMemory(e.target.checked)}
            />
            <span>Store semantic memories strictly in local on-device private vault</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input
              type="checkbox"
              checked={telemetry}
              onChange={(e) => setTelemetry(e.target.checked)}
            />
            <span>Share anonymous performance metrics (no transcript text is ever transmitted)</span>
          </label>

          <button type="submit" className="btn btn-primary magnetic-btn" style={{ alignSelf: 'flex-start' }}>
            Save Privacy Policy
          </button>
        </form>
      )}

      {/* Memory Bank Tab */}
      {activeTab === 'memory' && (
        <div className="gsap-stagger">
          <MemoryPage />
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="luxury-card gsap-stagger" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Subscription & Plan</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-paper-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-rule)' }}>
            <div>
              <strong style={{ fontSize: '1.05rem', color: 'var(--color-ink)' }}>Vocalis Community Tier</strong>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', marginTop: '0.2rem' }}>
                Unlimited local transcription · On-device memory store · Free forever
              </div>
            </div>
            <button className="btn btn-primary btn-sm magnetic-btn" onClick={() => navigate('/pricing')}>
              View Pro Plans →
            </button>
          </div>
        </div>
      )}

      {/* Data & Export Tab */}
      {activeTab === 'data' && (
        <div className="luxury-card gsap-stagger" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Data Export & Vault Management</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
            Export all meeting transcripts and decisions or reset the local memory store.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-outline magnetic-btn"
              onClick={() => showToast('Export initiated', 'Downloading all meeting records', 'success')}
            >
              📥 Export All Meeting Data
            </button>
            <button
              className="btn btn-danger magnetic-btn"
              onClick={() => setIsConfirmingClear(true)}
            >
              ⚠️ Clear Local Cache
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Cache Reset */}
      <ConfirmModal
        isOpen={isConfirmingClear}
        title="Reset Local Cache?"
        message="Are you sure you want to clear your local memory cache? Your stored meetings will remain safe and re-index upon next startup."
        confirmText="Yes, Reset"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleConfirmClearCache}
        onClose={() => setIsConfirmingClear(false)}
      />
    </div>
  );
};
