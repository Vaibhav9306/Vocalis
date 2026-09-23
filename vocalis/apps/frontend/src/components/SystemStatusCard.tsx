import React, { useState } from 'react';
import { HealthResponse } from '@meeting-assistant/shared-types';
import { API_BASE_URL } from '../config/api';

interface SystemStatusCardProps {
  healthData?: HealthResponse;
  error?: string;
  loading: boolean;
  onRefresh: () => void;
}

export const SystemStatusCard: React.FC<SystemStatusCardProps> = ({
  healthData,
  error,
  loading,
  onRefresh,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  return (
    <div className="card">
      <div className="card-title">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span>Service & Cloud Integration Diagnostics</span>
          <span
            className="badge-tag"
            style={{
              color: healthData ? 'var(--color-success)' : 'var(--color-danger)',
              borderColor: healthData ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            }}
          >
            {healthData ? '● Online' : '○ Offline'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            title="Toggle integration details"
          >
            {isExpanded ? 'Hide Details' : 'Show Details'}
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? 'Polling...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-paper-subtle)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Speech Engine
          </span>
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-ink)' }}>
            {healthData?.services.azureSpeech.configured ? 'Azure Speech' : 'Whisper v001'}
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-paper-subtle)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Reasoning AI
          </span>
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-ink)' }}>
            GPT-4.1-mini
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-paper-subtle)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Semantic Store
          </span>
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-ink)' }}>
            Semantic Memory Vault
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--color-paper-subtle)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', color: 'var(--color-ink-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
            Server Uptime
          </span>
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}>
            {healthData ? `${healthData.uptimeSeconds}s` : 'Offline'}
          </span>
        </div>
      </div>

      {/* Expanded Technical Inspection */}
      {isExpanded && (
        <div className="meta-list" style={{ marginTop: '0.5rem', animation: 'bannerSlide 0.2s ease-out' }}>
          <div className="meta-row">
            <span className="meta-label">Backend Host URL:</span>
            <span className="meta-value">{API_BASE_URL}</span>
          </div>

          <div className="meta-row">
            <span className="meta-label">API Health Status:</span>
            <span
              className="meta-value"
              style={{
                color: healthData ? 'var(--color-success)' : 'var(--color-danger)',
              }}
            >
              {healthData ? `${healthData.status.toUpperCase()} (v${healthData.version})` : error || 'Offline'}
            </span>
          </div>

          <div className="meta-row">
            <span className="meta-label">Runtime Environment:</span>
            <span className="meta-value">{healthData?.environment || 'development'}</span>
          </div>

          <div className="meta-row">
            <span className="meta-label">Azure OpenAI Service:</span>
            <span
              className="meta-value"
              style={{
                color: healthData?.services.azureOpenAI.configured
                  ? 'var(--color-success)'
                  : 'var(--color-warning)',
              }}
            >
              {healthData?.services.azureOpenAI.configured ? 'Configured & Active' : 'Fallback / Mock Mode'}
            </span>
          </div>

          <div className="meta-row">
            <span className="meta-label">Azure Speech / Whisper Service:</span>
            <span
              className="meta-value"
              style={{
                color: healthData?.services.azureSpeech.configured
                  ? 'var(--color-success)'
                  : 'var(--color-warning)',
              }}
            >
              {healthData?.services.azureSpeech.configured ? 'Configured & Streaming' : 'Fallback / Mock Mode'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
