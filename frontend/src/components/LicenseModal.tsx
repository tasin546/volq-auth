'use client';

import React, { useState } from 'react';
import { X, Key, Check, Copy, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../lib/authContext';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { selectedApp } = useAuth();
  const [mask, setMask] = useState('VOLQ-XXXX-XXXX-XXXX');
  const [count, setCount] = useState(1);
  const [durationDays, setDurationDays] = useState(30);
  const [isLifetime, setIsLifetime] = useState(false);
  const [maxHWIDs, setMaxHWIDs] = useState(1);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) {
      setError('Please select or create an application first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/dashboard/apps/${selectedApp.id}/licenses/generate`, {
        mask,
        count: Number(count),
        duration_days: isLifetime ? 0 : Number(durationDays),
        is_lifetime: isLifetime,
        max_hwids: Number(maxHWIDs),
        note,
      });

      setGeneratedKeys(res.data.keys || []);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate licenses');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKeys.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-obsidian-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand/10 text-brand">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary">Generate License Keys</h2>
              <p className="text-[11px] text-text-muted">Target App: {selectedApp?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-obsidian-hover transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Generated Keys Success View */}
        {generatedKeys.length > 0 ? (
          <div className="p-6 space-y-4">
            <div className="p-3 bg-status-success/10 border border-status-success/20 rounded-xl text-status-success text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Successfully generated {generatedKeys.length} license key(s)!</span>
            </div>

            <div className="bg-obsidian-void border border-obsidian-border rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-xs text-text-primary space-y-1">
              {generatedKeys.map((key, i) => (
                <div key={i} className="hover:text-brand cursor-text select-all">
                  {key}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-obsidian-hover border border-obsidian-border text-xs font-medium text-text-primary hover:border-obsidian-borderFocus transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy All Keys'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneratedKeys([]);
                  onClose();
                }}
                className="px-5 py-2 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Input Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-xl text-status-danger text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mask Pattern */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Custom Key Mask (X = Random Character)
              </label>
              <input
                type="text"
                value={mask}
                onChange={(e) => setMask(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary font-mono focus:outline-none focus:border-brand transition"
                placeholder="VOLQ-XXXX-XXXX-XXXX"
                required
              />
              <p className="text-[10px] text-text-muted mt-1 font-mono">
                Preview pattern: {mask || 'VOLQ-XXXX-XXXX-XXXX'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Batch Count */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Amount to Generate</label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                  required
                />
              </div>

              {/* Max HWIDs */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Max Devices (HWID)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={maxHWIDs}
                  onChange={(e) => setMaxHWIDs(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                  required
                />
              </div>
            </div>

            {/* Duration / Lifetime */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-text-secondary">License Duration (Days)</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={isLifetime}
                    onChange={(e) => setIsLifetime(e.target.checked)}
                    className="rounded bg-obsidian-void border-obsidian-border text-brand focus:ring-0"
                  />
                  <span>Lifetime License</span>
                </label>
              </div>
              <input
                type="number"
                min="1"
                disabled={isLifetime}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className={`w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition ${
                  isLifetime ? 'opacity-40 cursor-not-allowed' : ''
                }`}
                placeholder="30"
              />
            </div>

            {/* Administrative Note */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Note (Optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-obsidian-void border border-obsidian-border text-xs text-text-primary focus:outline-none focus:border-brand transition"
                placeholder="e.g., Summer Giveaway Batch"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-obsidian-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-obsidian-hover border border-obsidian-border text-xs text-text-secondary hover:text-text-primary transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl bg-brand hover:bg-brand-hover text-white text-xs font-semibold shadow-lg shadow-brand/20 transition disabled:opacity-50"
              >
                {loading ? 'Generating...' : `Generate ${count} Key(s)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
