import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { TiltCard, DecryptedText, ShinyText, CountUp } from '../components/motion';

export const LandingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => {
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

  const handleTryLive = () => {
    navigate('/live');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // ===== CONSUMER-FRIENDLY FAQS =====
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const FAQS = [
    {
      q: 'How does Vocalis work during meetings?',
      a: 'Vocalis listens to your meeting in real time through your browser microphone, transcribes what everyone is saying with speaker attribution, and automatically highlights key decisions, questions, and action items so you don’t have to take manual notes.',
    },
    {
      q: 'Can I search and ask questions about past discussions?',
      a: 'Yes. With Ask Vocalis, you can ask natural questions like "What deadline did we agree on for the launch?" and get instant answers referencing the exact moment and speaker in your meeting transcript.',
    },
    {
      q: 'Do I need to install an app or invite a bot to my calls?',
      a: 'No bots or downloads are required. Vocalis runs completely in your web browser. You can start a meeting with one click from any laptop or desktop.',
    },
    {
      q: 'Can I export my notes and transcripts?',
      a: 'Yes. You can export complete meeting summaries, action item task lists, and full transcripts to PDF, Markdown, or plain text, or copy them to your clipboard anytime.',
    },
    {
      q: 'Can I invite teammates to follow a live meeting?',
      a: 'Yes. You can open a live room and share a quick link or code with your colleagues so everyone can follow real-time transcripts, summaries, and action items together.',
    },
    {
      q: 'Is there a free plan?',
      a: 'Yes. You can use Vocalis for free with real-time transcription and automatic summaries without entering a credit card.',
    },
  ];

  // ===== SCENARIOS STATE =====
  const SCENARIO_SLIDES = [
    {
      heading: 'Interviews & Hiring',
      paragraph:
        'Focus on evaluating candidates instead of scribbling notes. Vocalis captures answers word-for-word and highlights key qualifications automatically.',
      features: [
        'Automatic live transcription for every interview',
        'Key candidate answers and points highlighted',
        'Instant shareable summary for your hiring team',
      ],
      image: 'https://framerusercontent.com/images/J8MYD2sMAbepbr2MiuyxCmAYEgk.png',
    },
    {
      heading: 'Client & Sales Calls',
      paragraph:
        'Never miss client requirements or follow-up promises. Get accurate action items and deliverables organized the moment your call wraps up.',
      features: [
        'Capture client requirements accurately',
        'Instant list of follow-up tasks and deadlines',
        'Quick summary ready to send to clients',
      ],
      image: 'https://polo-pecan-73837341.figma.site/_assets/v11/56974c2f2a0bcc77e6331ef7df0ebdd1d7d4d377.png',
    },
    {
      heading: 'Team Syncs & Standups',
      paragraph:
        'Keep everyone aligned without meeting fatigue. Capture blockers, decisions, and task assignments automatically in real time.',
      features: [
        'Live transcript and speaker attribution',
        'Automatic action item tracking with assignees',
        'Broadcast live notes to team members',
      ],
      image: 'https://polo-pecan-73837341.figma.site/_assets/v11/b1bded3078219cd54a5a2fef5cb4919c68e7c261.png',
    },
    {
      heading: '1-on-1s & Reviews',
      paragraph:
        'Stay fully engaged in meaningful conversations. Recall past feedback, agreements, and goals whenever you need them.',
      features: [
        '100% focused conversations without typing',
        'Easily searchable past feedback and goals',
        'Private and secure meeting records',
      ],
      image: 'https://polo-pecan-73837341.figma.site/_assets/v11/1c14b7ac2dcdea9ad19040e054b91f33dd4ed3ec.png',
    },
  ];

  const [scenarioActive, setScenarioActive] = useState(0);
  const [scenarioProgress, setScenarioProgress] = useState(0);
  const scenarioStartTimeRef = useRef<number>(Date.now());
  const SCENARIO_DURATION = 5000;

  useEffect(() => {
    scenarioStartTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - scenarioStartTimeRef.current;
      const progress = Math.min(elapsed / SCENARIO_DURATION, 1);
      setScenarioProgress(progress);

      if (progress >= 1) {
        scenarioStartTimeRef.current = Date.now();
        setScenarioActive((prev) => (prev + 1) % SCENARIO_SLIDES.length);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [scenarioActive, SCENARIO_SLIDES.length]);

  const selectScenario = (index: number) => {
    scenarioStartTimeRef.current = Date.now();
    setScenarioProgress(0);
    setScenarioActive(index);
  };

  // ===== APP PREVIEW SECTION STATE =====
  const APP_ADVERT_SLIDES = [
    {
      bg: 'https://framerusercontent.com/images/qnyDJGivgHQMm5JaWxQxdKn3q0.png',
      heading: 'AI analysis',
      paragraph:
        'Experience effortless meeting notes with Vocalis. Join calls from anywhere, generate real-time transcripts, and review clean action items right when you need them.',
    },
    {
      bg: 'https://polo-pecan-73837341.figma.site/_assets/v11/f71ca5dd250ff31df02f32da412dc606df352cc5.png?w=2191',
      heading: 'In real-time mode',
      paragraph:
        'Turn your everyday voice conversations into organized summaries, actionable next steps, and a searchable memory bank for you and your team.',
    },
  ];

  const [appAdvertActive, setAppAdvertActive] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setAppAdvertActive((prev) => (prev + 1) % APP_ADVERT_SLIDES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [APP_ADVERT_SLIDES.length]);

  // ===== PRICING TIERS =====
  const [isYearly, setIsYearly] = useState(true);

  const PLANS = [
    {
      name: 'Free',
      description: 'Perfect for individuals getting started with smarter meetings.',
      price: '$0',
      monthlyPrice: '$0',
      oldPrice: null,
      cta: 'Get started free',
      variant: 'black',
      subtext: 'Free forever · No credit card required',
      monthlySubtext: 'Free forever · No credit card required',
      features: [
        'Real-time meeting audio transcription',
        'Automatic questions & suggested answers',
        'Key discussion points & summaries',
        'Export to Markdown, PDF, and text',
        'Up to 10 stored meeting records',
      ],
      dark: false,
      ribbon: false,
      onClick: handleGetStarted,
    },
    {
      name: 'Pro',
      description: 'For professionals who want unlimited AI meeting intelligence.',
      price: '$12',
      monthlyPrice: '$16',
      oldPrice: '$16',
      cta: 'Start 14-day free trial',
      variant: 'gradient',
      subtext: '$12/mo billed annually ($144/year · Save 25%)',
      monthlySubtext: '$16 billed monthly',
      features: [
        'Everything in Free, plus:',
        'Unlimited live meeting recordings',
        'Ask Vocalis Q&A across past meetings',
        'Automated action items & task tracking',
        'Live room sharing with participants',
        'Priority meeting AI analysis',
      ],
      dark: true,
      ribbon: true,
      onClick: handleGetStarted,
    },
    {
      name: 'Team',
      description: 'For teams and growing companies collaborating on meetings.',
      price: '$24',
      monthlyPrice: '$32',
      oldPrice: '$32',
      cta: 'Try Team for free',
      variant: 'black',
      subtext: '$24/user/mo billed annually ($288/year · Save 25%)',
      monthlySubtext: '$32/user billed monthly',
      features: [
        'Everything in Pro, plus:',
        'Shared team workspace & meeting archive',
        'Team task board & decision log',
        'Multi-user live room collaboration',
        'Shared custom meeting tags & folders',
        'Admin controls & priority support',
      ],
      dark: false,
      ribbon: false,
      onClick: handleGetStarted,
    },
  ];

  const LOGOS = [
    { src: 'https://framerusercontent.com/images/Qo4XNTbEsI5VNAtleec5o3fWg.png', width: 210 },
    { src: 'https://framerusercontent.com/images/t6BIfZjwwbbizLquISVq96n6EGc.png', width: 210 },
    { src: 'https://framerusercontent.com/images/blfT46mvLdPrSwL7JUMxh1mUVI.png', width: 210 },
    { src: 'https://framerusercontent.com/images/zDwbpG7hVs2UTJsIh3Fwr3eX4E.png', width: 164 },
    { src: 'https://framerusercontent.com/images/F2VMPPEvVSp3zSIiTC7dXDzw.png', width: 210 },
  ];

  return (
    <div className="livo-landing-root">
      <style>{`
        /* ===== LANDING PAGE STYLES ===== */
        .livo-landing-root {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          background-color: rgb(254, 241, 238);
          color: #000;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .livo-landing-root a,
        .livo-landing-root button {
          text-decoration: none !important;
        }

        /* ===== ANIMATIONS ===== */
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-right {
          animation: fadeInRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in {
          animation: fadeIn 0.5s ease forwards;
        }

        /* ===== SECTION 1: HERO ===== */
        .hero-section {
          position: relative;
          width: 100%;
          min-height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          background-color: rgb(254, 241, 238);
        }
        .hero-inner {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 28px;
          flex: 1;
        }

        /* Navbar */
        .landing-navbar {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 64px;
        }
        .landing-navbar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          user-select: none;
        }
        .landing-navbar-logo-icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          overflow: hidden;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(0,0,0,0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000000;
        }
        .landing-navbar-logo-icon svg {
          width: 22px;
          height: 22px;
          fill: #ffffff;
        }
        .landing-navbar-logo-text {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #000;
        }
        .landing-navbar-links {
          display: flex;
          align-items: center;
          gap: 40px;
        }
        .landing-navbar-links button {
          font-size: 16px;
          line-height: 16px;
          font-weight: 500;
          letter-spacing: -0.01em;
          color: #000000;
          background: none;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .landing-navbar-links button:hover {
          opacity: 0.65;
        }
        .landing-navbar-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .navbar-sign-in-btn {
          font-size: 15px;
          font-weight: 600;
          color: #000000;
          background: none;
          border: none;
          cursor: pointer;
          padding: 10px 16px;
          border-radius: 12px;
          transition: background 0.2s, opacity 0.2s;
        }
        .navbar-sign-in-btn:hover {
          background: rgba(0,0,0,0.05);
        }
        .navbar-cta-btn {
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
          background: #000000;
          border: none;
          cursor: pointer;
          padding: 12px 22px;
          border-radius: 14px;
          transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .navbar-cta-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        }

        /* Hero Content */
        .hero-content {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          padding: 88px 64px 64px;
          gap: 48px;
          flex: 1;
        }
        .hero-left {
          max-width: 540px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .hero-heading {
          font-size: 78px;
          line-height: 1.08;
          font-weight: 600;
          letter-spacing: -0.04em;
        }
        .hero-heading-line1 {
          display: block;
          white-space: nowrap;
          background: linear-gradient(105deg, rgb(115,34,237) 0%, rgb(253,135,61) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 2px;
        }
        .hero-heading-line2 {
          display: block;
          color: #000000;
        }
        .hero-paragraph {
          font-size: 18px;
          line-height: 28px;
          font-weight: 500;
          letter-spacing: -0.015em;
          color: rgba(0,0,0,0.85);
          text-wrap: balance;
        }
        .hero-ctas {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Primary CTA with rotating rainbow border */
        .cta-primary-wrapper {
          position: relative;
          padding: 4px;
          display: inline-block;
        }
        .cta-primary-border {
          position: absolute;
          inset: 0;
          border-radius: 22px;
          overflow: hidden;
        }
        .cta-primary-border-inner {
          position: absolute;
          top: -200%;
          left: -250%;
          width: 600%;
          height: 600%;
          background: conic-gradient(from 0deg, rgb(122,50,227) 0%, rgb(253,135,61) 25%, rgb(236,72,153) 50%, rgb(122,50,227) 75%, rgb(253,135,61) 100%);
          animation: spin-slow 3s linear infinite;
        }
        .cta-primary-bg {
          position: absolute;
          inset: 2px;
          border-radius: 20px;
          background: rgb(254,241,238);
        }
        .cta-primary {
          position: relative;
          height: 60px;
          padding: 0 34px;
          border-radius: 18px;
          border: none;
          color: #fff;
          font-weight: 600;
          font-size: 18px;
          line-height: 18px;
          letter-spacing: -0.02em;
          cursor: pointer;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 12px;
          background: linear-gradient(135deg, rgba(122,50,227,1) 0%, rgba(236,72,153,0.95) 50%, rgba(253,135,61,1) 100%);
          transition: transform 0.2s, box-shadow 0.3s;
        }
        .cta-primary:hover {
          transform: scale(1.03);
          box-shadow: 0 8px 32px rgba(122,50,227,0.35), 0 4px 16px rgba(253,135,61,0.25);
        }
        .cta-primary:active {
          transform: scale(0.97);
        }
        .cta-primary-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .cta-primary-circle svg {
          width: 14px;
          height: 14px;
          margin-left: 1px;
        }

        /* Trust Notes */
        .trust-notes {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 24px;
        }
        .trust-notes span {
          font-size: 14px;
          line-height: 14px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: rgba(0,0,0,0.65);
          white-space: nowrap;
        }

        /* Hero Image */
        .hero-right {
          width: 760px;
          flex-shrink: 0;
        }
        .hero-image-container {
          width: 100%;
          aspect-ratio: 3/2;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.12);
        }
        .hero-image-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Offer Strip */
        .offer-strip {
          width: 100%;
          background: rgba(255,255,255,0.88);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
          padding: 48px 40px 32px;
          border-top: 1px solid rgba(0,0,0,0.05);
        }
        .offer-text {
          display: flex;
          align-items: center;
          gap: 18px;
          text-align: center;
        }
        .offer-text span {
          font-size: 16px;
          line-height: 16px;
          font-weight: 500;
          letter-spacing: -0.02em;
          color: #000;
        }
        .offer-text button {
          font-size: 16px;
          line-height: 16px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: rgb(122,50,227);
          background: none;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .offer-text button:hover {
          opacity: 0.7;
        }

        /* Logo Ticker */
        .logo-ticker {
          width: 100%;
          height: 85px;
          overflow: hidden;
          position: relative;
        }
        .logo-ticker-mask {
          position: absolute;
          inset: 0;
          z-index: 10;
          pointer-events: none;
          mask-image: linear-gradient(270deg, transparent 0%, black 4.7%, black 95.3%, transparent 100%);
          -webkit-mask-image: linear-gradient(270deg, transparent 0%, black 4.7%, black 95.3%, transparent 100%);
        }
        .logo-ticker-track {
          display: flex;
          align-items: center;
          gap: 30px;
          height: 100%;
          position: absolute;
          animation: ticker-scroll 18s linear infinite;
        }
        .logo-ticker-track img {
          height: 70px;
          flex-shrink: 0;
          object-fit: contain;
        }

        /* ===== SECTION 2: SCENARIOS ===== */
        .scenarios-section {
          width: 100%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 64px 64px;
          background-color: rgb(254, 241, 238);
        }
        .scenarios-inner {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 60px;
        }
        .scenarios-left {
          width: 540px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 830px;
        }
        .scenarios-left-content {
          display: flex;
          flex-direction: column;
          gap: 36px;
        }
        .scenarios-label {
          font-size: 28px;
          font-weight: 500;
          line-height: 28px;
          letter-spacing: -0.05em;
          background: linear-gradient(to right, #9333ea, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .scenarios-heading-container {
          height: 130px;
          overflow: visible;
        }
        .scenarios-heading {
          font-size: 78px;
          font-weight: 500;
          line-height: 1.05;
          letter-spacing: -0.05em;
          color: #000;
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .scenarios-paragraph-container {
          height: 130px;
        }
        .scenarios-paragraph {
          font-size: 21px;
          line-height: 1.55;
          letter-spacing: -0.02em;
          color: rgba(0,0,0,0.75);
          max-width: 560px;
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .scenarios-features {
          height: 248px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 4px;
        }
        .scenario-feature-card {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #fff;
          border-radius: 18px;
          height: 72px;
          padding: 0 24px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.04);
          animation: fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .scenario-feature-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(to bottom right, #f3e8ff, #fce7f3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .scenario-feature-icon svg {
          width: 18px;
          height: 18px;
          stroke: #9333ea;
          stroke-width: 2.5;
          fill: none;
        }
        .scenario-feature-text {
          font-size: 18px;
          font-weight: 500;
          line-height: 22px;
          color: rgba(0,0,0,0.8);
        }

        /* Pagination */
        .scenarios-pagination {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .pagination-btn {
          position: relative;
          width: 44px;
          height: 44px;
          cursor: pointer;
          border-radius: 50%;
          background: none;
          border: none;
          padding: 0;
        }
        .pagination-btn-inactive {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1px solid rgba(0,0,0,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.2s;
        }
        .pagination-btn-inactive:hover {
          border-color: rgba(0,0,0,0.4);
        }
        .pagination-btn-inactive span {
          font-size: 16px;
          font-weight: 500;
          color: rgba(0,0,0,0.3);
          letter-spacing: -0.05em;
        }
        .pagination-btn-active {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pagination-btn-active span {
          font-size: 16px;
          font-weight: 600;
          color: #000;
          letter-spacing: -0.05em;
          z-index: 1;
        }
        .pagination-btn svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }
        .pagination-btn circle.bg {
          fill: white;
          stroke: rgba(0,0,0,0.06);
          stroke-width: 2.5;
        }
        .pagination-btn circle.progress {
          fill: none;
          stroke: url(#progressGradLanding);
          stroke-width: 2.5;
          stroke-linecap: round;
        }

        /* Scenarios Right */
        .scenarios-right {
          flex: 1;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          height: 830px;
        }
        .scenarios-image-container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          background: #ffffff;
        }
        .scenarios-image {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.7s cubic-bezier(0.44, 0, 0.56, 1), transform 0.7s cubic-bezier(0.44, 0, 0.56, 1);
        }
        .scenarios-image img {
          height: 100%;
          width: auto;
          max-width: none;
          object-fit: contain;
        }

        /* ===== SECTION 3: APP PREVIEW ===== */
        .app-advert-section {
          position: relative;
          width: 100%;
          height: 100vh;
          overflow: hidden;
          display: flex;
          align-items: center;
        }
        .app-advert-bg {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          transition: opacity 0.8s ease-in-out;
        }
        .app-advert-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, rgba(0,0,0,0.72), rgba(0,0,0,0.38), transparent);
        }
        .app-advert-content {
          position: relative;
          z-index: 10;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          padding: 64px;
        }
        .app-advert-inner {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
        }
        .app-advert-text {
          display: flex;
          flex-direction: column;
          gap: 40px;
          max-width: 580px;
        }
        .app-advert-icon {
          width: 84px;
          height: 84px;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 20px 45px rgba(0,0,0,0.4);
          background: #000000;
          border: 1px solid rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .app-advert-icon-svg {
          width: 44px;
          height: 44px;
        }
        .app-advert-heading-group {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .app-advert-heading {
          font-size: 78px;
          line-height: 82px;
          font-weight: 500;
          letter-spacing: -0.05em;
          color: #fff;
          transition: opacity 0.6s, transform 0.6s;
        }
        .app-advert-paragraph {
          font-size: 21px;
          line-height: 30px;
          font-weight: 400;
          letter-spacing: -0.02em;
          color: rgba(255,255,255,0.92);
          transition: opacity 0.5s 0.1s, transform 0.5s 0.1s;
        }
        .app-advert-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 60px;
          padding: 0 28px;
          border-radius: 18px;
          border: none;
          width: fit-content;
          cursor: pointer;
          background: linear-gradient(165deg, rgba(122,50,227,1) 0%, rgba(253,135,61,1) 100%);
          transition: transform 0.2s, box-shadow 0.3s;
        }
        .app-advert-cta:hover {
          transform: scale(1.04);
          box-shadow: 0 8px 30px rgba(122,50,227,0.35);
        }
        .app-advert-cta:active {
          transform: scale(0.97);
        }
        .app-advert-cta svg {
          width: 24px;
          height: 24px;
          stroke: #fff;
          fill: none;
          stroke-width: 2;
        }
        .app-advert-cta span {
          font-size: 18px;
          line-height: 18px;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #fff;
        }

        /* ===== SECTION 4: PRICING ===== */
        .pricing-section {
          width: 100%;
          min-height: 100vh;
          background: #fff;
          display: flex;
          align-items: center;
          padding: 96px 0;
        }
        .pricing-inner {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 64px;
        }
        .pricing-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        .pricing-title {
          font-size: 56px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.04em;
          color: #000;
          text-align: center;
        }
        .pricing-subtitle {
          font-size: 18px;
          color: rgba(0,0,0,0.65);
          text-align: center;
          max-width: 500px;
        }

        /* Billing Toggle */
        .billing-toggle-wrapper {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-top: 12px;
          background: rgba(0,0,0,0.04);
          padding: 6px 14px;
          border-radius: 999px;
        }
        .billing-toggle-label {
          font-size: 15px;
          font-weight: 600;
          line-height: 16px;
          color: #000;
          cursor: pointer;
          transition: opacity 0.25s, color 0.25s;
        }
        .billing-toggle-label.active {
          opacity: 1;
          color: #000;
        }
        .billing-toggle-label.inactive {
          opacity: 0.45;
          color: #000;
        }
        .save-badge {
          display: inline-block;
          background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%);
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          margin-left: 6px;
          vertical-align: middle;
        }
        .billing-toggle-track {
          position: relative;
          width: 48px;
          height: 28px;
          border-radius: 999px;
          padding: 2px;
          cursor: pointer;
          flex-shrink: 0;
          background: linear-gradient(135deg, rgba(122,50,227,1) 0%, rgba(253,135,61,1) 100%);
          transition: box-shadow 0.2s;
        }
        .billing-toggle-track:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .billing-toggle-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .billing-toggle-thumb.monthly {
          transform: translateX(20px);
        }

        /* Pricing Cards */
        .pricing-cards {
          margin-top: 56px;
          display: flex;
          flex-direction: row;
          gap: 24px;
          align-items: stretch;
        }
        .pricing-card {
          flex: 1;
          border-radius: 28px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(0,0,0,0.06);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 36px rgba(0,0,0,0.08);
        }
        .pricing-card-top {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 48px 36px 32px;
          gap: 20px;
          min-height: 360px;
        }
        .pricing-card-top.light {
          background-color: rgb(254, 241, 238);
        }
        .pricing-card-top.dark {
          background-color: #000;
        }
        .pricing-card-bottom {
          display: flex;
          flex-direction: column;
          padding: 36px 36px;
          flex: 1;
        }
        .pricing-card-bottom.light {
          background-color: rgb(252, 225, 224);
        }
        .pricing-card-bottom.dark {
          background-color: rgb(22, 22, 22);
        }

        /* Ribbon */
        .ribbon {
          position: absolute;
          top: 24px;
          right: -32px;
          z-index: 10;
          transform: rotate(45deg);
        }
        .ribbon-inner {
          padding: 6px 36px;
          text-align: center;
          background: linear-gradient(135deg, rgba(122,50,227,1) 0%, rgba(253,135,61,1) 100%);
        }
        .ribbon-inner span {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pricing-plan-name {
          font-size: 44px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.04em;
          text-align: center;
        }
        .pricing-plan-name.light {
          color: #000;
        }
        .pricing-plan-name.dark {
          color: #fff;
        }
        .pricing-description {
          font-size: 15px;
          font-weight: 500;
          line-height: 22px;
          letter-spacing: -0.01em;
          text-align: center;
          min-height: 44px;
        }
        .pricing-description.light {
          color: rgba(0,0,0,0.7);
        }
        .pricing-description.dark {
          color: rgba(255,255,255,0.75);
        }

        .pricing-price-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .pricing-price {
          display: flex;
          align-items: baseline;
          gap: 10px;
        }
        .pricing-price-old {
          font-size: 32px;
          font-weight: 500;
          letter-spacing: -0.04em;
          text-decoration: line-through;
        }
        .pricing-price-old.dark {
          color: rgba(255,255,255,0.4);
        }
        .pricing-price-current {
          font-size: 52px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.05em;
          transition: opacity 0.3s, transform 0.3s;
        }
        .pricing-price-current.light {
          color: #000;
        }
        .pricing-price-current.dark {
          color: #fff;
        }
        .pricing-period {
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -0.01em;
        }
        .pricing-period.light {
          color: rgba(0,0,0,0.6);
        }
        .pricing-period.dark {
          color: rgba(255,255,255,0.6);
        }

        /* Pricing CTA buttons */
        .pricing-cta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 54px;
          width: 100%;
          border-radius: 16px;
          padding: 0 24px;
          border: none;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.3s;
        }
        .pricing-cta:hover {
          transform: scale(1.02);
        }
        .pricing-cta:active {
          transform: scale(0.98);
        }
        .pricing-cta.black {
          background: #000;
        }
        .pricing-cta.black:hover {
          box-shadow: 0 6px 20px rgba(0,0,0,0.18);
        }
        .pricing-cta.gradient {
          background: linear-gradient(165deg, rgba(122,50,227,1) 0%, rgba(253,135,61,1) 100%);
        }
        .pricing-cta.gradient:hover {
          box-shadow: 0 6px 24px rgba(122,50,227,0.28);
        }
        .pricing-cta-circle {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pricing-cta-circle svg {
          width: 14px;
          height: 14px;
          stroke: #fff;
          stroke-width: 2;
          fill: none;
        }
        .pricing-cta span {
          font-size: 16px;
          font-weight: 600;
          line-height: 16px;
          letter-spacing: -0.01em;
          color: #fff;
        }

        .pricing-subtext {
          font-size: 13px;
          font-weight: 500;
          line-height: 18px;
          text-align: center;
          min-height: 20px;
          transition: opacity 0.3s;
        }
        .pricing-subtext.light {
          color: rgba(0,0,0,0.55);
        }
        .pricing-subtext.dark {
          color: rgba(255,255,255,0.6);
        }

        /* Features list */
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .feature-check {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .feature-check.light {
          background: rgba(0,0,0,0.06);
        }
        .feature-check.dark {
          background: rgba(255,255,255,0.12);
        }
        .feature-check svg {
          width: 13px;
          height: 13px;
          stroke-width: 2.5;
          fill: none;
        }
        .feature-check.light svg {
          stroke: rgba(0,0,0,0.75);
        }
        .feature-check.dark svg {
          stroke: #fff;
        }
        .feature-text {
          font-size: 15px;
          font-weight: 500;
          line-height: 20px;
          letter-spacing: -0.01em;
        }
        .feature-text.light {
          color: rgba(0,0,0,0.85);
        }
        .feature-text.dark {
          color: rgba(255,255,255,0.92);
        }

        /* ===== SECTION 5: FAQ ===== */
        .faq-section {
          width: 100%;
          background-color: rgb(254, 241, 238);
          padding: 100px 0;
          display: flex;
          justify-content: center;
        }
        .faq-inner {
          width: 100%;
          max-width: 920px;
          margin: 0 auto;
          padding: 0 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 48px;
        }
        .faq-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-align: center;
        }
        .faq-badge {
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: linear-gradient(to right, #9333ea, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .faq-title {
          font-size: 52px;
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -0.04em;
          color: #000;
        }
        .faq-subtitle {
          font-size: 18px;
          color: rgba(0,0,0,0.65);
          max-width: 580px;
          line-height: 1.55;
        }
        .faq-list {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .faq-card {
          background: #ffffff;
          border-radius: 18px;
          box-shadow: 0 3px 14px rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.06);
          overflow: hidden;
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .faq-card:hover {
          border-color: rgba(122, 50, 227, 0.25);
          box-shadow: 0 6px 20px rgba(0,0,0,0.05);
        }
        .faq-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 22px 28px;
          gap: 20px;
        }
        .faq-question {
          font-size: 18px;
          font-weight: 600;
          line-height: 1.4;
          letter-spacing: -0.015em;
          color: #000000;
        }
        .faq-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0,0,0,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.25s ease;
        }
        .faq-icon svg {
          width: 16px;
          height: 16px;
          stroke: #000;
          stroke-width: 2;
          fill: none;
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .faq-icon.active {
          background: linear-gradient(135deg, rgba(122,50,227,0.15) 0%, rgba(253,135,61,0.15) 100%);
        }
        .faq-icon.active svg {
          transform: rotate(180deg);
          stroke: rgb(122,50,227);
        }
        .faq-body {
          padding: 0 28px 22px;
          font-size: 15px;
          line-height: 1.6;
          color: rgba(0,0,0,0.7);
          animation: fadeInUp 0.3s ease forwards;
        }

        /* ===== FOOTER ===== */
        .landing-footer {
          width: 100%;
          background: #ffffff;
          border-top: 1px solid rgba(0,0,0,0.08);
          padding: 64px 0 36px;
        }
        .landing-footer-inner {
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 64px;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        .landing-footer-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
        }
        .landing-footer-brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .landing-footer-desc {
          font-size: 14px;
          color: rgba(0,0,0,0.6);
        }
        .landing-footer-nav {
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .landing-footer-nav button {
          font-size: 14px;
          font-weight: 500;
          color: rgba(0,0,0,0.7);
          background: none;
          border: none;
          cursor: pointer;
          transition: color 0.2s;
        }
        .landing-footer-nav button:hover {
          color: rgb(122,50,227);
        }
        .landing-footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 24px;
          border-top: 1px solid rgba(0,0,0,0.06);
          font-size: 13px;
          color: rgba(0,0,0,0.45);
          flex-wrap: wrap;
          gap: 16px;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1024px) {
          .landing-navbar {
            padding: 0 40px;
          }
          .landing-navbar-links {
            display: none;
          }
          .hero-content {
            flex-direction: column;
            padding: 60px 40px 60px;
            gap: 48px;
          }
          .hero-left {
            max-width: 100%;
          }
          .hero-heading {
            font-size: 64px;
          }
          .hero-right {
            width: 100%;
          }
          .scenarios-section {
            padding: 48px 40px;
          }
          .scenarios-inner {
            flex-direction: column;
          }
          .scenarios-left {
            width: 100%;
            height: auto;
            gap: 40px;
          }
          .scenarios-right {
            height: 440px;
            width: 100%;
          }
          .scenarios-heading {
            font-size: 62px;
          }
          .scenarios-heading-container {
            height: auto;
            min-height: 80px;
          }
          .scenarios-paragraph {
            font-size: 19px;
          }
          .scenarios-paragraph-container {
            height: auto;
            min-height: 80px;
          }
          .app-advert-content {
            padding: 40px;
          }
          .app-advert-heading {
            font-size: 66px;
            line-height: 70px;
          }
          .app-advert-paragraph {
            font-size: 19px;
            line-height: 27px;
          }
          .pricing-inner {
            padding: 0 40px;
          }
          .pricing-cards {
            flex-direction: column;
          }
          .landing-footer-inner {
            padding: 0 40px;
          }
        }

        @media (max-width: 768px) {
          .landing-navbar {
            padding: 0 20px;
          }
          .landing-navbar-logo-icon {
            width: 36px;
            height: 36px;
            border-radius: 12px;
          }
          .hero-content {
            padding: 40px 20px 48px;
          }
          .hero-heading {
            font-size: 42px;
          }
          .hero-paragraph {
            font-size: 16px;
            line-height: 24px;
          }
          .hero-ctas {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .cta-primary {
            height: 54px;
            padding: 0 24px;
            font-size: 17px;
            justify-content: center;
          }
          .offer-strip {
            padding: 32px 20px;
          }
          .offer-text {
            flex-direction: column;
            gap: 12px;
          }
          .scenarios-section {
            padding: 40px 20px;
          }
          .scenarios-heading {
            font-size: 40px;
          }
          .scenarios-heading-container {
            height: auto;
          }
          .scenarios-paragraph {
            font-size: 16px;
          }
          .scenarios-paragraph-container {
            height: auto;
          }
          .scenarios-right {
            height: 300px;
          }
          .app-advert-content {
            padding: 24px;
          }
          .app-advert-icon {
            width: 68px;
            height: 68px;
            border-radius: 18px;
          }
          .app-advert-heading {
            font-size: 44px;
            line-height: 48px;
          }
          .app-advert-paragraph {
            font-size: 16px;
            line-height: 24px;
          }
          .app-advert-cta {
            height: 52px;
            padding: 0 22px;
          }
          .app-advert-cta svg {
            width: 22px;
            height: 22px;
          }
          .app-advert-cta span {
            font-size: 16px;
          }
          .pricing-inner {
            padding: 0 20px;
          }
          .pricing-title {
            font-size: 36px;
          }
          .pricing-card-top {
            padding: 36px 20px 28px;
          }
          .pricing-card-bottom {
            padding: 26px 20px;
          }
          .pricing-plan-name {
            font-size: 34px;
          }
          .pricing-price-current {
            font-size: 42px;
          }
          .faq-inner {
            padding: 0 20px;
          }
          .faq-title {
            font-size: 34px;
          }
          .faq-card-header {
            padding: 18px 20px;
          }
          .faq-question {
            font-size: 16px;
          }
          .faq-body {
            padding: 0 20px 18px;
          }
          .landing-footer-inner {
            padding: 0 20px;
          }
          .landing-footer-top {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
          }
          .landing-footer-nav {
            flex-wrap: wrap;
            gap: 16px;
          }
        }
      `}</style>

      {/* SVG Defs for gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="progressGradLanding" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>

      {/* ===== SECTION 1: HERO ===== */}
      <section className="hero-section">
        <div className="hero-inner">
          {/* Navbar */}
          <nav className="landing-navbar">
            <div className="landing-navbar-logo" onClick={() => navigate('/')}>
              <div className="landing-navbar-logo-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <span className="landing-navbar-logo-text">Vocalis</span>
            </div>

            <div className="landing-navbar-links">
              <button onClick={() => scrollToSection('scenariosSection')}>
                How it works
              </button>
              <button onClick={() => scrollToSection('appAdvertSection')}>
                Features
              </button>
              <button onClick={() => scrollToSection('pricingSection')}>
                Pricing
              </button>
              <button onClick={() => scrollToSection('faqSection')}>
                FAQ
              </button>
            </div>

            <div className="landing-navbar-actions">
              {!isAuthenticated ? (
                <>
                  <button className="navbar-sign-in-btn" onClick={handleSignIn}>
                    Sign In
                  </button>
                  <button className="navbar-cta-btn" onClick={handleGetStarted}>
                    Get Started
                  </button>
                </>
              ) : (
                <button className="navbar-cta-btn" onClick={() => navigate('/dashboard')}>
                  Dashboard →
                </button>
              )}
            </div>
          </nav>

          {/* Hero Content */}
          <div className="hero-content">
            <div className="hero-left animate-fade-in-up">
              <h1 className="hero-heading">
                <span className="hero-heading-line1">AI analysis</span>
                <span className="hero-heading-line2">for real-time discussions</span>
              </h1>
              <p className="hero-paragraph">
                Vocalis records your meetings, recognizes who's speaking, and provides real-time insights and live recommendations — all without taking manual notes.
              </p>
              <div className="hero-ctas">
                <div className="cta-primary-wrapper">
                  <div className="cta-primary-border">
                    <div className="cta-primary-border-inner" />
                  </div>
                  <div className="cta-primary-bg" />
                  <button className="cta-primary" onClick={handleGetStarted}>
                    <span className="cta-primary-circle">
                      <svg viewBox="0 0 14 14" fill="none">
                        <path
                          d="M3 7h8m0 0L8 4m3 3L8 10"
                          stroke="white"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <ShinyText text={isAuthenticated ? 'Open Dashboard' : 'Start for free'} speed="3.5s" color="#ffffff" shineColor="rgba(255,255,255,0.85)" />
                  </button>
                </div>
              </div>
              <div className="trust-notes">
                <span>&bull; Free to start</span>
                <span>&bull; No credit card required</span>
                <span>&bull; Cancel anytime</span>
              </div>
            </div>
            <div className="hero-right animate-fade-in-right">
              <div className="hero-image-container">
                <img
                  src="https://framerusercontent.com/images/b4pOG23X1MeuH63d5Dmm4HFLVA.png"
                  alt="Vocalis AI interface"
                />
              </div>
            </div>
          </div>

          {/* High-Trust Live Stats Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '3rem',
              padding: '20px 32px',
              backgroundColor: 'rgba(255,255,255,0.75)',
              backdropFilter: 'blur(12px)',
              borderRadius: '20px',
              border: '1px solid rgba(0,0,0,0.06)',
              margin: '0 64px 32px',
              flexWrap: 'wrap',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#000', letterSpacing: '-0.03em' }}>
                <CountUp end={54200} duration={2} separator="," />+
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                Minutes Transcribed
              </div>
            </div>
            <div style={{ width: '1px', height: '32px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#000', letterSpacing: '-0.03em' }}>
                <CountUp end={99.4} decimals={1} duration={2} />%
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                Speaker Precision
              </div>
            </div>
            <div style={{ width: '1px', height: '32px', backgroundColor: 'rgba(0,0,0,0.1)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#000', letterSpacing: '-0.03em' }}>
                0ms
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>
                Local Engine Latency
              </div>
            </div>
          </div>

          {/* Offer Strip */}
          <div className="offer-strip">
            <div className="offer-text">
              <span>Enjoy 25% off when billed annually — start recording meetings in seconds</span>
              <button onClick={() => scrollToSection('pricingSection')}>See pricing plans</button>
            </div>
            <div className="logo-ticker">
              <div className="logo-ticker-mask" />
              <div className="logo-ticker-track">
                {[...LOGOS, ...LOGOS, ...LOGOS].map((logo, index) => (
                  <img
                    key={index}
                    src={logo.src}
                    style={{ width: `${logo.width}px` }}
                    alt=""
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 2: SCENARIOS ===== */}
      <section className="scenarios-section" id="scenariosSection">
        <div className="scenarios-inner">
          <div className="scenarios-left">
            <div className="scenarios-left-content">
              <span className="scenarios-label animate-fade-in">
                <DecryptedText text="How it works" triggerOnHover={true} />
              </span>
              <div className="scenarios-heading-container">
                <h2 className="scenarios-heading" key={`heading-${scenarioActive}`}>
                  {SCENARIO_SLIDES[scenarioActive].heading}
                </h2>
              </div>
              <div className="scenarios-paragraph-container">
                <p className="scenarios-paragraph" key={`para-${scenarioActive}`}>
                  {SCENARIO_SLIDES[scenarioActive].paragraph}
                </p>
              </div>
              <div className="scenarios-features" key={`feat-${scenarioActive}`}>
                {SCENARIO_SLIDES[scenarioActive].features.map((feature, i) => (
                  <div
                    key={i}
                    className="scenario-feature-card"
                    style={{ animationDelay: `${0.15 + i * 0.08}s` }}
                  >
                    <div className="scenario-feature-icon">
                      <svg viewBox="0 0 24 24">
                        <polyline
                          points="20 6 9 17 4 12"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="scenario-feature-text">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination with Circular Progress */}
            <div className="scenarios-pagination">
              {SCENARIO_SLIDES.map((_, i) => {
                const label = String(i + 1).padStart(2, '0');
                const isActive = i === scenarioActive;
                return (
                  <button
                    key={i}
                    className="pagination-btn"
                    onClick={() => selectScenario(i)}
                    aria-label={`Go to slide ${i + 1}`}
                  >
                    {isActive ? (
                      <>
                        <svg viewBox="0 0 44 44">
                          <circle className="bg" cx="22" cy="22" r="20" />
                          <circle
                            className="progress"
                            cx="22"
                            cy="22"
                            r="20"
                            strokeDasharray={`${scenarioProgress * 125.66} 125.66`}
                          />
                        </svg>
                        <div className="pagination-btn-active">
                          <span>{label}</span>
                        </div>
                      </>
                    ) : (
                      <div className="pagination-btn-inactive">
                        <span>{label}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="scenarios-right">
            <div className="scenarios-image-container">
              {SCENARIO_SLIDES.map((slide, idx) => (
                <div
                  key={idx}
                  className="scenarios-image"
                  style={{
                    opacity: idx === scenarioActive ? 1 : 0,
                    transform: idx === scenarioActive ? 'translateX(0) scale(1)' : 'translateX(50px) scale(0.97)',
                    pointerEvents: idx === scenarioActive ? 'auto' : 'none',
                  }}
                >
                  <img src={slide.image} alt={slide.heading} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 3: APP PREVIEW ===== */}
      <section className="app-advert-section" id="appAdvertSection">
        <div
          className="app-advert-bg"
          style={{
            backgroundImage: `url('${APP_ADVERT_SLIDES[0].bg}')`,
            opacity: appAdvertActive === 0 ? 1 : 0,
          }}
        />
        <div
          className="app-advert-bg"
          style={{
            backgroundImage: `url('${APP_ADVERT_SLIDES[1].bg}')`,
            opacity: appAdvertActive === 1 ? 1 : 0,
          }}
        />
        <div className="app-advert-overlay" />
        <div className="app-advert-content">
          <div className="app-advert-inner">
            <div className="app-advert-text">
              <div className="app-advert-icon">
                <svg className="app-advert-icon-svg" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="10" fill="url(#iconGradientPreview)" />
                  <path d="M16 7a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0v-5a4 4 0 0 0-4-4z" fill="#ffffff"/>
                  <path d="M23 15v1a7 7 0 0 1-14 0v-1M16 23v4M12 27h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="iconGradientPreview" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#7a32e3"/>
                      <stop offset="1" stopColor="#fd873d"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="app-advert-heading-group">
                <h2 className="app-advert-heading" key={`adv-head-${appAdvertActive}`}>
                  {APP_ADVERT_SLIDES[appAdvertActive].heading}
                </h2>
                <p className="app-advert-paragraph" key={`adv-para-${appAdvertActive}`}>
                  {APP_ADVERT_SLIDES[appAdvertActive].paragraph}
                </p>
              </div>
              <button className="app-advert-cta" onClick={handleTryLive}>
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
                <span>Try Live Meeting Now</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECTION 4: PRICING ===== */}
      <section className="pricing-section" id="pricingSection">
        <div className="pricing-inner">
          <div className="pricing-header">
            <h2 className="pricing-title">Simple, Transparent Pricing</h2>
            <p className="pricing-subtitle">
              Choose the plan that fits your meetings. Upgrade or cancel anytime.
            </p>
            <div className="billing-toggle-wrapper">
              <span
                className={`billing-toggle-label ${isYearly ? 'active' : 'inactive'}`}
                onClick={() => setIsYearly(true)}
              >
                Yearly <span className="save-badge">Save 25%</span>
              </span>
              <div
                className="billing-toggle-track"
                onClick={() => setIsYearly(!isYearly)}
                role="button"
                tabIndex={0}
                aria-label="Toggle annual or monthly billing"
              >
                <div className={`billing-toggle-thumb ${!isYearly ? 'monthly' : ''}`} />
              </div>
              <span
                className={`billing-toggle-label ${!isYearly ? 'active' : 'inactive'}`}
                onClick={() => setIsYearly(false)}
              >
                Monthly
              </span>
            </div>
          </div>

          <div className="pricing-cards">
            {PLANS.map((plan, i) => {
              const theme = plan.dark ? 'dark' : 'light';
              const displayPrice = isYearly ? plan.price : plan.monthlyPrice;
              const displaySubtext = isYearly ? plan.subtext : plan.monthlySubtext;
              const showOldPrice = isYearly && plan.oldPrice;

              return (
                <TiltCard
                  key={i}
                  maxTilt={6}
                  scale={1.02}
                  glareOpacity={plan.dark ? 0.12 : 0.06}
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <div
                    className="pricing-card"
                    style={{ animationDelay: `${0.1 + i * 0.12}s`, height: '100%' }}
                  >
                    <div className={`pricing-card-top ${theme}`}>
                      {plan.ribbon && (
                        <div className="ribbon">
                          <div className="ribbon-inner">
                            <span>Popular</span>
                          </div>
                        </div>
                      )}
                      <h3 className={`pricing-plan-name ${theme}`}>{plan.name}</h3>
                      <p className={`pricing-description ${theme}`}>{plan.description}</p>
                      
                      <div className="pricing-price-box">
                        <div className="pricing-price">
                          {showOldPrice && (
                            <span className={`pricing-price-old ${theme}`}>{plan.oldPrice}</span>
                          )}
                          <span className={`pricing-price-current ${theme}`}>{displayPrice}</span>
                          {plan.price !== '$0' && (
                            <span className={`pricing-period ${theme}`}>/mo</span>
                          )}
                        </div>
                      </div>

                      <button
                        className={`pricing-cta ${plan.variant}`}
                        onClick={plan.onClick}
                      >
                        <div className="pricing-cta-circle">
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M7 17L17 7M17 7H7M17 7V17"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        {plan.dark ? (
                          <ShinyText text={plan.cta} speed="3s" color="#ffffff" />
                        ) : (
                          <span>{plan.cta}</span>
                        )}
                      </button>
                      <span className={`pricing-subtext ${theme}`}>{displaySubtext}</span>
                    </div>

                    <div className={`pricing-card-bottom ${theme}`}>
                      <div className="feature-list">
                        {plan.features.map((f, fIdx) => (
                          <div key={fIdx} className="feature-item">
                            <div className={`feature-check ${theme}`}>
                              <svg viewBox="0 0 24 24">
                                <polyline
                                  points="20 6 9 17 4 12"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </div>
                            <span className={`feature-text ${theme}`}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== SECTION 5: FAQ ===== */}
      <section className="faq-section" id="faqSection">
        <div className="faq-inner">
          <div className="faq-header">
            <span className="faq-badge">
              <DecryptedText text="Got Questions?" triggerOnHover={true} />
            </span>
            <h2 className="faq-title">Frequently Asked Questions</h2>
            <p className="faq-subtitle">
              Everything you need to know about getting started with Vocalis.
            </p>
          </div>

          <div className="faq-list">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="faq-card"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                >
                  <div className="faq-card-header">
                    <h3 className="faq-question">{faq.q}</h3>
                    <div className={`faq-icon ${isOpen ? 'active' : ''}`}>
                      <svg viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="faq-body">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== MINIMAL CLEAN FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-top">
            <div className="landing-footer-brand">
              <div className="landing-navbar-logo" onClick={() => navigate('/')}>
                <div className="landing-navbar-logo-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <span className="landing-navbar-logo-text">Vocalis</span>
              </div>
              <span className="landing-footer-desc">
                AI meeting notes, real-time transcription, and automated action items.
              </span>
            </div>

            <div className="landing-footer-nav">
              <button onClick={() => scrollToSection('scenariosSection')}>How it works</button>
              <button onClick={() => scrollToSection('appAdvertSection')}>Features</button>
              <button onClick={() => scrollToSection('pricingSection')}>Pricing</button>
              <button onClick={() => scrollToSection('faqSection')}>FAQ</button>
              {!isAuthenticated ? (
                <>
                  <button onClick={handleSignIn}>Sign In</button>
                  <button onClick={handleGetStarted}>Get Started</button>
                </>
              ) : (
                <button onClick={() => navigate('/dashboard')}>Dashboard →</button>
              )}
            </div>
          </div>

          <div className="landing-footer-bottom">
            <span>&copy; {new Date().getFullYear()} Vocalis. All rights reserved.</span>
            <span>Private and intelligent meeting notes.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
