'use client';

import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, RefreshCw, Globe, Clock, User } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';
import { SecurityLog } from '../../lib/types';

export default function LogsPage() {
  const { selectedApp } = useAuth();
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      fetchLogs();
    }
  }, [selectedApp]);

  const fetchLogs = async () => {
    if (!selectedApp) return;
    setLoading(true);
    try {
      const res = await api.get(`/dashboard/apps/${selectedApp.id}/logs?limit=200`);
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load security logs', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventBadge = (eventType: string) => {
    if (
      eventType.includes('tamper') ||
      eventType.includes('mismatch') ||
      eventType.includes('replay') ||
      eventType.includes('decrypt_failed')
    ) {
      return 'bg-status-danger/10 text-status-danger border-status-danger/20';
    }
    if (eventType.includes('login') || eventType.includes('redeem')) {
      return 'bg-status-success/10 text-status-success border-status-success/20';
    }
    return 'bg-brand/10 text-brand border-brand/20';
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Security Audit & Tamper Log</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Cryptographic integrity records, anti-replay triggers, and HWID mismatch telemetry
            </p>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border hover:border-obsidian-borderFocus text-xs font-medium text-text-secondary hover:text-text-primary transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>
        </div>

        {/* Logs Table */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-void/60 border-b border-obsidian-border text-text-muted font-mono text-[11px]">
              <tr>
                <th className="px-6 py-3.5 font-medium">EVENT TYPE</th>
                <th className="px-6 py-3.5 font-medium">ACTOR / LICENSE KEY</th>
                <th className="px-6 py-3.5 font-medium">CLIENT IP</th>
                <th className="px-6 py-3.5 font-medium">DETAILS</th>
                <th className="px-6 py-3.5 font-medium text-right">TIMESTAMP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border/50">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-obsidian-hover/40 transition">
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${getEventBadge(
                        l.event_type
                      )}`}
                    >
                      <Activity className="w-3 h-3" />
                      <span>{l.event_type}</span>
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-mono text-text-primary">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-text-muted" />
                      <span>{l.actor_identifier || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 font-mono text-text-muted text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-text-muted" />
                      <span>{l.ip_address}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 font-mono text-text-secondary text-[11px] max-w-xs truncate">
                    {l.details}
                  </td>
                  <td className="px-6 py-3.5 text-right font-mono text-text-muted text-[11px]">
                    <div className="flex items-center justify-end gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-text-muted" />
                      <span>{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted text-xs">
                    {loading ? 'Fetching audit logs...' : 'No security events recorded. The system is clean.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
