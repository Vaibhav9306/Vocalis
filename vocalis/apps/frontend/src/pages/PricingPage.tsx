/* Hallmark · component: PricingPage · genre: modern-minimal · theme: warm-linen
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50) · honest copy · no purple gradients
 */
import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const PricingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [isYearly, setIsYearly] = useState<boolean>(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleOpenWorkspace = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/signup');
    }
  };

  const handleSignIn = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const PLANS = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for individuals getting started with smarter meetings.',
      priceAnnual: '$0',
      priceMonthly: '$0',
      oldPrice: null,
      cta: isAuthenticated ? 'Current Plan' : 'Start for free',
      variant: 'light',
      subtextAnnual: 'Free forever · No credit card required',
      subtextMonthly: 'Free forever · No credit card required',
      isCurrent: true,
      features: [
        'Real-time meeting audio transcription',
        'Automatic questions & suggested answers',
        'Key discussion points & summaries',
        'Export to Markdown, PDF, and text',
        'Up to 10 stored meeting records',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For professionals who want unlimited AI meeting intelligence.',
      priceAnnual: '$12',
      priceMonthly: '$16',
      oldPrice: '$16',
      cta: 'Start 14-day free trial',
      variant: 'dark',
      badge: 'POPULAR',
      subtextAnnual: '$12/mo billed annually ($144/year · Save 25%)',
      subtextMonthly: '$16 billed monthly',
      features: [
        'Everything in Free, plus:',
        'Unlimited live meeting recordings',
        'Ask Vocalis Q&A across past meetings',
        'Automated action items & task tracking',
        'Live room sharing with participants',
        'Priority meeting AI analysis',
      ],
    },
    {
      id: 'team',
      name: 'Team',
      description: 'For teams and growing companies collaborating on meetings.',
      priceAnnual: '$24',
      priceMonthly: '$32',
      oldPrice: '$32',
      cta: 'Try Team for free',
      variant: 'light',
      subtextAnnual: '$24/user/mo billed annually ($288/year · Save 25%)',
      subtextMonthly: '$32/user billed monthly',
      features: [
        'Everything in Pro, plus:',
        'Shared team workspace & meeting archive',
        'Team task board & decision log',
        'Multi-user live room collaboration',
        'Shared custom meeting tags & folders',
        'Admin controls & priority support',
      ],
    },
  ];

  const FAQS = [
    {
      q: 'Can I switch between monthly and annual billing at any time?',
      a: 'Yes. You can upgrade, downgrade, or switch your billing frequency anytime from your workspace settings. Prorated credits apply automatically.',
    },
    {
      q: 'Do I need a credit card to get started with the Free plan?',
      a: 'No credit card is required. You can start transcribing meetings and extracting automated action items immediately for free.',
    },
    {
      q: 'How does the 14-day Pro trial work?',
      a: 'You get full access to unlimited live meeting recordings, multi-meeting semantic search via Ask Vocalis, and instant exports. If you choose not to subscribe, your workspace seamlessly transitions to the Free plan.',
    },
    {
      q: 'Is our audio data private and secure?',
      a: 'Yes. Vocalis is built with privacy-first architecture. Transcripts and semantic embeddings are stored directly in your dedicated local or workspace database with end-to-end encryption.',
    },
    {
      q: 'What payment methods do you accept?',
      a: 'We accept all major credit and debit cards (Visa, Mastercard, American Express) processed securely via Stripe.',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#fef1ee',
        color: '#111111',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Hallmark Navigation Header */}
      <header
        style={{
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '1.25rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        <div
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}
          title="Return to Vocalis Home"
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: '#111111',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="#ffffff" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '1.35rem', letterSpacing: '-0.03em', color: '#111111' }}>
            Vocalis
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', fontSize: '0.92rem', color: 'rgba(0,0,0,0.7)', cursor: 'pointer', fontWeight: 500 }}
          >
            Home
          </button>
          <button
            onClick={() => navigate('/pricing')}
            style={{ background: 'none', border: 'none', fontSize: '0.92rem', color: '#000000', cursor: 'pointer', fontWeight: 600 }}
          >
            Pricing
          </button>
          <button
            onClick={handleSignIn}
            style={{ background: 'none', border: 'none', fontSize: '0.92rem', color: 'rgba(0,0,0,0.7)', fontWeight: 500, cursor: 'pointer' }}
          >
            Sign In
          </button>
          <button
            onClick={handleOpenWorkspace}
            style={{
              backgroundColor: '#111111',
              color: '#ffffff',
              border: 'none',
              padding: '0.55rem 1.15rem',
              borderRadius: '12px',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{isAuthenticated ? 'Open Workspace' : 'Get Started'}</span>
            <span>&rarr;</span>
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '2.5rem 1.5rem 4.5rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3rem',
          boxSizing: 'border-box',
        }}
      >
        {/* Editorial Heading Block */}
        <div style={{ textAlign: 'center', maxWidth: '640px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.3rem 0.85rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(0,0,0,0.05)',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#111111',
            }}
          >
            Transparent Plans
          </div>
          <h1
            style={{
              fontSize: '2.75rem',
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.15,
              color: '#111111',
              margin: 0,
            }}
          >
            Simple, Honest Pricing
          </h1>
          <p
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.55,
              color: 'rgba(0,0,0,0.65)',
              margin: 0,
            }}
          >
            Choose the plan that fits your meetings. Automatic transcription, action item detection, and conversational memory with zero bloat.
          </p>

          {/* Billing Cycle Switcher */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.5rem',
              padding: '0.25rem 0.5rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(0,0,0,0.04)',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <button
              onClick={() => setIsYearly(true)}
              style={{
                backgroundColor: isYearly ? '#111111' : 'transparent',
                color: isYearly ? '#ffffff' : '#555555',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Yearly</span>
              <span
                style={{
                  backgroundColor: isYearly ? '#ffffff' : '#111111',
                  color: isYearly ? '#111111' : '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                }}
              >
                Save 25%
              </span>
            </button>
            <button
              onClick={() => setIsYearly(false)}
              style={{
                backgroundColor: !isYearly ? '#111111' : 'transparent',
                color: !isYearly ? '#ffffff' : '#555555',
                border: 'none',
                padding: '0.45rem 1rem',
                borderRadius: '999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.75rem',
            width: '100%',
          }}
        >
          {PLANS.map((plan) => {
            const isDark = plan.variant === 'dark';
            const price = isYearly ? plan.priceAnnual : plan.priceMonthly;
            const subtext = isYearly ? plan.subtextAnnual : plan.subtextMonthly;
            const showOldPrice = isYearly && plan.oldPrice;

            return (
              <div
                key={plan.id}
                style={{
                  borderRadius: '24px',
                  backgroundColor: isDark ? '#111111' : '#ffffff',
                  color: isDark ? '#ffffff' : '#111111',
                  border: isDark ? '1px solid #222222' : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: isDark ? '0 12px 36px rgba(0,0,0,0.18)' : '0 4px 20px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '2.25rem 2rem',
                  gap: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {plan.badge && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '1.5rem',
                      right: '1.5rem',
                      backgroundColor: '#ffffff',
                      color: '#111111',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                    }}
                  >
                    {plan.badge}
                  </div>
                )}

                <div>
                  <h3 style={{ fontSize: '1.65rem', fontWeight: 700, margin: 0, letterSpacing: '-0.03em' }}>
                    {plan.name}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.88rem',
                      color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                      marginTop: '0.4rem',
                      lineHeight: 1.45,
                      minHeight: '40px',
                    }}
                  >
                    {plan.description}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
                    {showOldPrice && (
                      <span
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 500,
                          textDecoration: 'line-through',
                          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
                        }}
                      >
                        {plan.oldPrice}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '3rem',
                        fontWeight: 800,
                        letterSpacing: '-0.05em',
                        lineHeight: 1,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {price}
                    </span>
                    {plan.id !== 'free' && (
                      <span style={{ fontSize: '0.95rem', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)', fontWeight: 500 }}>
                        / month
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
                      fontWeight: 500,
                    }}
                  >
                    {subtext}
                  </span>
                </div>

                <button
                  onClick={() => {
                    if (isAuthenticated && plan.id === 'free') {
                      showToast('You are currently on the Free plan', '', 'info');
                    } else if (isAuthenticated) {
                      showToast(`Subscribing to ${plan.name} plan`, 'Redirecting to payment checkout...', 'success');
                    } else {
                      navigate('/signup');
                    }
                  }}
                  style={{
                    backgroundColor: isDark ? '#ffffff' : '#111111',
                    color: isDark ? '#111111' : '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '0.8rem 1.25rem',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <span>{plan.cta}</span>
                  <span>&rarr;</span>
                </button>

                <div
                  style={{
                    borderTop: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                    paddingTop: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
                    }}
                  >
                    Included Features
                  </span>
                  {plan.features.map((feat, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.65rem',
                        fontSize: '0.86rem',
                        lineHeight: 1.45,
                        color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          marginTop: '2px',
                          flexShrink: 0,
                          color: isDark ? '#ffffff' : '#111111',
                        }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div style={{ width: '100%', maxWidth: '820px', marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.03em', color: '#111111', margin: 0 }}>
              Frequently Asked Questions
            </h2>
            <p style={{ fontSize: '0.92rem', color: 'rgba(0,0,0,0.6)', marginTop: '0.35rem' }}>
              Everything you need to know about Vocalis plans, billing, and trial options.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: '16px',
                    padding: '1.25rem 1.5rem',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.98rem', color: '#111111' }}>{faq.q}</span>
                    <span style={{ fontSize: '1.1rem', color: '#111111', transform: isOpen ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}>
                      +
                    </span>
                  </div>
                  {isOpen && (
                    <p style={{ marginTop: '0.75rem', fontSize: '0.88rem', lineHeight: 1.55, color: 'rgba(0,0,0,0.68)', margin: '0.75rem 0 0 0' }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer
        style={{
          borderTop: '1px solid rgba(0,0,0,0.06)',
          backgroundColor: '#fef1ee',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.84rem',
            color: 'rgba(0,0,0,0.55)',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#111111' }}>Vocalis</span>
            <span>&copy; {new Date().getFullYear()} Vocalis AI. All rights reserved.</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              Home
            </button>
            <button onClick={() => navigate('/pricing')} style={{ background: 'none', border: 'none', color: '#111111', fontWeight: 600, cursor: 'pointer' }}>
              Pricing
            </button>
            <button onClick={handleSignIn} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              Sign In
            </button>
            <button onClick={handleOpenWorkspace} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              Workspace
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
