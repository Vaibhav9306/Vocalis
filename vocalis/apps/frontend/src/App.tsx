import React, { useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RouterProvider, useRouter } from './context/RouterContext';
import { SmoothScrollProvider } from './context/SmoothScrollProvider';
import { AppShell } from './components/AppShell';

// Pages
import { LandingPage } from './pages/LandingPage';
import { AuthPages } from './pages/AuthPages';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { MeetingsPage } from './pages/MeetingsPage';
import { MeetingDetailPage } from './pages/MeetingDetailPage';
import { LiveMeetingPage } from './pages/LiveMeetingPage';
import { AskScribePage } from './pages/AskScribePage';
import { TasksPage } from './pages/TasksPage';
import { RoomsPage } from './pages/RoomsPage';
import { CalendarPage } from './pages/CalendarPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { SettingsPage } from './pages/SettingsPage';
import { PricingPage } from './pages/PricingPage';
import { MeetingCopilotOverlay } from './pages/MeetingCopilotOverlay';

const AppContent: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const { isAuthenticated } = useAuth();

  // Public / Standalone routes that do not require authentication
  const isPublicRoute =
    currentPath === '/' ||
    currentPath === '/login' ||
    currentPath === '/signup' ||
    currentPath === '/forgot-password' ||
    currentPath === '/pricing' ||
    currentPath === '/overlay/copilot';

  // Route Guard: Protected routes require authentication
  useEffect(() => {
    if (!isAuthenticated && !isPublicRoute) {
      navigate('/login');
    } else if (isAuthenticated && (currentPath === '/login' || currentPath === '/signup')) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isPublicRoute, currentPath, navigate]);

  // If unauthenticated visitor attempts to access protected routes, render login to avoid UI flash
  if (!isAuthenticated && !isPublicRoute) {
    return <AuthPages mode="login" />;
  }

  // Standalone Marketing, Auth, & Overlay Pages (no AppShell sidebar)
  if (currentPath === '/overlay/copilot') {
    return <MeetingCopilotOverlay />;
  }
  if (currentPath === '/') {
    return <LandingPage />;
  }
  if (currentPath === '/pricing') {
    return <PricingPage />;
  }
  if (currentPath === '/login') {
    return <AuthPages mode="login" />;
  }
  if (currentPath === '/signup') {
    return <AuthPages mode="signup" />;
  }
  if (currentPath === '/forgot-password') {
    return <AuthPages mode="forgot-password" />;
  }
  if (currentPath === '/onboarding') {
    return <OnboardingPage />;
  }

  // Core SaaS Product Workspace (wrapped in AppShell)
  let pageComponent: React.ReactNode;

  if (currentPath === '/dashboard') {
    pageComponent = <DashboardPage />;
  } else if (currentPath === '/meetings') {
    pageComponent = <MeetingsPage />;
  } else if (currentPath.startsWith('/meetings/')) {
    pageComponent = <MeetingDetailPage />;
  } else if (currentPath === '/live' || currentPath.startsWith('/live/')) {
    pageComponent = <LiveMeetingPage />;
  } else if (currentPath === '/memory') {
    pageComponent = <SettingsPage defaultTab="memory" />;
  } else if (currentPath === '/ask') {
    pageComponent = <AskScribePage />;
  } else if (currentPath === '/tasks') {
    pageComponent = <TasksPage />;
  } else if (currentPath === '/decisions') {
    pageComponent = <SettingsPage defaultTab="decisions" />;
  } else if (currentPath === '/rooms') {
    pageComponent = <RoomsPage />;
  } else if (currentPath === '/calendar') {
    pageComponent = <CalendarPage />;
  } else if (currentPath === '/workspace') {
    pageComponent = <WorkspacePage />;
  } else if (currentPath.startsWith('/settings')) {
    pageComponent = <SettingsPage />;
  } else {
    // Default fallback to Dashboard
    pageComponent = <DashboardPage />;
  }

  return <AppShell>{pageComponent}</AppShell>;
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider>
            <SmoothScrollProvider>
              <AppContent />
            </SmoothScrollProvider>
          </RouterProvider>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
