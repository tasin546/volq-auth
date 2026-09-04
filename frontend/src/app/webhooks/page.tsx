'use client';

import React, { useState, useEffect } from 'react';
import { Webhook, Send, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';

export default function WebhooksPage() {
  const { selectedApp, refreshApps } = useAuth();
  const [webhookURL, setWebhookURL] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      setWebhookURL(selectedApp.webhook_url || '');
    }
  }, [selectedApp]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setLoading(true);
    try {
      await api.put(`/dashboard/apps/${selectedApp.id}`, {
        webhook_url: webhookURL,
      });
      await refreshApps();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save webhook URL', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Real-Time Webhook Engine</h1>
          <p className="text-xs text-text-muted mt-0.5">
            Configure automated Discord and HTTP webhook dispatchers for security events
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Webhook Settings Form */}
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-brand/10 text-brand">
                <Webhook className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Dispatcher Endpoint</h2>
                <p className="text-[11px] text-text-muted">Target App: {selectedApp?.name}</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Discord Webhook URL or HTTP Endpoint
                </label>
                <input
                  type="url"
                  required
                  value={webhookURL}
                  onChange={(e) => setWebhookURL(e.target.value)}
                  placeholder="https://discord.com/api/webhooks/123456789/..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand transition"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Discord URLs automatically render rich colored embeds. Standard URLs receive JSON POST payloads.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-xs font-medium text-text-secondary">Subscribed Security Events:</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-text-muted font-mono">
                  <div className="p-2 bg-obsidian-void rounded-lg border border-obsidian-border flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-status-success" />
                    <span>user.login</span>
                  </div>
                  <div className="p-2 bg-obsidian-void rounded-lg border border-obsidian-border flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-status-success" />
                    <span>license.redeem</span>
                  </div>
                  <div className="p-2 bg-obsidian-void rounded-lg border border-obsidian-border flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-status-danger" />
                    <span>hwid.mismatch</span>
                  </div>
                  <div className="p-2 bg-obsidian-void rounded-lg border border-obsidian-border flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-status-danger" />
                    <span>tamper.detected</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-lg shadow-brand/20 transition disabled:opacity-50"
                >
                  {saved ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  <span>{saved ? 'Endpoint Saved!' : loading ? 'Saving...' : 'Save Webhook Configuration'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Discord Rich Embed Live Preview */}
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-text-secondary uppercase tracking-wider font-mono">
              <Sparkles className="w-4 h-4 text-brand" />
              <span>Discord Rich Embed Simulator</span>
            </div>

            {/* Simulated Discord Message */}
            <div className="bg-[#313338] rounded-xl p-4 text-[#DBDEE1] font-sans text-xs space-y-3 shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center font-bold text-white text-xs">
                  VA
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs">VOLQ-Auth Security Sentinel</span>
                    <span className="bg-[#5865F2] text-white text-[9px] font-bold px-1 rounded uppercase">BOT</span>
                  </div>
                  <div className="text-[10px] text-[#949BA4]">Today at 2:15 PM</div>
                </div>
              </div>

              {/* Embed Card */}
              <div className="border-l-4 border-[#10B981] bg-[#2B2D31] rounded-r-lg p-3 space-y-2">
                <div className="font-bold text-white text-xs">Security Event: license.redeem</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-[#949BA4] font-medium">Application</div>
                    <div className="text-white font-semibold">{selectedApp?.name || 'Atom Optimizer'}</div>
                  </div>
                  <div>
                    <div className="text-[#949BA4] font-medium">Actor / Key</div>
                    <div className="font-mono text-white">VOLQ-9941-FA23-99BC</div>
                  </div>
                  <div>
                    <div className="text-[#949BA4] font-medium">IP Address</div>
                    <div className="font-mono text-white">192.168.1.100</div>
                  </div>
                  <div>
                    <div className="text-[#949BA4] font-medium">Tier</div>
                    <div className="text-[#10B981] font-bold">VIP Lifetime</div>
                  </div>
                </div>
                <div className="text-[9px] text-[#949BA4] pt-1 border-t border-[#3F4147] font-mono">
                  VOLQ-Auth Production Guard • Just now
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
