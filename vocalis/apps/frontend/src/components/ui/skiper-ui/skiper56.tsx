import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from '../../../context/RouterContext';
import { useToast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils';

interface Particle {
  x: number;
  y: number;
  r: number;
  color: string;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

export const Skiper56: React.FC<{
  initialMode?: 'login' | 'signup' | 'forgot-password';
  onSuccess?: () => void;
}> = ({ initialMode = 'login', onSuccess }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'forgot-password'>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { login, register } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode]);

  // Particle System Canvas animation
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
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= 1;

        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color.replace('ALPHA', alpha.toString());
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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

  const triggerVanishParticles = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const colors = [
      'rgba(122, 50, 227, ALPHA)',
      'rgba(253, 135, 61, ALPHA)',
      'rgba(236, 72, 153, ALPHA)',
      'rgba(99, 102, 241, ALPHA)',
    ];

    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 2;
      particlesRef.current.push({
        x,
        y,
        r: Math.random() * 2.5 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40 + Math.random() * 20,
        maxLife: 60,
      });
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

    // Trigger Particle burst at button position
    if (cardRef.current && canvasRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      triggerVanishParticles(rect.width / 2, rect.height - 40);
    }

    if (activeTab === 'forgot-password') {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        showToast('Password reset link sent', `Check your inbox at ${trimmedEmail}`, 'info');
        setActiveTab('login');
      }, 500);
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password');
      showToast('Please enter your password', '', 'warning');
      return;
    }

    if (activeTab === 'signup' && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long');
      showToast('Password too short', 'Must be at least 6 characters', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'signup') {
        const user = await register(trimmedEmail, password, name.trim());
        showToast('Account created successfully!', `Welcome to Vocalis, ${user.name}`, 'success');
        if (onSuccess) onSuccess();
        else navigate('/dashboard');
      } else {
        const user = await login(trimmedEmail, password);
        showToast('Signed in successfully', `Welcome back, ${user.name}`, 'success');
        if (onSuccess) onSuccess();
        else navigate('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setErrorMessage(msg);
      showToast('Authentication Error', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full max-w-[440px] mx-auto select-none" ref={cardRef}>
      {/* Background Particle Canvas */}
      <canvas
        ref={canvasRef}
        width={440}
        height={580}
        className="pointer-events-none absolute inset-0 z-20"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Main Glass Morphic Card Container */}
      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-[28px] border border-black/10 dark:border-white/15',
          'bg-white/95 dark:bg-[#121216]/95 backdrop-blur-xl',
          'p-8 shadow-[0_20px_50px_rgba(0,0,0,0.1),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]',
        )}
      >
        {/* Animated Tab Switcher (Devouring Details Segmented Control) */}
        {activeTab !== 'forgot-password' && (
          <div className="relative mb-6 flex rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] p-1 border border-black/[0.05] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
              }}
              className={cn(
                'relative flex-1 py-2.5 text-sm font-semibold transition-colors duration-200 z-10',
                activeTab === 'login'
                  ? 'text-black dark:text-white'
                  : 'text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80',
              )}
            >
              Sign In
              {activeTab === 'login' && (
                <motion.div
                  layoutId="skiper56ActiveTab"
                  className="absolute inset-0 rounded-xl bg-white dark:bg-[#22222a] shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setErrorMessage(null);
              }}
              className={cn(
                'relative flex-1 py-2.5 text-sm font-semibold transition-colors duration-200 z-10',
                activeTab === 'signup'
                  ? 'text-black dark:text-white'
                  : 'text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80',
              )}
            >
              Create Account
              {activeTab === 'signup' && (
                <motion.div
                  layoutId="skiper56ActiveTab"
                  className="absolute inset-0 rounded-xl bg-white dark:bg-[#22222a] shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}
            </button>
          </div>
        )}

        {/* Form Title & Subtitle */}
        <div className="mb-6 text-center">
          <motion.h2
            key={activeTab + '-title'}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold tracking-tight text-black dark:text-white"
          >
            {activeTab === 'login'
              ? 'Welcome back'
              : activeTab === 'signup'
              ? 'Join Vocalis'
              : 'Reset Password'}
          </motion.h2>
          <motion.p
            key={activeTab + '-subtitle'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-1.5 text-xs text-black/60 dark:text-white/60"
          >
            {activeTab === 'login'
              ? 'Access real-time transcription, insights, and sync.'
              : activeTab === 'signup'
              ? 'Smart AI notes for your browser and desktop meetings.'
              : 'Enter your email to receive recovery instructions.'}
          </motion.p>
        </div>

        {/* Error Banner */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-xs font-medium text-red-600 dark:text-red-400"
            >
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {activeTab === 'signup' && (
              <motion.div
                key="name-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex flex-col gap-1.5 overflow-hidden"
              >
                <label className="text-xs font-semibold text-black/80 dark:text-white/80">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Jane Doe"
                  required
                  className={cn(
                    'w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04]',
                    'px-3.5 py-2.5 text-sm text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35',
                    'transition-all duration-200 focus:border-[#7a32e3] focus:bg-white dark:focus:bg-[#1a1a22] focus:outline-none focus:ring-2 focus:ring-[#7a32e3]/20',
                  )}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-black/80 dark:text-white/80">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="name@company.com"
              required
              className={cn(
                'w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04]',
                'px-3.5 py-2.5 text-sm text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35',
                'transition-all duration-200 focus:border-[#7a32e3] focus:bg-white dark:focus:bg-[#1a1a22] focus:outline-none focus:ring-2 focus:ring-[#7a32e3]/20',
              )}
            />
          </div>

          {/* Password Field */}
          {activeTab !== 'forgot-password' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-black/80 dark:text-white/80">
                  Password
                </label>
                {activeTab === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot-password');
                      setErrorMessage(null);
                    }}
                    className="text-xs font-medium text-[#7a32e3] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder={activeTab === 'signup' ? 'Min. 6 characters' : '••••••••'}
                  required
                  className={cn(
                    'w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.04]',
                    'px-3.5 py-2.5 pr-12 text-sm text-black dark:text-white placeholder:text-black/35 dark:placeholder:text-white/35',
                    'transition-all duration-200 focus:border-[#7a32e3] focus:bg-white dark:focus:bg-[#1a1a22] focus:outline-none focus:ring-2 focus:ring-[#7a32e3]/20',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/40 dark:text-white/40 hover:text-black/70 dark:hover:text-white/70"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button with Gradient & Scale Animation */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className={cn(
              'mt-2 relative w-full overflow-hidden rounded-xl py-3 text-sm font-semibold text-white',
              'bg-gradient-to-r from-[#7a32e3] via-[#a855f7] to-[#fd873d]',
              'shadow-[0_8px_20px_rgba(122,50,227,0.3)] hover:shadow-[0_12px_28px_rgba(122,50,227,0.45)]',
              'transition-shadow duration-200 disabled:opacity-70 disabled:cursor-not-allowed',
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </span>
            ) : activeTab === 'login' ? (
              <span>Sign In →</span>
            ) : activeTab === 'signup' ? (
              <span>Create Account →</span>
            ) : (
              <span>Send Reset Link →</span>
            )}
          </motion.button>
        </form>

        {/* Footer Link Switcher */}
        {activeTab === 'forgot-password' && (
          <div className="mt-6 text-center text-xs text-black/60 dark:text-white/60">
            Remember your password?{' '}
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setErrorMessage(null);
              }}
              className="font-semibold text-[#7a32e3] hover:underline"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Skiper56;
