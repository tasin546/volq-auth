'use client';

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Plus,
  Download,
  Search,
  RotateCcw,
  Ban,
  Pause,
  Play,
  Trash2,
  Copy,
  Check,
  Monitor,
} from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { LicenseModal } from '../../components/LicenseModal';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';
import { License } from '../../lib/types';

export default function LicensesPage() {
  const { selectedApp } = useAuth();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedApp) {
      fetchLicenses();
    }
  }, [selectedApp, statusFilter, search]);

  const fetchLicenses = async () => {
    if (!selectedApp) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/dashboard/apps/${selectedApp.id}/licenses?status=${statusFilter}&search=${search}&limit=100`
      );
      setLicenses(res.data.licenses || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to load licenses', err);
    } finally {
      setLoading(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const resetHWID = async (licId: string) => {
    if (!confirm('Are you sure you want to reset this hardware lock?')) return;
    try {
      await api.put(`/dashboard/apps/${selectedApp?.id}/licenses/${licId}/reset-hwid`);
      fetchLicenses();
    } catch (err) {
      console.error('Failed to reset HWID', err);
    }
  };

  const updateStatus = async (licId: string, status: string) => {
    try {
      await api.put(`/dashboard/apps/${selectedApp?.id}/licenses/${licId}/status`, { status });
      fetchLicenses();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const deleteLicense = async (licId: string) => {
    if (!confirm('Permanently delete this license key?')) return;
    try {
      await api.delete(`/dashboard/apps/${selectedApp?.id}/licenses/${licId}`);
      fetchLicenses();
    } catch (err) {
      console.error('Failed to delete license', err);
    }
  };

  const exportCSV = () => {
    if (!selectedApp) return;
    window.open(`${api.defaults.baseURL}/dashboard/apps/${selectedApp.id}/licenses/export`, '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-status-success/10 text-status-success border-status-success/20';
      case 'unactivated':
        return 'bg-brand/10 text-brand border-brand/20';
      case 'paused':
        return 'bg-status-warning/10 text-status-warning border-status-warning/20';
      case 'banned':
      case 'expired':
        return 'bg-status-danger/10 text-status-danger border-status-danger/20';
      default:
        return 'bg-obsidian-void text-text-muted border-obsidian-border';
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav onOpenLicenseModal={() => setModalOpen(true)} />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        {/* Header with Title & Export / Generate Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">License Key Vault</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Managing {total} keys for{' '}
              <span className="text-text-secondary font-medium">{selectedApp?.name || 'Workspace'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-obsidian-card border border-obsidian-border hover:border-obsidian-borderFocus text-xs font-medium text-text-secondary hover:text-text-primary transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Keys</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['all', 'unactivated', 'active', 'paused', 'banned', 'expired'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition ${
                  statusFilter === st
                    ? 'bg-brand text-white font-semibold'
                    : 'text-text-muted hover:text-text-primary hover:bg-obsidian-hover'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search key or note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 rounded-lg bg-obsidian-void border border-obsidian-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition"
            />
          </div>
        </div>

        {/* Licenses Table */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-obsidian-void/60 border-b border-obsidian-border text-text-muted font-mono text-[11px]">
                <tr>
                  <th className="px-6 py-3.5 font-medium">LICENSE KEY</th>
                  <th className="px-6 py-3.5 font-medium">STATUS</th>
                  <th className="px-6 py-3.5 font-medium">TIER / DURATION</th>
                  <th className="px-6 py-3.5 font-medium">BOUND HWID</th>
                  <th className="px-6 py-3.5 font-medium">EXPIRES AT</th>
                  <th className="px-6 py-3.5 font-medium text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-border/50">
                {licenses.map((lic) => (
                  <tr key={lic.id} className="hover:bg-obsidian-hover/40 transition">
                    <td className="px-6 py-3.5 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-semibold tracking-wide">{lic.license_key}</span>
                        <button
                          onClick={() => copyKey(lic.license_key)}
                          title="Copy Key"
                          className="text-text-muted hover:text-brand transition"
                        >
                          {copiedKey === lic.license_key ? (
                            <Check className="w-3.5 h-3.5 text-status-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {lic.note && <div className="text-[10px] text-text-muted mt-0.5">{lic.note}</div>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${getStatusBadge(
                          lic.status
                        )}`}
                      >
                        {lic.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-text-primary">{lic.subscription_name}</div>
                      <div className="text-[10px] text-text-muted font-mono">
                        {lic.is_lifetime ? 'Lifetime' : `${lic.duration_seconds / 86400} Days`}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {lic.hwid_hash ? (
                        <div className="flex items-center gap-2">
                          <Monitor className="w-3.5 h-3.5 text-brand shrink-0" />
                          <span className="font-mono text-text-muted text-[11px] truncate max-w-[120px]">
                            {lic.hwid_hash}
                          </span>
                          <button
                            onClick={() => resetHWID(lic.id)}
                            title="Reset Hardware Lock"
                            className="p-1 rounded text-text-muted hover:text-status-warning hover:bg-obsidian-void transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-text-muted italic">Unbound</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 font-mono text-text-muted text-[11px]">
                      {lic.is_lifetime
                        ? 'Never'
                        : lic.expires_at
                        ? new Date(lic.expires_at).toLocaleDateString()
                        : 'On First Launch'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {lic.status === 'active' && (
                          <button
                            onClick={() => updateStatus(lic.id, 'paused')}
                            title="Pause License"
                            className="p-1.5 rounded-lg text-text-muted hover:text-status-warning hover:bg-obsidian-hover transition"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {lic.status === 'paused' && (
                          <button
                            onClick={() => updateStatus(lic.id, 'active')}
                            title="Resume License"
                            className="p-1.5 rounded-lg text-text-muted hover:text-status-success hover:bg-obsidian-hover transition"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {lic.status !== 'banned' ? (
                          <button
                            onClick={() => updateStatus(lic.id, 'banned')}
                            title="Ban License"
                            className="p-1.5 rounded-lg text-text-muted hover:text-status-danger hover:bg-obsidian-hover transition"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => updateStatus(lic.id, 'active')}
                            title="Unban License"
                            className="p-1.5 rounded-lg text-text-muted hover:text-status-success hover:bg-obsidian-hover transition"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteLicense(lic.id)}
                          title="Delete License"
                          className="p-1.5 rounded-lg text-text-muted hover:text-status-danger hover:bg-obsidian-hover transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {licenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted text-xs">
                      {loading ? 'Loading licenses...' : 'No licenses found for this filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <LicenseModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchLicenses}
      />
    </div>
  );
}
