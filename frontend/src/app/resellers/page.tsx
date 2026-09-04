'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Coins, Shield, X, Check } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';
import { Reseller } from '../../lib/types';

export default function ResellersPage() {
  const { selectedApp } = useAuth();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credits, setCredits] = useState(100);
  const [canResetHwid, setCanResetHwid] = useState(false);
  const [creditAdjustment, setCreditAdjustment] = useState(50);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      fetchResellers();
    }
  }, [selectedApp]);

  const fetchResellers = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.get(`/dashboard/apps/${selectedApp.id}/resellers`);
      setResellers(res.data || []);
    } catch (err) {
      console.error('Failed to load resellers', err);
    }
  };

  const handleCreateReseller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setLoading(true);
    try {
      await api.post(`/dashboard/apps/${selectedApp.id}/resellers/create`, {
        username,
        password,
        credits: Number(credits),
        can_reset_hwid: canResetHwid,
      });
      setModalOpen(false);
      setUsername('');
      setPassword('');
      fetchResellers();
    } catch (err) {
      console.error('Failed to create reseller', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !selectedReseller) return;
    setLoading(true);
    try {
      await api.post(`/dashboard/apps/${selectedApp.id}/resellers/${selectedReseller.id}/credits`, {
        credits_to_add: Number(creditAdjustment),
      });
      setCreditModalOpen(false);
      fetchResellers();
    } catch (err) {
      console.error('Failed to adjust credits', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Reseller & Sub-Admin Subsystem</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Authorize third-party vendors to generate and sell licenses using a managed credit pool
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reseller Account</span>
          </button>
        </div>

        {/* Reseller Table */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-void/60 border-b border-obsidian-border text-text-muted font-mono text-[11px]">
              <tr>
                <th className="px-6 py-3.5 font-medium">RESELLER USERNAME</th>
                <th className="px-6 py-3.5 font-medium">CREDITS BALANCE</th>
                <th className="px-6 py-3.5 font-medium">HWID RESET PERM</th>
                <th className="px-6 py-3.5 font-medium">STATUS</th>
                <th className="px-6 py-3.5 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border/50">
              {resellers.map((r) => (
                <tr key={r.id} className="hover:bg-obsidian-hover/40 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-obsidian-void border border-obsidian-border flex items-center justify-center font-bold text-xs text-brand">
                        {r.username.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-text-primary">{r.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-status-warning">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{r.credits} Credits</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.can_reset_hwid
                          ? 'bg-status-success/10 text-status-success'
                          : 'bg-obsidian-void text-text-muted'
                      }`}
                    >
                      {r.can_reset_hwid ? 'Allowed' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-status-success/10 text-status-success border border-status-success/20">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedReseller(r);
                        setCreditModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-lg bg-obsidian-void border border-obsidian-border text-xs text-text-secondary hover:text-text-primary hover:border-obsidian-borderFocus transition"
                    >
                      Adjust Credits
                    </button>
                  </td>
                </tr>
              ))}
              {resellers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted text-xs">
                    No reseller accounts configured. Click "Add Reseller Account" to issue vendor access.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add Reseller Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-obsidian-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Create Reseller Account</h2>
              <button onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReseller} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Reseller Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="vendor_shop"
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Initial Credits (1 Credit = 1 Day)</label>
                <input
                  type="number"
                  min="0"
                  value={credits}
                  onChange={(e) => setCredits(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={canResetHwid}
                    onChange={(e) => setCanResetHwid(e.target.checked)}
                    className="rounded bg-obsidian-void border-obsidian-border text-brand focus:ring-0"
                  />
                  <span>Allow reseller to reset HWID for their customers</span>
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
                  {loading ? 'Creating...' : 'Create Reseller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Credits Modal */}
      {creditModalOpen && selectedReseller && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-obsidian-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Adjust Credits: {selectedReseller.username}</h2>
              <button onClick={() => setCreditModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustCredits} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Credits to Add (Use negative to deduct)
                </label>
                <input
                  type="number"
                  required
                  value={creditAdjustment}
                  onChange={(e) => setCreditAdjustment(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-obsidian-border">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-obsidian-hover border border-obsidian-border text-xs text-text-secondary hover:text-text-primary transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Credits'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
