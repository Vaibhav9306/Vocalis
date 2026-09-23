import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const OnboardingPage: React.FC = () => {
  const { updateOnboarding, workspace, switchWorkspace } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [step, setStep] = useState<number>(1);
  const [selectedUseCase, setSelectedUseCase] = useState<string>('Meetings & Standups');
  const [selectedPriority, setSelectedPriority] = useState<string>('Action items & decisions');
  const [workspaceName, setWorkspaceName] = useState<string>(workspace?.name || 'My Engineering Team');
  const [inviteEmails, setInviteEmails] = useState<string>('');

  const useCases = [
    { title: 'Meetings & Standups', icon: '💼', desc: 'Sync engineering, product, and leadership discussions' },
    { title: 'Classes & Lectures', icon: '🎓', desc: 'Capture professors, seminars, and study notes' },
    { title: 'Interviews & Research', icon: '🎙️', desc: 'User testing, customer discovery, and qualitative synthesis' },
    { title: 'Sales & Client Calls', icon: '📈', desc: 'Extract customer requirements, objections, and next steps' },
    { title: 'Personal Notes & Thoughts', icon: '📝', desc: 'Brainstorming, dictated voice notes, and private memories' },
  ];

  const priorities = [
    { title: 'Action items & decisions', icon: '⚡', desc: 'Never lose track of assigned tasks and agreed roadmaps' },
    { title: 'Accurate live transcription', icon: '🎙️', desc: 'Sub-second real-time speech hypotheses without lag' },
    { title: 'Searchable meeting memory', icon: '🧠', desc: 'Ask questions across months of meeting transcripts' },
    { title: 'Zero-knowledge privacy', icon: '🔒', desc: 'Keep meeting notes encrypted in a local on-device vault' },
  ];

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      updateOnboarding({
        completed: true,
        step: 5,
        useCase: selectedUseCase,
        priority: selectedPriority,
        workspaceName,
        invitedEmails: inviteEmails.split(',').map((e) => e.trim()).filter(Boolean),
      });

      if (workspace) {
        switchWorkspace({
          ...workspace,
          name: workspaceName,
        });
      }

      showToast('Workspace created!', 'Welcome to Vocalis', 'success');
      navigate('/dashboard');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--color-paper-card)',
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-elevated)',
          padding: '2.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.85rem' }}>
          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', fontWeight: 700 }}>
            STEP {step} OF 4
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: '28px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor: i <= step ? 'var(--color-accent)' : 'var(--color-rule)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Use Case */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem' }}>What will you use Vocalis for?</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>Help us customize your meeting intelligence workspace.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {useCases.map((uc) => (
                <div
                  key={uc.title}
                  onClick={() => setSelectedUseCase(uc.title)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${selectedUseCase === uc.title ? 'var(--color-accent)' : 'var(--color-rule)'}`,
                    backgroundColor: selectedUseCase === uc.title ? 'var(--color-accent-subtle)' : 'var(--color-paper)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>{uc.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ink)' }}>{uc.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)' }}>{uc.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: What matters most */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem' }}>What matters most to you?</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>We optimize your AI extraction models based on your focus.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {priorities.map((p) => (
                <div
                  key={p.title}
                  onClick={() => setSelectedPriority(p.title)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${selectedPriority === p.title ? 'var(--color-accent)' : 'var(--color-rule)'}`,
                    backgroundColor: selectedPriority === p.title ? 'var(--color-accent-subtle)' : 'var(--color-paper)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-ink)' }}>{p.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)' }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Create Workspace */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem' }}>Name your Workspace</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>Where you and your team will organize and search meeting memory.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Workspace Name</label>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Acme Engineering Labs"
                className="title-input"
              />
            </div>
          </div>
        )}

        {/* Step 4: Invite Teammates */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem' }}>Invite your teammates</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--color-ink-muted)' }}>Collaborate on shared meeting notes and tasks (optional).</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>Email addresses (comma separated)</label>
              <input
                type="text"
                value={inviteEmails}
                onChange={(e) => setInviteEmails(e.target.value)}
                placeholder="sarah@company.com, alex@company.com"
                className="title-input"
              />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          {step > 1 ? (
            <button className="btn btn-outline" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          ) : (
            <div />
          )}

          <button className="btn btn-primary" onClick={handleNext}>
            {step === 4 ? 'Complete Setup & Open Workspace →' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
};
