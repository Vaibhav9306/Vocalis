import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { WorkspaceMember } from '@meeting-assistant/shared-types';

const STORAGE_KEY = 'Vocalis_workspace_members';

export const WorkspacePage: React.FC = () => {
  const { user, workspace } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<WorkspaceMember[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}

    const defaultOwner: WorkspaceMember = {
      id: user?.id || 'm-owner',
      name: user?.name || 'Workspace Owner',
      email: user?.email || 'user@Vocalis.local',
      role: 'owner',
      status: 'active',
      joinedAt: new Date().toISOString(),
    };
    return [defaultOwner];
  });

  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');

  const saveMembers = (list: WorkspaceMember[]) => {
    setMembers(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const newMember: WorkspaceMember = {
      id: `m-${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
      joinedAt: new Date().toISOString(),
    };

    const updated = [...members, newMember];
    saveMembers(updated);
    setInviteEmail('');
    showToast(`Invitation sent to ${inviteEmail}`, '', 'success');
  };

  const handleRemoveMember = (id: string) => {
    if (id === user?.id || members.find((m) => m.id === id)?.role === 'owner') {
      showToast('Cannot remove the workspace owner', '', 'error');
      return;
    }
    const updated = members.filter((m) => m.id !== id);
    saveMembers(updated);
    showToast('Member removed from workspace', '', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div>
        <div className="brand-badge">
          <span className="pill">Organization</span>
          <span>· {workspace?.name || 'Local Workspace'}</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--color-ink)', marginTop: '0.25rem' }}>
          Workspace & Team Members
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>
          Manage your organization, team members, role-based access, and shared meeting data retention.
        </p>
      </div>

      {/* Invite Member Card */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>
          Invite New Teammate
        </h2>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            className="title-input"
            style={{ flex: 1, minWidth: '220px' }}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
            className="title-input"
            style={{ width: '130px' }}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="btn btn-primary">
            Send Invitation
          </button>
        </form>
      </div>

      {/* Members Directory */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.75rem' }}>
          Team Members ({members.length})
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          {members.map((member) => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 0',
                borderBottom: '1px solid var(--color-rule)',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-rule-focus)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {member.name[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <strong style={{ fontSize: '0.92rem', color: 'var(--color-ink)' }}>{member.name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)' }}>{member.email}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="badge-tag" style={{ textTransform: 'capitalize' }}>
                  {member.role}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)',
                    color: member.status === 'active' ? 'var(--color-success)' : 'var(--color-warning)',
                    fontWeight: 600,
                  }}
                >
                  ● {member.status}
                </span>
                {member.role !== 'owner' && (
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleRemoveMember(member.id)}
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
