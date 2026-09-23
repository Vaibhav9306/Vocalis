import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ThemeToggle } from '../components/ThemeToggle';

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  r: number;
  color: string;
  vx: number;
  vy: number;
  delay: number;
  life: number;
  maxLife: number;
  turbulence: number;
}

export const AuthPages: React.FC<{ mode: 'login' | 'signup' | 'forgot-password' }> = ({ mode }) => {
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDevouring, setIsDevouring] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'stream' | 'discourse' | 'memory'>('stream');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);

  const { login, register } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  // Handle ESC key to exit auth page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Live wave harmonic equalizer
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const renderVisualizer = () => {
      if (!canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      time += 0.03;

      // Draw multi-layered glowing sound waves
      const waves = [
        { amplitude: 14, frequency: 0.025, speed: 1.5, color: 'rgba(122, 50, 227, 0.55)', lineWidth: 2 },
        { amplitude: 10, frequency: 0.035, speed: -1.2, color: 'rgba(253, 135, 61, 0.55)', lineWidth: 2 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = wave.lineWidth;
        ctx.lineCap = 'round';

        for (let x = 0; x < width; x += 3) {
          const envelope = Math.sin((x / width) * Math.PI);
          const y = centerY + Math.sin(x * wave.frequency + time * wave.speed) * wave.amplitude * envelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // Animated mini audio spectrum bars
      const numBars = 24;
      const barWidth = 3;
      const spacing = (width - numBars * barWidth) / (numBars + 1);

      for (let i = 0; i < numBars; i++) {
        const barHeight = Math.sin(time * 2.5 + i * 0.4) * 8 + Math.cos(time * 1.8 + i * 0.3) * 6 + 12;
        const x = spacing + i * (barWidth + spacing);
        const y = height - barHeight - 4;

        ctx.fillStyle = i % 2 === 0 ? 'rgba(122, 50, 227, 0.7)' : 'rgba(253, 135, 61, 0.7)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      visualizerFrameRef.current = requestAnimationFrame(renderVisualizer);
    };

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    renderVisualizer();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (visualizerFrameRef.current) {
        cancelAnimationFrame(visualizerFrameRef.current);
      }
    };
  }, []);

  // Resize canvas to match card dimensions for text devouring effect
  useEffect(() => {
    const updateCanvasDimensions = () => {
      const card = cardRef.current;
      const canvas = canvasRef.current;
      if (card && canvas) {
        canvas.width = card.offsetWidth;
        canvas.height = card.offsetHeight;
      }
    };
    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, [mode, errorMessage]);

  // Particle Physics Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.delay > 0) {
          p.delay -= 1;
          const alpha = 0.95;
          ctx.fillStyle = p.color.replace('ALPHA', alpha.toFixed(2));
          ctx.beginPath();
          ctx.arc(p.originX, p.originY, p.r, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        p.x += p.vx + Math.sin(p.life * 0.08) * p.turbulence;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 - 0.035;
        p.life -= 1;

        const progress = p.life / p.maxLife;
        const alpha = Math.max(0, Math.min(1, Math.pow(progress, 0.75)));
        ctx.fillStyle = p.color.replace('ALPHA', alpha.toFixed(2));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.6 + 0.4 * progress), 0, Math.PI * 2);
        ctx.fill();

        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Pixel Devouring Algorithm
  const devourElementText = (element: HTMLElement | null, textContent: string) => {
    if (!element || !cardRef.current || !textContent) return;

    const cardRect = cardRef.current.getBoundingClientRect();
    const elemRect = element.getBoundingClientRect();

    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const width = Math.max(10, elemRect.width);
    const height = Math.max(10, elemRect.height);
    offscreen.width = width;
    offscreen.height = height;

    const style = window.getComputedStyle(element);
    offCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    offCtx.fillStyle = '#ffffff';
    offCtx.textBaseline = 'middle';

    const textX = 14;
    const textY = height / 2;
    offCtx.fillText(textContent, textX, textY);

    const imgData = offCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const offsetX = elemRect.left - cardRect.left;
    const offsetY = elemRect.top - cardRect.top;

    const step = 3;
    for (let py = 0; py < height; py += step) {
      for (let px = 0; px < width; px += step) {
        const idx = (py * width + px) * 4;
        const alpha = data[idx + 3];

        if (alpha > 40) {
          const waveDelay = Math.floor((px / width) * 22);
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
          const speed = Math.random() * 2.8 + 1.2;

          const colors = [
            'rgba(122, 50, 227, ALPHA)',
            'rgba(253, 135, 61, ALPHA)',
            'rgba(168, 85, 247, ALPHA)',
            'rgba(56, 189, 248, ALPHA)',
          ];
          const chosenColor = colors[Math.floor(Math.random() * colors.length)];

          particlesRef.current.push({
            x: offsetX + px,
            y: offsetY + py,
            originX: offsetX + px,
            originY: offsetY + py,
            r: Math.random() * 1.8 + 1.0,
            color: chosenColor,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.8,
            delay: waveDelay,
            life: Math.floor(Math.random() * 50 + 60),
            maxLife: 100,
            turbulence: Math.random() * 0.4 + 0.1,
          });
        }
      }
    }
  };

  const triggerDevouringAnimation = () => {
    setIsDevouring(true);

    if (emailInputRef.current) {
      devourElementText(emailInputRef.current, email);
    }
    if (nameInputRef.current && mode === 'signup') {
      devourElementText(nameInputRef.current, name);
    }
    if (passwordInputRef.current && mode !== 'forgot-password') {
      devourElementText(passwordInputRef.current, '••••••••••••');
    }
    if (submitBtnRef.current) {
      devourElementText(submitBtnRef.current, mode === 'login' ? 'Sign In →' : mode === 'signup' ? 'Create Account →' : 'Send Reset Link →');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address');
      showToast('Please enter your email address', '', 'warning');
      return;
    }

    if (mode === 'forgot-password') {
      triggerDevouringAnimation();
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setIsDevouring(false);
        showToast('Password reset link sent', `Check your inbox at ${trimmedEmail}`, 'info');
        navigate('/login');
      }, 1600);
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password');
      showToast('Please enter your password', '', 'warning');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      showToast('Password too short', 'Must be at least 6 characters', 'warning');
      return;
    }

    triggerDevouringAnimation();
    setLoading(true);

    try {
      if (mode === 'signup') {
        const user = await register(trimmedEmail, password, name.trim());
        showToast('Account created successfully!', `Welcome to Vocalis, ${user.name}`, 'success');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1700);
      } else {
        const user = await login(trimmedEmail, password);
        showToast('Signed in successfully', `Welcome back, ${user.name}`, 'success');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1700);
      }
    } catch (err: unknown) {
      setIsDevouring(false);
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
      showToast('Authentication Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-paper)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
        transition: 'background-color var(--dur-short) var(--ease-out)',
      }}
    >
      <style>{`
        .auth-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          width: 100%;
          box-sizing: border-box;
          z-index: 50;
          border-bottom: 1px solid var(--color-rule);
        }
        .auth-container {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 2rem;
          max-width: 1320px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .auth-split-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.95fr;
          width: 100%;
          gap: 2rem;
          align-items: stretch;
        }
        @media (max-width: 992px) {
          .auth-split-grid {
            grid-template-columns: 1fr;
            max-width: 520px;
            margin: 0 auto;
          }
          .auth-copilot-panel {
            display: none !important;
          }
        }
        .auth-copilot-panel {
          border-radius: 24px;
          background-color: var(--color-paper-card);
          border: 1px solid var(--color-rule);
          box-shadow: var(--shadow-elevated);
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          position: relative;
          overflow: hidden;
        }
        .auth-card-wrapper {
          position: relative;
          width: 100%;
          display: flex;
          flex-direction: column;
        }
        .auth-card {
          flex: 1;
          background-color: var(--color-paper-card);
          border: 1px solid var(--color-rule);
          border-radius: 24px;
          box-shadow: var(--shadow-elevated);
          padding: 2.25rem 2rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.25rem;
          position: relative;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }
        .auth-card:hover {
          border-color: var(--color-rule-focus);
        }
        .auth-close-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 1rem;
          border-radius: var(--radius-pill);
          border: 1px solid var(--color-rule);
          background-color: var(--color-paper-card);
          color: var(--color-ink);
          font-family: var(--font-sans);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--dur-short) var(--ease-out);
          box-shadow: var(--shadow-subtle);
        }
        .auth-close-nav-btn:hover {
          background-color: var(--color-ink);
          color: var(--color-paper);
          border-color: var(--color-ink);
        }
        .auth-close-nav-btn kbd {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          padding: 1px 5px;
          border-radius: 4px;
          background: var(--color-paper-subtle);
          color: var(--color-ink-muted);
          border: 1px solid var(--color-rule);
        }
        .auth-close-nav-btn:hover kbd {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border-color: transparent;
        }
        .auth-tab-bar {
          display: flex;
          background-color: var(--color-paper-subtle);
          border-radius: var(--radius-pill);
          padding: 4px;
          border: 1px solid var(--color-rule);
          gap: 4px;
        }
        .auth-tab-btn {
          flex: 1;
          padding: 8px 14px;
          border-radius: var(--radius-pill);
          border: none;
          font-family: inherit;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--dur-short) var(--ease-out);
          color: var(--color-ink-muted);
          background: transparent;
        }
        .auth-tab-btn.active {
          background-color: var(--color-paper-card);
          color: var(--color-ink);
          box-shadow: var(--shadow-subtle);
          font-weight: 700;
        }
        .auth-input-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .auth-input-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-ink);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .auth-input {
          width: 100%;
          background-color: var(--color-paper-subtle);
          border: 1px solid var(--color-rule);
          border-radius: var(--radius-md);
          padding: 0.75rem 0.95rem;
          font-family: inherit;
          font-size: 0.92rem;
          color: var(--color-ink);
          box-sizing: border-box;
          transition: border-color var(--dur-short), box-shadow var(--dur-short), background-color var(--dur-short);
        }
        .auth-input:focus {
          outline: none;
          background-color: var(--color-paper-card);
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px var(--color-focus);
        }
        .auth-input.devouring {
          color: transparent !important;
          opacity: 0.25;
        }
        .auth-error-banner {
          background-color: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          color: var(--color-danger);
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-md);
          font-size: 0.84rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }
        .auth-submit-btn {
          width: 100%;
          padding: 0.85rem 1.25rem;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 0.94rem;
          font-weight: 600;
          color: #ffffff;
          background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-coral) 100%);
          border: none;
          box-shadow: 0 4px 16px rgba(122, 50, 227, 0.28);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          transition: transform var(--dur-micro), box-shadow var(--dur-short), opacity var(--dur-short);
        }
        .auth-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(122, 50, 227, 0.38);
        }
        .auth-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .auth-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .auth-link {
          color: var(--color-accent);
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: opacity var(--dur-micro);
        }
        .auth-link:hover {
          text-decoration: underline;
        }
        .copilot-chip {
          padding: 4px 10px;
          border-radius: var(--radius-pill);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--color-rule);
          background-color: var(--color-paper-subtle);
          color: var(--color-ink-muted);
          transition: all var(--dur-short) var(--ease-out);
        }
        .copilot-chip.active {
          background-color: var(--color-ink);
          color: var(--color-paper);
          border-color: var(--color-ink);
        }
        .chat-bubble {
          padding: 0.75rem 0.95rem;
          border-radius: 14px;
          border: 1px solid var(--color-rule);
          background-color: var(--color-paper-subtle);
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.83rem;
          line-height: 1.45;
        }
      `}</style>

      {/* Top Header Bar */}
      <header className="auth-top-bar">
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Return to Vocalis Home"
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: '18px', height: '18px', fill: 'var(--color-paper)' }}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" stroke="var(--color-paper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.35rem', color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
            Vocalis
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => navigate('/')}
            className="auth-close-nav-btn"
            title="Exit to Home (Esc)"
          >
            <span>✕ Close</span>
            <kbd>esc</kbd>
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <div className="auth-container">
        <div className="auth-split-grid">
          {/* Left Side: Live Dynamic Meeting Simulation */}
          <section className="auth-copilot-panel">
            {/* Simulation Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-rule)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: 'var(--radius-pill)', backgroundColor: '#ef444418', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                  LIVE COPILOT
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-ink)' }}>
                  Meeting #3: Architecture Sync
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-muted)' }}>
                ⏱️ 14:28 · 3 Peers
              </span>
            </div>

            {/* Interactive Mode Pills */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                type="button"
                className={`copilot-chip ${activeTab === 'stream' ? 'active' : ''}`}
                onClick={() => setActiveTab('stream')}
              >
                🎙️ Live Transcription
              </button>
              <button
                type="button"
                className={`copilot-chip ${activeTab === 'discourse' ? 'active' : ''}`}
                onClick={() => setActiveTab('discourse')}
              >
                👥 Speaker Discourse
              </button>
              <button
                type="button"
                className={`copilot-chip ${activeTab === 'memory' ? 'active' : ''}`}
                onClick={() => setActiveTab('memory')}
              >
                📍 Grounded RAG
              </button>
            </div>

            {/* Simulated Live Meeting Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {activeTab === 'stream' && (
                <>
                  <div className="chat-bubble">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>👤 Alex Rivera (Lead Architect)</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>14:26</span>
                    </div>
                    <span>
                      "The WebRTC P2P mesh distributes live transcript chunks directly to all peers with sub-20ms latency."
                    </span>
                  </div>

                  <div className="chat-bubble">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-accent-coral)' }}>👤 Priya Sharma (Product)</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-ink-subtle)', fontFamily: 'var(--font-mono)' }}>14:27</span>
                    </div>
                    <span>
                      "Haan exactly, Hinglish support automatically catches technical terms without manual language toggling."
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '0.75rem 0.95rem',
                      borderRadius: '14px',
                      backgroundColor: 'var(--color-accent-subtle)',
                      border: '1px solid var(--color-rule)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>⚡</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', fontSize: '0.78rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>AI Action Item Detected</span>
                      <span style={{ color: 'var(--color-ink)' }}>Export meeting insights to encrypted local storage</span>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'discourse' && (
                <>
                  <div className="chat-bubble" style={{ borderLeft: '3px solid var(--color-accent)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>🔄 Turn Handoff</div>
                    <span style={{ color: 'var(--color-ink-muted)' }}>
                      Alex Rivera ➔ Priya Sharma (Discussion on multilingual Hindi latency)
                    </span>
                  </div>
                  <div className="chat-bubble" style={{ borderLeft: '3px solid var(--color-accent-coral)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>❓ Inquiry & Response</div>
                    <span style={{ color: 'var(--color-ink-muted)' }}>
                      Priya asked about zero-cloud encryption ➔ Alex confirmed 100% ephemeral peer-to-peer audio.
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: 'auto' }}>
                    <div style={{ padding: '0.6rem', borderRadius: '10px', backgroundColor: 'var(--color-paper-subtle)', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-accent)' }}>62%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-ink-muted)' }}>Alex Airtime</div>
                    </div>
                    <div style={{ padding: '0.6rem', borderRadius: '10px', backgroundColor: 'var(--color-paper-subtle)', textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-accent-coral)' }}>38%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-ink-muted)' }}>Priya Airtime</div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'memory' && (
                <>
                  <div className="chat-bubble" style={{ backgroundColor: 'var(--color-paper-card)', borderColor: 'var(--color-accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-accent)', fontWeight: 700, fontSize: '0.78rem' }}>
                      <span>📍</span> Grounded Memory Citation
                    </div>
                    <span style={{ color: 'var(--color-ink)', fontStyle: 'italic' }}>
                      "We decided to keep all diarization embeddings on-device rather than shipping audio to external servers."
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--color-paper-subtle)', color: 'var(--color-ink-muted)' }}>
                        Meeting #1 · Alex Rivera · 08:14
                      </span>
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#10b98118', color: '#10b981', fontWeight: 600 }}>
                        99.2% Match
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-ink-muted)', lineHeight: 1.45, padding: '0.25rem' }}>
                    Ask Vocalis grounds every answer in verifiable timestamps with speaker attribution.
                  </div>
                </>
              )}
            </div>

            {/* Live Harmonic Soundwave Strip */}
            <div
              style={{
                height: '42px',
                width: '100%',
                borderRadius: '12px',
                backgroundColor: 'var(--color-paper-subtle)',
                border: '1px solid var(--color-rule)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <canvas
                ref={visualizerCanvasRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </section>

          {/* Right Side: Hallmark Auth Form Card */}
          <section className="auth-card-wrapper" ref={cardRef}>
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 30,
              }}
            />

            <div className="auth-card">
              {/* Segmented Control Switcher */}
              {mode !== 'forgot-password' && (
                <div className="auth-tab-bar">
                  <button
                    type="button"
                    className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                    onClick={() => {
                      setErrorMessage(null);
                      navigate('/login');
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
                    onClick={() => {
                      setErrorMessage(null);
                      navigate('/signup');
                    }}
                  >
                    Create Account
                  </button>
                </div>
              )}

              {/* Header */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.75rem',
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
                </h2>
                <p style={{ fontSize: '0.86rem', color: 'var(--color-ink-muted)', lineHeight: 1.45 }}>
                  {mode === 'login'
                    ? 'Sign in to access your meetings, grounded memory, and speaker analytics.'
                    : mode === 'signup'
                    ? 'Start capturing high-speed meeting intelligence with zero cloud latency.'
                    : 'Enter your email address to receive password reset instructions.'}
                </p>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="auth-error-banner">
                  <span>⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Form without Placeholders */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {mode === 'signup' && (
                  <div className="auth-input-group">
                    <label className="auth-input-label">Full Name</label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrorMessage(null);
                      }}
                      required
                      disabled={loading}
                      className={`auth-input ${isDevouring ? 'devouring' : ''}`}
                    />
                  </div>
                )}

                <div className="auth-input-group">
                  <label className="auth-input-label">Email Address</label>
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage(null);
                    }}
                    required
                    disabled={loading}
                    className={`auth-input ${isDevouring ? 'devouring' : ''}`}
                  />
                </div>

                {mode !== 'forgot-password' && (
                  <div className="auth-input-group">
                    <div className="auth-input-label">
                      <span>
                        Password{' '}
                        {mode === 'signup' && (
                          <span style={{ fontSize: '0.74rem', fontWeight: 400, color: 'var(--color-ink-subtle)' }}>
                            (min. 6 chars)
                          </span>
                        )}
                      </span>
                      {mode === 'login' && (
                        <span
                          onClick={() => navigate('/forgot-password')}
                          className="auth-link"
                          style={{ fontSize: '0.78rem' }}
                        >
                          Forgot password?
                        </span>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={passwordInputRef}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrorMessage(null);
                        }}
                        required
                        disabled={loading}
                        className={`auth-input ${isDevouring ? 'devouring' : ''}`}
                        style={{ paddingRight: '3.8rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '0.75rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--color-ink-muted)',
                          padding: '0.2rem 0.35rem',
                        }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  ref={submitBtnRef}
                  type="submit"
                  className={`auth-submit-btn ${isDevouring ? 'devouring' : ''}`}
                  disabled={loading}
                  style={{ marginTop: '0.35rem' }}
                >
                  {isDevouring ? (
                    <span>Entering Vocalis...</span>
                  ) : mode === 'login' ? (
                    <span>Sign In →</span>
                  ) : mode === 'signup' ? (
                    <span>Create Account →</span>
                  ) : (
                    <span>Send Reset Link →</span>
                  )}
                </button>
              </form>

              {/* Card Footer Switcher */}
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.84rem',
                  color: 'var(--color-ink-muted)',
                  borderTop: '1px solid var(--color-rule)',
                  paddingTop: '1rem',
                }}
              >
                {mode === 'login' ? (
                  <span>
                    Don't have an account?{' '}
                    <strong
                      onClick={() => {
                        setErrorMessage(null);
                        navigate('/signup');
                      }}
                      className="auth-link"
                    >
                      Sign up free
                    </strong>
                  </span>
                ) : mode === 'signup' ? (
                  <span>
                    Already have an account?{' '}
                    <strong
                      onClick={() => {
                        setErrorMessage(null);
                        navigate('/login');
                      }}
                      className="auth-link"
                    >
                      Sign in
                    </strong>
                  </span>
                ) : (
                  <span
                    onClick={() => {
                      setErrorMessage(null);
                      navigate('/login');
                    }}
                    className="auth-link"
                  >
                    ← Back to Sign in
                  </span>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AuthPages;
