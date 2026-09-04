'use client';

import React, { useState, useEffect } from 'react';
import { FolderLock, Plus, Trash2, FileCode, HardDrive, ShieldCheck, X } from 'lucide-react';
import { Sidebar } from '../../components/Sidebar';
import { TopNav } from '../../components/TopNav';
import { useAuth } from '../../lib/authContext';
import api from '../../lib/api';
import { FilePayload } from '../../lib/types';

export default function FilesPage() {
  const { selectedApp } = useAuth();
  const [files, setFiles] = useState<FilePayload[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [storageKey, setStorageKey] = useState('');
  const [sha256Hash, setSha256Hash] = useState('');
  const [minTier, setMinTier] = useState(1);
  const [fileSize, setFileSize] = useState(1048576); // 1 MB default
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      fetchFiles();
    }
  }, [selectedApp]);

  const fetchFiles = async () => {
    if (!selectedApp) return;
    try {
      const res = await api.get(`/dashboard/apps/${selectedApp.id}/files`);
      setFiles(res.data || []);
    } catch (err) {
      console.error('Failed to load files', err);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setLoading(true);
    try {
      await api.post(`/dashboard/apps/${selectedApp.id}/files`, {
        file_name: fileName,
        r2_storage_key: storageKey,
        sha256_hash: sha256Hash,
        file_size_bytes: Number(fileSize),
        min_tier_level: Number(minTier),
      });
      setModalOpen(false);
      setFileName('');
      setStorageKey('');
      setSha256Hash('');
      fetchFiles();
    } catch (err) {
      console.error('Failed to save file entry', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm('Permanently delete this cloud payload reference?')) return;
    try {
      await api.delete(`/dashboard/apps/${selectedApp?.id}/files/${fileId}`);
      fetchFiles();
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-void text-text-primary">
      <Sidebar />
      <TopNav />

      <main className="ml-64 pt-20 pb-12 px-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Cloud Payloads & File Distribution</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Host protected DLLs, assets, and configurations on Cloudflare R2 with zero-disk RAM streaming
            </p>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-md shadow-brand/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add File Payload</span>
          </button>
        </div>

        {/* Cloudflare R2 Storage Status Notice */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-status-success/10 text-status-success">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-primary">Cloudflare R2 Zero-Egress Storage</div>
              <div className="text-[11px] text-text-muted">10 GB Free Storage • 0$ Bandwidth Fees • Instant Edge Streaming</div>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-status-success/10 text-status-success border border-status-success/20">
            Connected
          </span>
        </div>

        {/* Files Table */}
        <div className="bg-obsidian-card border border-obsidian-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-obsidian-void/60 border-b border-obsidian-border text-text-muted font-mono text-[11px]">
              <tr>
                <th className="px-6 py-3.5 font-medium">FILE NAME</th>
                <th className="px-6 py-3.5 font-medium">STORAGE KEY (R2)</th>
                <th className="px-6 py-3.5 font-medium">SHA-256 HASH</th>
                <th className="px-6 py-3.5 font-medium">MIN TIER</th>
                <th className="px-6 py-3.5 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border/50">
              {files.map((f) => (
                <tr key={f.id} className="hover:bg-obsidian-hover/40 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <FileCode className="w-4 h-4 text-brand" />
                      <span className="font-semibold text-text-primary">{f.file_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-text-muted text-[11px]">{f.r2_storage_key}</td>
                  <td className="px-6 py-4 font-mono text-text-muted text-[11px] truncate max-w-[160px]">
                    {f.sha256_hash}
                  </td>
                  <td className="px-6 py-4 font-mono text-text-primary">Tier {f.min_tier_level}+</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteFile(f.id)}
                      title="Delete File"
                      className="p-1.5 rounded-lg text-text-muted hover:text-status-danger hover:bg-obsidian-hover transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {files.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted text-xs">
                    No files hosted yet. Add your first DLL or payload binary.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add File Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-obsidian-border flex items-center justify-between">
              <h2 className="text-sm font-bold text-text-primary">Register Protected Cloud Payload</h2>
              <button onClick={() => setModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFile} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">File Name (Virtual)</label>
                <input
                  type="text"
                  required
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. cheat_engine.dll, payload.bin"
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">R2 Object Key / Path</label>
                <input
                  type="text"
                  required
                  value={storageKey}
                  onChange={(e) => setStorageKey(e.target.value)}
                  placeholder="e.g. apps/atom/v1.0.0/core.dll"
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Expected SHA-256 Hash</label>
                <input
                  type="text"
                  required
                  value={sha256Hash}
                  onChange={(e) => setSha256Hash(e.target.value)}
                  placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Minimum Subscription Tier</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={minTier}
                  onChange={(e) => setMinTier(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                />
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
                  {loading ? 'Saving...' : 'Register File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
