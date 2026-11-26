import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { loginApi, registerApi } from '../api/auth';
import { parseApiError } from '../api/client';
import { useToast } from './ToastContext';

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email?: string) => Promise<boolean>;
  logout: () => void;
  switchDemoUser: (targetRole: 'user' | 'admin') => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const { success, error, info } = useToast();

  useEffect(() => {
    // Rehydrate from localStorage
    const savedToken = localStorage.getItem('pulsenotify_token');
    const savedUser = localStorage.getItem('pulsenotify_user');
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('pulsenotify_token');
        localStorage.removeItem('pulsenotify_user');
      }
    }
    setIsLoading(false);
  }, []);

  // Listen for automatic token expiration from axios interceptor
  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setUser(null);
      info('Your session has expired. Please sign in again.');
      setIsAuthModalOpen(true);
    };
    window.addEventListener('pulsenotify:auth_expired', handleExpired);
    return () => window.removeEventListener('pulsenotify:auth_expired', handleExpired);
  }, [info]);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      try {
        const data = await loginApi({ username, password });
        const userProfile: UserProfile = { username: data.username, role: data.role };
        setToken(data.access);
        setUser(userProfile);
        localStorage.setItem('pulsenotify_token', data.access);
        localStorage.setItem('pulsenotify_user', JSON.stringify(userProfile));
        setIsAuthModalOpen(false);
        success(`Welcome back, ${data.username}! (${data.role.toUpperCase()})`);
        return true;
      } catch (err) {
        error(parseApiError(err));
        return false;
      }
    },
    [success, error]
  );

  const register = useCallback(
    async (username: string, password: string, email?: string): Promise<boolean> => {
      try {
        const data = await registerApi({ username, password, email });
        const userProfile: UserProfile = { username: data.username, role: data.role };
        setToken(data.access);
        setUser(userProfile);
        localStorage.setItem('pulsenotify_token', data.access);
        localStorage.setItem('pulsenotify_user', JSON.stringify(userProfile));
        setIsAuthModalOpen(false);
        success(`Account created successfully! Logged in as ${data.username}`);
        return true;
      } catch (err) {
        error(parseApiError(err));
        return false;
      }
    },
    [success, error]
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pulsenotify_token');
    localStorage.removeItem('pulsenotify_user');
    info('Logged out successfully.');
  }, [info]);

  const switchDemoUser = useCallback(
    async (targetRole: 'user' | 'admin') => {
      if (targetRole === 'admin') {
        // Try logging in with demo admin or inform user
        const ok = await login('admin_user', 'AdminPass123!');
        if (!ok) {
          // If password doesn't match default test password, notify user
          info("Demo account 'admin_user' credential check failed. Use Login button with your admin credentials.");
          setIsAuthModalOpen(true);
        }
      } else {
        const ok = await login('Gaurang', 'Tester@0555');
        if (!ok) {
          setIsAuthModalOpen(true);
        }
      }
    },
    [login, info]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isAdmin: user?.role === 'admin',
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        login,
        register,
        logout,
        switchDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
