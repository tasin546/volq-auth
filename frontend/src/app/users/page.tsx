'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Ban, Check, Trash2, Globe, Monitor } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';
import { AppUser } from '../../lib/types';

export default function UsersPage() {
  const { selectedApp } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      fetchUsers();
    }
  }, [selectedApp, search]);

  const fetchUsers = async () => {
    if (!selectedApp) return;
    setLoading(true);
    try {
      const res = await api.get(`/dashboard/apps/${selectedApp.id}/users?search=${search}&limit=100`);
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleBan = async (user: AppUser) => {
    try {
      await api.put(`/dashboard/apps/${selectedApp?.id}/users/${user.id}/ban`, {
        is_banned: !user.is_banned,
        reason: !user.is_banned ? 'Banned by administrator' : null,
      });
      fetchUsers();
    } catch (err) {
      console.error('Failed to update ban state', err);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Permanently delete this user account?')) return;
    try {
      await api.delete(`/dashboard/apps/${selectedApp?.id}/users/${userId}`);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user', err);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">End-User Vault (Mode B)</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Managed subscriber accounts for{' '}
              <span className="text-text-secondary font-medium">{selectedApp?.name || 'Workspace'}</span>
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 rounded-lg bg-obsidian-card border border-obsidian-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-void/60 border-b border-obsidian-border text-text-muted font-mono text-[11px]">
              <tr>
                <th className="px-6 py-3.5 font-medium">USERNAME</th>
                <th className="px-6 py-3.5 font-medium">STATUS</th>
                <th className="px-6 py-3.5 font-medium">BOUND HWID</th>
                <th className="px-6 py-3.5 font-medium">LAST LOGIN IP</th>
                <th className="px-6 py-3.5 font-medium">LAST SEEN</th>
                <th className="px-6 py-3.5 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-obsidian-hover/40 transition">
                  <td className="px-6 py-3.5 font-medium text-text-primary">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-obsidian-void border border-obsidian-border flex items-center justify-center font-bold text-xs text-brand">
                        {u.username.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{u.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                        u.is_banned
                          ? 'bg-status-danger/10 text-status-danger border-status-danger/20'
                          : 'bg-status-success/10 text-status-success border-status-success/20'
                      }`}
                    >
                      {u.is_banned ? 'Banned' : 'Active'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-mono text-text-muted text-[11px]">
                    {u.hwid_hash ? (
                      <div className="flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 text-brand" />
                        <span className="truncate max-w-[120px]">{u.hwid_hash}</span>
                      </div>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-text-muted text-[11px]">
                    {u.ip_address ? (
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-text-muted" />
                        <span>{u.ip_address}</span>
                      </div>
                    ) : (
                      'Never'
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-text-muted text-[11px]">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleBan(u)}
                        title={u.is_banned ? 'Unban User' : 'Ban User'}
                        className={`p-1.5 rounded-lg transition ${
                          u.is_banned
                            ? 'text-status-success hover:bg-obsidian-hover'
                            : 'text-text-muted hover:text-status-danger hover:bg-obsidian-hover'
                        }`}
                      >
                        {u.is_banned ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        title="Delete User"
                        className="p-1.5 rounded-lg text-text-muted hover:text-status-danger hover:bg-obsidian-hover transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-muted text-xs">
                    {loading ? 'Loading users...' : 'No users registered under this application yet.'}
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
