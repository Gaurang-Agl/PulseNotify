import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useAuth } from '../../context/AuthContext';
import { User, Lock, Mail, Shield, UserCheck, Sparkles } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    setIsLoading(true);
    let ok = false;
    if (isRegisterMode) {
      ok = await register(username.trim(), password.trim(), email.trim() || undefined);
    } else {
      ok = await login(username.trim(), password.trim());
    }
    setIsLoading(false);

    if (ok) {
      setUsername('');
      setPassword('');
      setEmail('');
    }
  };

  const handleQuickLogin = async (user: string, pass: string) => {
    setIsLoading(true);
    await login(user, pass);
    setIsLoading(false);
  };

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={closeAuthModal}
      title={isRegisterMode ? 'Create Traveler Account' : 'Authenticate to PulseNotify'}
      subtitle={
        isRegisterMode
          ? 'Sign up to monitor flight prices and receive asynchronous alerts'
          : 'Enter your credentials or choose a pre-configured quick login profile'
      }
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Quick Demo Login Presets */}
        {!isRegisterMode && (
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5 text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
                Quick-Test Profiles:
              </span>
              <span className="text-[11px] text-slate-500 font-mono">1-Click Sign In</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin_user', 'Tester@0555')}
                disabled={isLoading}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-purple-500/40 text-xs font-medium text-slate-200 transition-colors text-left"
              >
                <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-purple-200">admin_user</div>
                  <div className="text-[10px] text-purple-300/80">Admin Role</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('Gaurang', 'Tester@0555')}
                disabled={isLoading}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-200 transition-colors text-left"
              >
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-slate-100">Gaurang</div>
                  <div className="text-[10px] text-slate-400">Regular User</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('regular_user_a', 'Tester@0555')}
                disabled={isLoading}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-200 transition-colors text-left"
              >
                <User className="w-4 h-4 text-sky-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-sky-200">regular_user_a</div>
                  <div className="text-[10px] text-slate-400">Regular User A</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('regular_user_b', 'Tester@0555')}
                disabled={isLoading}
                className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-200 transition-colors text-left"
              >
                <User className="w-4 h-4 text-indigo-400 shrink-0" />
                <div className="truncate">
                  <div className="font-semibold text-indigo-200">regular_user_b</div>
                  <div className="text-[10px] text-slate-400">Regular User B</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. traveler_one"
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
              />
            </div>
          </div>

          {isRegisterMode && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Email (Optional)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="traveler@example.com"
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
              Password {isRegisterMode && '(Min 6 chars)'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
            {isRegisterMode ? 'Create Account & Sign In' : 'Sign In'}
          </Button>
        </form>

        {/* Toggle Register vs Login */}
        <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400">
          {isRegisterMode ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegisterMode(false)}
                className="text-sky-400 hover:underline font-semibold"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Need a new account?{' '}
              <button
                type="button"
                onClick={() => setIsRegisterMode(true)}
                className="text-sky-400 hover:underline font-semibold"
              >
                Register here
              </button>
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};
