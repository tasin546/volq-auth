'use client';

import React, { useState } from 'react';
import { Layers, Plus, Pause, Play, Trash2, Copy, Check, ShieldCheck, X, AlertCircle } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';
import { Application } from '../../lib/types';

export default function AppsPage() {
  const { apps, selectedApp, setSelectedApp, refreshApps } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [integrityHash, setIntegrityHash] = useState('');
  const [downloadURL, setDownloadURL] = useState('');
  const [webhookURL, setWebhookURL] = useState('');
  const [hwidLock, setHwidLock] = useState(true);
  const [cooldownDays, setCooldownDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/dashboard/apps/create', {
        name,
        version,
        integrity_hash: integrityHash,
        download_url: downloadURL,
        webhook_url: webhookURL,
        hwid_lock_enabled: hwidLock,
        hwid_cooldown_days: Number(cooldownDays),
      });

      setCreatedSecret(res.data.app_secret);
      await refreshApps();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  const togglePauseApp = async (app: Application) => {
    try {
      await api.put(`/dashboard/apps/${app.id}`, {
        is_paused: !app.is_paused,
      });
      await refreshApps();
    } catch (err) {
      console.error('Failed to toggle app status', err);
    }
  };

  const deleteApp = async (appId: string) => {
    if (!confirm('Are you sure you want to delete this application? All licenses and users will be permanently deleted.')) return;
    try {
      await api.delete(`/dashboard/apps/${appId}`);
      await refreshApps();
    } catch (err) {
      console.error('Failed to delete app', err);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Applications & Workspaces</h1>
            <p className="text-xs text-text-muted mt-0.5">Manage protected client binaries, Ed25519 signing keys, and auto-updates</p>
          </div>

          <button
            onClick={() => {
              setCreatedSecret(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Application</span>
          </button>
        </div>

        {/* Applications Table */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-void/60 border-b border-obsidian-border text-text-muted font-mono text-[11px]">
              <tr>
                <th className="px-6 py-3.5 font-medium">NAME / WORKSPACE</th>
                <th className="px-6 py-3.5 font-medium">APPLICATION ID</th>
                <th className="px-6 py-3.5 font-medium">VERSION</th>
                <th className="px-6 py-3.5 font-medium">HWID LOCK</th>
                <th className="px-6 py-3.5 font-medium">STATUS</th>
                <th className="px-6 py-3.5 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border/50">
              {apps.map((app) => {
                const isSelected = selectedApp?.id === app.id;
                return (
                  <tr key={app.id} className={`hover:bg-obsidian-hover/40 transition ${isSelected ? 'bg-brand/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-obsidian-void border border-obsidian-border flex items-center justify-center text-brand">
                          <Layers className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-text-primary flex items-center gap-2">
                            <span>{app.name}</span>
                            {isSelected && (
                              <span className="text-[10px] bg-brand text-white px-2 py-0.2 rounded-full font-medium">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-text-muted font-mono">
                            Created {new Date(app.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-text-muted text-[11px] select-all">{app.id}</td>
                    <td className="px-6 py-4 font-mono text-text-primary">v{app.version}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        app.hwid_lock_enabled ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/10 text-status-warning'
                      }`}>
                        {app.hwid_lock_enabled ? 'Locked (7d)' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${
                        app.is_paused ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' : 'bg-status-success/10 text-status-success border border-status-success/20'
                      }`}>
                        {app.is_paused ? 'Maintenance' : 'Operational'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedApp(app)}
                          className="px-2.5 py-1 rounded-lg bg-obsidian-void border border-obsidian-border text-[11px] text-text-secondary hover:text-text-primary transition"
                        >
                          Select
                        </button>
                        <button
                          onClick={() => togglePauseApp(app)}
                          title={app.is_paused ? 'Resume App' : 'Pause App'}
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-obsidian-hover transition"
                        >
                          {app.is_paused ? <Play className="w-4 h-4 text-status-success" /> : <Pause className="w-4 h-4 text-status-warning" />}
                        </button>
                        <button
                          onClick={() => deleteApp(app.id)}
                          title="Delete App"
                          className="p-1.5 rounded-lg text-text-muted hover:text-status-danger hover:bg-obsidian-hover transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {apps.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted text-xs">
                    No applications created yet. Click "Create Application" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create Application Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-obsidian-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Create New Application Workspace</h2>
              <button onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdSecret ? (
              <div className="p-6 space-y-4">
                <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-status-success text-xs font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Application Created & Ed25519 Keys Generated!</span>
                </div>
                <div className="p-4 bg-obsidian-void border border-obsidian-border rounded-xl space-y-2">
                  <div className="text-[11px] text-text-muted font-medium">Application Secret (Save this now; it will never be displayed again):</div>
                  <div className="font-mono text-xs text-brand font-bold break-all select-all">{createdSecret}</div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdSecret);
                      setCopied(true);
                      setTimeout(() => {
                        setCopied(false);
                        setModalOpen(false);
                      }, 1500);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied & Done' : 'Copy Secret & Close'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateApp} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-xl text-status-danger text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Application Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Atom Optimizer, HyperApex Loader"
                    className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Version</label>
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">HWID Reset Cooldown (Days)</label>
                    <input
                      type="number"
                      value={cooldownDays}
                      onChange={(e) => setCooldownDays(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Integrity Hash (SHA-256 of valid client binary)</label>
                  <input
                    type="text"
                    value={integrityHash}
                    onChange={(e) => setIntegrityHash(e.target.value)}
                    placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                    className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Discord / Security Webhook URL</label>
                  <input
                    type="url"
                    value={webhookURL}
                    onChange={(e) => setWebhookURL(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary">
                    <input
                      type="checkbox"
                      checked={hwidLock}
                      onChange={(e) => setHwidLock(e.target.checked)}
                      className="rounded bg-obsidian-void border-obsidian-border text-brand focus:ring-0"
                    />
                    <span>Enforce Hardware ID (HWID) Locking</span>
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
                    {loading ? 'Creating...' : 'Create Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
