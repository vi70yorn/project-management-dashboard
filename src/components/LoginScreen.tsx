import React, { useState } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  FolderKanban,
  ArrowRight,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
} from 'lucide-react';
import { AuthUser, TeamMember } from '../types';
import { loginApi } from '../services/api';
import { FORM_STYLES } from '../utils/formStyles';

interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
  teamMembers?: TeamMember[];
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  teamMembers = [],
  theme = 'light',
  onToggleTheme,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMsg('Please enter your username');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      // Authenticate strictly with PostgreSQL database via backend API
      const res = await loginApi(cleanUsername, password);
      if (res && res.user) {
        onLogin(res.user);
        return;
      }
      setErrorMsg('Invalid username or password. Please check your credentials.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid username or password. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-300">
      {/* Background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top-right theme toggle */}
      {onToggleTheme && (
        <button
          id="login-theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-amber-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all cursor-pointer"
          aria-label="Toggle theme mode"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      )}

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white p-7 text-center relative border-b border-slate-800/50">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg ring-4 ring-blue-500/20 mb-3">
            <FolderKanban className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">EASY MANAGE</h1>
          <p className="text-xs text-slate-300 dark:text-slate-400 mt-1">
            Sign in to access your projects and task deliverables
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-7 space-y-5">
          {errorMsg && (
            <div
              id="login-error-alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 rounded-xl text-xs font-medium flex items-center gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username input */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="Enter username (e.g. vichet or vetji)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={FORM_STYLES.inputWithIcon}
                />
              </div>
            </div>

            {/* Password input with show/hide eye icon */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${FORM_STYLES.inputWithIcon} pr-10`}
                />
                <button
                  type="button"
                  id="toggle-login-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
