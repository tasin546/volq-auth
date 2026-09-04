'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Layers,
  KeyRound,
  Users,
  ShieldAlert,
  Copy,
  Check,
  Plus,
  ExternalLink,
  Code2,
  Terminal,
  Activity,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { TopNav } from '../components/TopNav';
import { StatCard } from '../components/StatCard';
import { LicenseModal } from '../components/LicenseModal';
import { useAuth } from '../lib/authContext';
import api from '../lib/api';
import { SecurityLog } from '../lib/types';

export default function DashboardOverview() {
  const { user, apps, selectedApp, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalLicenses: 0,
    activeLicenses: 0,
    totalUsers: 0,
    recentAlerts: 0,
  });
  const [recentLogs, setRecentLogs] = useState<SecurityLog[]>([]);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (selectedApp) {
      fetchAppStats(selectedApp.id);
    }
  }, [selectedApp]);

  const fetchAppStats = async (appId: string) => {
    try {
      // 1. Fetch licenses
      const licRes = await api.get(`/dashboard/apps/${appId}/licenses?limit=1000`);
      const licenses = licRes.data.licenses || [];
      const active = licenses.filter((l: any) => l.status === 'active').length;

      // 2. Fetch users
      const userRes = await api.get(`/dashboard/apps/${appId}/users?limit=1`);
      const totalUsers = userRes.data.total || 0;

      // 3. Fetch security logs
      const logRes = await api.get(`/dashboard/apps/${appId}/logs?limit=5`);
      const logs = logRes.data || [];

      setStats({
        totalLicenses: licRes.data.total || licenses.length,
        activeLicenses: active,
        totalUsers,
        recentAlerts: logs.filter((l: any) => l.event_type.includes('tamper') || l.event_type.includes('mismatch')).length,
      });
      setRecentLogs(logs);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    }
  };

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading || !user) {
    return (
      <div className="h-screen w-screen bg-obsidian-void flex items-center justify-center text-text-muted text-xs font-mono">
        Authenticating session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav onOpenLicenseModal={() => setLicenseModalOpen(true)} />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-8">
        {/* Welcome & Quick Action Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              Welcome back, <span className="text-brand">{user.username}</span>
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Target Workspace:{' '}
              <span className="text-text-secondary font-medium">
                {selectedApp ? selectedApp.name : 'No app selected'}
              </span>{' '}
              • Status:{' '}
              <span className="text-status-success font-semibold">100% Free-Tier Engine</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/docs')}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border hover:border-obsidian-borderFocus text-xs font-medium text-text-secondary hover:text-text-primary transition"
            >
              <Code2 className="w-3.5 h-3.5 text-brand" />
              <span>Client SDK Snippets</span>
            </button>
            <button
              onClick={() => setLicenseModalOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Keys</span>
            </button>
          </div>
        </div>

        {/* 4-Column KPI Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Applications"
            value={apps.length}
            subtitle="Scoped workspaces"
            icon={Layers}
            accentColor="brand"
          />
          <StatCard
            title="Active Licenses"
            value={stats.activeLicenses}
            subtitle={`${stats.totalLicenses} Total generated`}
            icon={KeyRound}
            accentColor="success"
          />
          <StatCard
            title="Registered End-Users"
            value={stats.totalUsers}
            subtitle="Mode B accounts"
            icon={Users}
            accentColor="brand"
          />
          <StatCard
            title="Security Events"
            value={stats.recentAlerts}
            subtitle="Tamper & replay guard"
            icon={ShieldAlert}
            accentColor={stats.recentAlerts > 0 ? 'danger' : 'success'}
          />
        </div>

        {/* Application Credentials & Master Public Key Box */}
        {selectedApp && (
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-brand/10 text-brand">
                  <Terminal className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-text-primary">Application Scoped Credentials</h2>
                  <p className="text-[11px] text-text-muted">
                    Compile these keys directly into your client executable
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${
                  selectedApp.is_paused
                    ? 'bg-status-warning/10 border-status-warning/20 text-status-warning'
                    : 'bg-status-success/10 border-status-success/20 text-status-success'
                }`}
              >
                {selectedApp.is_paused ? 'Paused' : 'Active'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Application ID */}
              <div className="p-3.5 bg-obsidian-void border border-obsidian-border rounded-xl">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Application ID (UUID)</span>
                  <button
                    onClick={() => copyText(selectedApp.id, 'app_id')}
                    className="hover:text-brand transition"
                  >
                    {copiedField === 'app_id' ? (
                      <Check className="w-3.5 h-3.5 text-status-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="font-mono text-xs text-text-primary truncate">{selectedApp.id}</div>
              </div>

              {/* Version & Integrity */}
              <div className="p-3.5 bg-obsidian-void border border-obsidian-border rounded-xl">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Version & Integrity Hash</span>
                  <span className="text-[10px] font-mono text-brand">v{selectedApp.version}</span>
                </div>
                <div className="font-mono text-xs text-text-primary truncate">
                  {selectedApp.integrity_hash || 'None (Integrity check disabled)'}
                </div>
              </div>

              {/* Master Public Key (Ed25519) */}
              <div className="p-3.5 bg-obsidian-void border border-obsidian-border rounded-xl">
                <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                  <span>Master Public Key (Ed25519)</span>
                  <button
                    onClick={() => copyText(selectedApp.master_public_key, 'pub_key')}
                    className="hover:text-brand transition"
                  >
                    {copiedField === 'pub_key' ? (
                      <Check className="w-3.5 h-3.5 text-status-success" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="font-mono text-xs text-text-primary truncate">
                  {selectedApp.master_public_key}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Security Activity Sentinel Feed */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-status-info/10 text-status-info">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Real-time Security Sentinel Feed</h2>
                <p className="text-[11px] text-text-muted">Live event stream and tamper mitigation</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/logs')}
              className="text-xs text-brand hover:underline flex items-center gap-1"
            >
              <span>View Full Audit Log</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-obsidian-border text-text-muted font-mono text-[11px]">
                <tr>
                  <th className="pb-2 font-medium">EVENT TYPE</th>
                  <th className="pb-2 font-medium">ACTOR / KEY</th>
                  <th className="pb-2 font-medium">IP ADDRESS</th>
                  <th className="pb-2 font-medium">TIMESTAMP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50">
                {recentLogs.map((log) => {
                  const isTamper =
                    log.event_type.includes('tamper') ||
                    log.event_type.includes('mismatch') ||
                    log.event_type.includes('replay');
                  return (
                    <tr key={log.id} className="hover:bg-obsidian-hover/40 transition">
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                            isTamper
                              ? 'bg-status-danger/10 text-status-danger border border-status-danger/20'
                              : 'bg-status-success/10 text-status-success border border-status-success/20'
                          }`}
                        >
                          {log.event_type}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-text-primary">{log.actor_identifier || 'Unknown'}</td>
                      <td className="py-2.5 font-mono text-text-muted">{log.ip_address}</td>
                      <td className="py-2.5 text-text-muted">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  );
                })}
                {recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-text-muted text-xs">
                      No security events recorded yet. All systems secure.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* License Batch Generator Modal */}
      <LicenseModal
        isOpen={licenseModalOpen}
        onClose={() => setLicenseModalOpen(false)}
        onSuccess={() => {
          if (selectedApp) fetchAppStats(selectedApp.id);
        }}
      />
    </div>
  );
}
