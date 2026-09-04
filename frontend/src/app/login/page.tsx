'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, User, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../lib/authContext';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        const res = await api.post('/dashboard/auth/register', { username, email, password });
        login(res.data.token, res.data.developer);
      } else {
        const res = await api.post('/dashboard/auth/login', { username, password });
        login(res.data.token, res.data.developer);
      }
      router.push('/');
    } catch (err: any) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Cannot connect to VOLQ-Auth backend at http://localhost:8080. Is the backend server running?');
      } else if (err.response?.status === 500) {
        setError('Backend server error (500). Please check your backend terminal and PostgreSQL connection.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen bg-obsidian-void flex items-center justify-center p-4">
      {/* Background Decorative Glow */}
      <div className="absolute w-96 h-96 bg-brand/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl overflow-hidden p-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brand/10 border border-brand/30 flex items-center justify-center text-brand mb-3 shadow-lg shadow-brand/10">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            VOLQ<span className="text-brand">AUTH</span>
          </h1>
          <p className="text-xs text-text-muted mt-1">
            {isRegister
              ? 'Create a free developer platform account'
              : 'Sign in to access your licensing command center'}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}



        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin or vendor_name"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand/20 transition disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Create Platform Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Toggle Register/Login */}
        <div className="mt-6 pt-4 border-t border-obsidian-border text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-xs text-text-muted hover:text-brand transition"
          >
            {isRegister
              ? 'Already have an account? Sign In'
              : "Don't have an account? Create one for free"}
          </button>
        </div>
      </div>
    </div>
  );
}
