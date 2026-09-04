'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search, Plus, ShieldCheck, Check } from 'lucide-react';
import { useAuth } from '../lib/authContext';

interface TopNavProps {
  onOpenLicenseModal?: () => void;
}

export const TopNav: React.FC<TopNavProps> = () => {
  const { apps, selectedApp, setSelectedApp } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-obsidian-card/80 backdrop-blur-md border-b border-obsidian-border px-8 flex items-center justify-between z-30">
      {/* Left: Application Selector Dropdown */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-obsidian-void border border-obsidian-border hover:border-obsidian-borderFocus transition text-left text-xs"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedApp?.is_paused ? 'bg-status-warning' : 'bg-status-success'
                }`}
              />
              <span className="font-semibold text-text-primary">
                {selectedApp ? selectedApp.name : 'No App Selected'}
              </span>
              {selectedApp && (
                <span className="text-[10px] text-text-muted font-mono bg-obsidian-card px-1.5 py-0.5 rounded border border-obsidian-border">
                  v{selectedApp.version}
                </span>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted ml-1" />
          </button>

          {/* App Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute left-0 mt-2 w-64 bg-obsidian-card border border-obsidian-border rounded-xl shadow-2xl py-2 z-50">
              <div className="px-3 py-1.5 text-[10px] font-mono text-text-muted uppercase border-b border-obsidian-border/50">
                Switch Application
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {apps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => {
                      setSelectedApp(app);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-obsidian-hover transition"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          app.is_paused ? 'bg-status-warning' : 'bg-status-success'
                        }`}
                      />
                      <span className="font-medium">{app.name}</span>
                    </div>
                    {selectedApp?.id === app.id && <Check className="w-3.5 h-3.5 text-brand" />}
                  </button>
                ))}
                {apps.length === 0 && (
                  <div className="px-3 py-3 text-xs text-text-muted text-center">
                    No applications created yet
                  </div>
                )}
              </div>
              <div className="border-t border-obsidian-border/50 pt-1 mt-1 px-2">
                <Link
                  href="/apps"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-brand hover:bg-brand/10 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Application</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Cloudflare Edge & Zero-Cost Status Badge */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-status-success/10 border border-status-success/20 text-[11px] text-status-success">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-medium">100% Free-Tier Active</span>
        </div>
      </div>

      {/* Right: Search & Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Search Bar */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search licenses, users, logs..."
            className="w-64 pl-9 pr-4 py-1.5 rounded-lg bg-obsidian-void border border-obsidian-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition"
          />
        </div>
      </div>
    </header>
  );
};
