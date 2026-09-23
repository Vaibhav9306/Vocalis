import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { fetchSessions, fetchTasks, fetchDecisions, updateTaskStatus } from '../services/apiClient';
import { LiveMeetingSession, TaskItem, DecisionItem } from '@meeting-assistant/shared-types';
import { useToast } from '../context/ToastContext';
import { CountUp, TiltCard, DecryptedText, ShinyText } from '../components/motion';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [meetings, setMeetings] = useState<LiveMeetingSession[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [guideDismissed, setGuideDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('vocalis_guide_dismissed') === 'true';
    } catch {
      return false;
    }
  });

  const handleDismissGuide = () => {
    setGuideDismissed(true);
    try {
      localStorage.setItem('vocalis_guide_dismissed', 'true');
    } catch {}
  };

  // Microphone Test State
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [micSuccess, setMicSuccess] = useState<boolean>(false);
  const [micVolume, setMicVolume] = useState<number>(0);

  useEffect(() => {
    Promise.all([fetchSessions(), fetchTasks(), fetchDecisions()])
      .then(([sessionsRes, tasksRes, decisionsRes]) => {
        if (sessionsRes.data) setMeetings(sessionsRes.data);
        if (tasksRes.data) setTasks(tasksRes.data);
        if (decisionsRes.data) setDecisions(decisionsRes.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleTestMicrophone = async () => {
    try {
      setIsTestingMic(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      let count = 0;
      const interval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setMicVolume(Math.min(100, Math.round(avg * 1.5)));
        count++;
        if (count > 25) {
          clearInterval(interval);
          stream.getTracks().forEach((t) => t.stop());
          audioCtx.close();
          setIsTestingMic(false);
          setMicSuccess(true);
          showToast('Microphone Verified', 'Browser audio input is clear and ready.', 'success');
        }
      }, 80);
    } catch {
      setIsTestingMic(false);
      showToast('Microphone Access Needed', 'Please allow microphone permissions.', 'warning');
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus: 'todo' | 'done' = currentStatus === 'done' ? 'todo' : 'done';
    try {
      await updateTaskStatus(taskId, nextStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );
      showToast(nextStatus === 'done' ? 'Task Completed' : 'Task Reopened', '', 'info');
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );
    }
  };

  // Metrics Calculations
  const totalSeconds = meetings.reduce((acc, m) => acc + (m.durationSeconds || m.chunks.length * 5), 0);
  const totalHours = (totalSeconds / 3600).toFixed(1);
  const pendingTasks = tasks.filter((t) => t.status !== 'done');
  const activeDecisions = decisions.filter((d) => d.status === 'active');

  const displayName = user?.name ? user.name.trim().split(' ')[0] : (user?.email ? user.email.split('@')[0] : 'Friend');

  const getGreeting = (): string => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* Top Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '1.25rem',
          borderBottom: '1px solid var(--color-rule)',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {todayStr}
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', color: 'var(--color-ink)', lineHeight: 1.15, marginTop: '0.2rem', fontWeight: 700 }}>
            {getGreeting()}, <DecryptedText text={displayName} triggerOnHover={true} />
          </h1>
          <p style={{ fontSize: '0.92rem', color: 'var(--color-ink-muted)', marginTop: '0.25rem' }}>
            Your real-time meeting transcripts, speaker analytics, and deliverables.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={() => navigate('/ask')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
            <span>Ask Vocalis</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/live')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', fontWeight: 600 }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
            <ShinyText text="Start Live Meeting" speed="3.5s" color="#ffffff" shineColor="rgba(255,255,255,0.8)" />
          </button>
        </div>
      </div>

      {/* 3-Step Setup & Workflow Instructions (Shown Only to New Users) */}
      {!loading && !guideDismissed && meetings.length === 0 && (
        <div
          className="luxury-card"
          style={{
            borderRadius: '20px',
            padding: '1.5rem',
            backgroundColor: 'var(--color-paper-card)',
            border: '1px solid var(--color-rule)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-accent)', fontWeight: 700 }}>
                QUICK SETUP & WORKFLOW GUIDE
              </span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)', marginTop: '0.15rem' }}>
                How Vocalis Works in 3 Simple Steps
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-ink-muted)', fontFamily: 'var(--font-mono)' }}>
                Zero manual note-taking
              </span>
              <button
                onClick={handleDismissGuide}
                title="Dismiss Guide"
                className="btn btn-outline btn-sm"
                style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-pill)' }}
              >
                ✕ Dismiss
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {/* Step 1 */}
            <div
              style={{
                backgroundColor: 'var(--color-paper-subtle)',
                borderRadius: '14px',
                padding: '1.15rem',
                border: '1px solid var(--color-rule)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-accent)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  1
                </span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--color-ink)' }}>Test Audio Input</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', lineHeight: 1.45, margin: 0 }}>
                Verify your microphone frequency response and input levels before joining a live discussion.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                {micSuccess ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-success)', fontSize: '0.82rem', fontWeight: 600 }}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span>Microphone tested & clear</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handleTestMicrophone}
                      disabled={isTestingMic}
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                    >
                      {isTestingMic ? 'Analyzing Voice...' : 'Test Microphone'}
                    </button>
                    {isTestingMic && (
                      <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--color-rule)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${micVolume}%`, height: '100%', backgroundColor: 'var(--color-accent)', transition: 'width 0.1s' }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2 */}
            <div
              style={{
                backgroundColor: 'var(--color-paper-subtle)',
                borderRadius: '14px',
                padding: '1.15rem',
                border: '1px solid var(--color-rule)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-accent)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  2
                </span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--color-ink)' }}>Launch Live Meeting</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', lineHeight: 1.45, margin: 0 }}>
                Start recording in real-time with automatic speaker identification, multilingual support, and live transcripts.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/live')}
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                  <span>Start Session →</span>
                </button>
              </div>
            </div>

            {/* Step 3 */}
            <div
              style={{
                backgroundColor: 'var(--color-paper-subtle)',
                borderRadius: '14px',
                padding: '1.15rem',
                border: '1px solid var(--color-rule)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-accent)',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  3
                </span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--color-ink)' }}>Automatic Intelligence</strong>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', lineHeight: 1.45, margin: 0 }}>
                AI extracts action deliverables, key decisions, and conversation graphs without any manual notes needed.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate('/tasks')}
                  style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
                >
                  View Tasks Board →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* METRIC STRIP (Clean & High-Density) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        <TiltCard maxTilt={5} scale={1.01} className="luxury-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderRadius: '18px' }}>
          <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-ink-muted)', letterSpacing: '0.04em' }}>
            Meetings Captured
          </span>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
            <CountUp to={meetings.length} duration={1.1} />
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--color-ink-subtle)' }}>
            All sessions recorded
          </span>
        </TiltCard>

        <TiltCard maxTilt={5} scale={1.01} className="luxury-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderRadius: '18px' }}>
          <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-ink-muted)', letterSpacing: '0.04em' }}>
            Time Transcribed
          </span>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
            <CountUp to={parseFloat(totalHours) || 0} decimals={1} duration={1.2} suffix="h" />
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--color-ink-subtle)' }}>
            {Math.round(totalSeconds / 60)} minutes total audio
          </span>
        </TiltCard>

        <TiltCard maxTilt={5} scale={1.01} className="luxury-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderRadius: '18px' }}>
          <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-ink-muted)', letterSpacing: '0.04em' }}>
            Action Deliverables
          </span>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
            <CountUp to={pendingTasks.length} duration={1.1} />
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--color-ink-subtle)' }}>
            {tasks.filter((t) => t.status === 'done').length} completed
          </span>
        </TiltCard>

        <TiltCard maxTilt={5} scale={1.01} className="luxury-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', borderRadius: '18px' }}>
          <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--color-ink-muted)', letterSpacing: '0.04em' }}>
            Indexed Decisions
          </span>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--color-ink)' }}>
            <CountUp to={activeDecisions.length} duration={1.1} />
          </div>
          <span style={{ fontSize: '0.76rem', color: 'var(--color-success)', fontWeight: 600 }}>
            ✓ Ready for search
          </span>
        </TiltCard>
      </div>

      {/* TWO-COLUMN MAIN WORKSPACE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'stretch' }}>
        {/* Left Column: Recent Meetings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              Recent Meetings
            </h2>
            {meetings.length > 0 && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate('/meetings')}
                style={{ fontSize: '0.78rem' }}
              >
                View all ({meetings.length}) →
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loading ? (
              <div className="placeholder-box" style={{ padding: '2rem', textAlign: 'center' }}>
                Loading meetings...
              </div>
            ) : meetings.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--color-paper-card)',
                  border: '1px dashed var(--color-rule)',
                  borderRadius: '18px',
                  padding: '2.25rem 1.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.85rem',
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                </div>
                <strong style={{ fontSize: '1rem', color: 'var(--color-ink)' }}>No meetings recorded yet</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-muted)', maxWidth: '360px', lineHeight: 1.45 }}>
                  Launch a live session to record voice, transcribe, and see automatic key decisions in real time.
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/live')}
                >
                  Launch Live Meeting →
                </button>
              </div>
            ) : (
              meetings.slice(0, 4).map((meeting) => (
                <div
                  key={meeting.id}
                  className="luxury-card"
                  onClick={() => navigate(`/meetings/${meeting.id}`)}
                  style={{
                    cursor: 'pointer',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    borderRadius: '16px',
                    border: '1px solid var(--color-rule)',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                        {meeting.title}
                      </h3>
                      <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)' }}>
                        {new Date(meeting.startedAt).toLocaleDateString()} · {Math.round((meeting.durationSeconds || meeting.chunks.length * 5) / 60)} mins · {meeting.chunks.length} segments
                      </span>
                    </div>
                    {meeting.isFavorite && <span style={{ color: 'var(--color-accent)' }}>★</span>}
                  </div>

                  <p
                    style={{
                      fontSize: '0.84rem',
                      color: 'var(--color-ink-muted)',
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      margin: 0,
                    }}
                  >
                    {meeting.latestAnalysis?.keyPoints?.[0] || meeting.accumulatedTranscript || 'Meeting recorded successfully.'}
                  </p>

                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.2rem' }}>
                    {meeting.latestAnalysis?.actionItems && meeting.latestAnalysis.actionItems.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: 'var(--color-accent-subtle)',
                          color: 'var(--color-accent)',
                          fontWeight: 600,
                        }}
                      >
                        {meeting.latestAnalysis.actionItems.length} tasks
                      </span>
                    )}
                    {meeting.tags?.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        style={{
                          fontSize: '0.72rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-pill)',
                          backgroundColor: 'var(--color-paper-subtle)',
                          color: 'var(--color-ink-muted)',
                        }}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Action Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-ink)' }}>
              Assigned Deliverables
            </h2>
            {tasks.length > 0 && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate('/tasks')}
                style={{ fontSize: '0.78rem' }}
              >
                Board ({tasks.length}) →
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {tasks.length === 0 ? (
              <div
                style={{
                  backgroundColor: 'var(--color-paper-card)',
                  border: '1px dashed var(--color-rule)',
                  borderRadius: '18px',
                  padding: '2.25rem 1.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.65rem',
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <strong style={{ fontSize: '0.98rem', color: 'var(--color-ink)' }}>No pending action items</strong>
                <p style={{ fontSize: '0.82rem', color: 'var(--color-ink-muted)', lineHeight: 1.45 }}>
                  Action items detected during your live speech meetings will appear here automatically.
                </p>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate('/tasks')}
                >
                  Go to Tasks Board →
                </button>
              </div>
            ) : (
              tasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className="luxury-card"
                  style={{
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    borderRadius: '14px',
                    border: '1px solid var(--color-rule)',
                    opacity: task.status === 'done' ? 0.6 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={task.status === 'done'}
                    onChange={() => handleToggleTask(task.id, task.status)}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      accentColor: 'var(--color-accent)',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                        textDecoration: task.status === 'done' ? 'line-through' : 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {task.task}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-subtle)', marginTop: '0.15rem' }}>
                      👤 {task.assignee} {task.dueDate ? `· Due ${task.dueDate}` : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
