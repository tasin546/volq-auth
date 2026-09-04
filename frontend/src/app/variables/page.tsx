'use client';

import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Key, Eye, EyeOff, Lock, Unlock, X } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';
import { Variable } from '../../lib/types';

export default function VariablesPage() {
  const { selectedApp } = useAuth();
  const [variables, setVariables] = useState<Variable[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [varKey, setVarKey] = useState('');
  const [varValue, setVarValue] = useState('');
  const [minTier, setMinTier] = useState(0);
  const [isSecret, setIsSecret] = useState(true);
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    if (selectedApp) {
      fetchVariables();
    }
  }, [selectedApp]);

  const fetchVariables = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.get(`/dashboard/apps/${selectedApp.id}/variables`);
      setVariables(res.data || []);
    } catch (err) {
      console.error('Failed to load variables', err);
    }
  };

  const handleSaveVariable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setLoading(true);
    try {
      await api.post(`/dashboard/apps/${selectedApp.id}/variables`, {
        var_key: varKey,
        var_value: varValue,
        min_tier_level: Number(minTier),
        is_secret: isSecret,
      });
      setModalOpen(false);
      setVarKey('');
      setVarValue('');
      fetchVariables();
    } catch (err) {
      console.error('Failed to save variable', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteVariable = async (varId: string) => {
    if (!confirm('Permanently delete this remote variable?')) return;
    try {
      await api.delete(`/dashboard/apps/${selectedApp?.id}/variables/${varId}`);
      fetchVariables();
    } catch (err) {
      console.error('Failed to delete variable', err);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Encrypted Remote Variables</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Securely stream sensitive API keys, strings, and endpoints directly to client memory
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Variable</span>
          </button>
        </div>

        {/* Variables Table */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-void/60 border-b border-obsidian-border text-text-muted font-mono text-[11px]">
              <tr>
                <th className="px-6 py-3.5 font-medium">VARIABLE KEY</th>
                <th className="px-6 py-3.5 font-medium">VALUE</th>
                <th className="px-6 py-3.5 font-medium">ACCESS LEVEL</th>
                <th className="px-6 py-3.5 font-medium">MIN TIER</th>
                <th className="px-6 py-3.5 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border/50">
              {variables.map((v) => (
                <tr key={v.id} className="hover:bg-obsidian-hover/40 transition">
                  <td className="px-6 py-4 font-mono font-semibold text-text-primary">{v.var_key}</td>
                  <td className="px-6 py-4 font-mono text-text-muted">
                    <div className="flex items-center gap-2">
                      <span>{revealed[v.id] ? v.var_value : '••••••••••••••••••••'}</span>
                      <button
                        onClick={() => toggleReveal(v.id)}
                        className="text-text-muted hover:text-text-primary transition"
                      >
                        {revealed[v.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        v.is_secret
                          ? 'bg-status-danger/10 text-status-danger border border-status-danger/20'
                          : 'bg-status-success/10 text-status-success border border-status-success/20'
                      }`}
                    >
                      {v.is_secret ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{v.is_secret ? 'Protected Session' : 'Public'}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-text-primary">
                    Tier {v.min_tier_level} {v.min_tier_level === 0 ? '(Free)' : '(Subscriber)'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteVariable(v.id)}
                      title="Delete Variable"
                      className="p-1.5 rounded-lg text-text-muted hover:text-status-danger hover:bg-obsidian-hover transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {variables.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted text-xs">
                    No remote variables defined. Click "Create Variable" to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create / Edit Variable Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-obsidian-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">New Remote Variable</h2>
              <button onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVariable} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Variable Key (Identifier)</label>
                <input
                  type="text"
                  required
                  value={varKey}
                  onChange={(e) => setVarKey(e.target.value)}
                  placeholder="e.g., DISCORD_BOT_TOKEN, API_ENDPOINT"
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Variable Value (Plaintext)</label>
                <textarea
                  required
                  rows={3}
                  value={varValue}
                  onChange={(e) => setVarValue(e.target.value)}
                  placeholder="Secret payload to decrypt in memory..."
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Minimum Subscription Tier</label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={minTier}
                  onChange={(e) => setMinTier(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={isSecret}
                    onChange={(e) => setIsSecret(e.target.checked)}
                    className="rounded bg-obsidian-void border-obsidian-border text-brand focus:ring-0"
                  />
                  <span>Protected (Requires valid authenticated session token)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-obsidian-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-obsidian-hover border border-obsidian-border text-xs text-text-secondary hover:text-text-primary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Variable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
