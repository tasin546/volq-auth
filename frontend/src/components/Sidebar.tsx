'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  LayoutDashboard,
  Layers,
  KeyRound,
  Users,
  Database,
  FolderLock,
  Webhook,
  UserCheck,
  Activity,
  Code2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user, logout, selectedApp } = useAuth();

  const navigationGroups = [
    {
      title: 'PLATFORM',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Applications', href: '/apps', icon: Layers },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { name: 'Licenses', href: '/licenses', icon: KeyRound },
        { name: 'End-Users', href: '/users', icon: Users },
      ],
    },
    {
      title: 'PAYLOADS & STORAGE',
      items: [
        { name: 'Variables', href: '/variables', icon: Database },
        { name: 'Cloud Files', href: '/files', icon: FolderLock },
        { name: 'Webhooks', href: '/webhooks', icon: Webhook },
      ],
    },
    {
      title: 'ACCESS & AUDIT',
      items: [
        { name: 'Resellers', href: '/resellers', icon: UserCheck },
        { name: 'Security Logs', href: '/logs', icon: Activity },
        { name: 'Client SDKs', href: '/docs', icon: Code2 },
      ],
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-obsidian-card border-r border-obsidian-border flex flex-col z-40 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-obsidian-border">
        <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/30 flex items-center justify-center text-brand">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-text-primary tracking-wider flex items-center gap-1.5">
            VOLQ<span className="text-brand">AUTH</span>
          </h1>
          <p className="text-[10px] text-text-muted tracking-wide font-mono">OPENKEYAUTH v1.0</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navigationGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-text-muted font-mono uppercase">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-brand text-white shadow-lg shadow-brand/20 font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-obsidian-hover'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-text-muted'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-obsidian-border bg-obsidian-void/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-obsidian-border flex items-center justify-center font-bold text-xs text-text-primary border border-obsidian-border">
              {user?.username ? user.username.substring(0, 2).toUpperCase() : 'VA'}
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-medium text-text-primary truncate">{user?.username || 'Guest'}</div>
              <div className="text-[10px] text-text-muted font-mono capitalize">
                {user?.role || 'Developer'}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-text-muted hover:text-status-danger hover:bg-obsidian-hover transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
