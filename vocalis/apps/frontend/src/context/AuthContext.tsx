import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Workspace, OnboardingState } from '@meeting-assistant/shared-types';
import { loginUser, registerUser } from '../services/apiClient';

interface AuthContextType {
  user: User | null;
  workspace: Workspace | null;
  onboarding: OnboardingState;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name?: string) => Promise<User>;
  logout: () => void;
  updateOnboarding: (updates: Partial<OnboardingState>) => void;
  switchWorkspace: (workspace: Workspace) => void;
}

const DEFAULT_WORKSPACE: Workspace = {
  id: 'ws-default-001',
  name: 'Vocalis Workspace',
  slug: 'vocalis-workspace',
  type: 'team',
  retentionDays: 90,
  membersCount: 1,
  createdAt: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('vocalis_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [workspace, setWorkspace] = useState<Workspace | null>(() => {
    const saved = localStorage.getItem('vocalis_workspace');
    return saved ? JSON.parse(saved) : DEFAULT_WORKSPACE;
  });

  const [onboarding, setOnboarding] = useState<OnboardingState>(() => {
    const saved = localStorage.getItem('vocalis_onboarding');
    return saved
      ? JSON.parse(saved)
      : {
          completed: true,
          step: 5,
          useCase: 'Meetings & Strategy',
          priority: 'Accurate transcription & summaries',
          workspaceName: 'Vocalis Workspace',
        };
  });

  useEffect(() => {
    if (user) localStorage.setItem('vocalis_user', JSON.stringify(user));
    else localStorage.removeItem('vocalis_user');
  }, [user]);

  useEffect(() => {
    if (workspace) localStorage.setItem('vocalis_workspace', JSON.stringify(workspace));
    else localStorage.removeItem('vocalis_workspace');
  }, [workspace]);

  useEffect(() => {
    localStorage.setItem('vocalis_onboarding', JSON.stringify(onboarding));
  }, [onboarding]);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await loginUser(email, password);
    if (res.error || !res.user) {
      throw new Error(res.error || 'Authentication failed');
    }
    setUser(res.user);
    return res.user;
  };

  const register = async (email: string, password: string, name?: string): Promise<User> => {
    const res = await registerUser(email, name || email.split('@')[0], password);
    if (res.error || !res.user) {
      throw new Error(res.error || 'Registration failed');
    }
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('vocalis_user');
  };

  const updateOnboarding = (updates: Partial<OnboardingState>) => {
    setOnboarding((prev) => ({ ...prev, ...updates }));
  };

  const switchWorkspace = (ws: Workspace) => {
    setWorkspace(ws);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        onboarding,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateOnboarding,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
