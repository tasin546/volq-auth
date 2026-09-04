'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  accentColor?: string; // e.g. 'brand', 'success', 'warning', 'danger'
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = 'brand',
}) => {
  const getBadgeStyle = () => {
    switch (accentColor) {
      case 'success':
        return 'text-status-success bg-status-success/10 border-status-success/20';
      case 'warning':
        return 'text-status-warning bg-status-warning/10 border-status-warning/20';
      case 'danger':
        return 'text-status-danger bg-status-danger/10 border-status-danger/20';
      default:
        return 'text-brand bg-brand/10 border-brand/20';
    }
  };

  return (
    <div className="bg-obsidian-card border border-obsidian-border rounded-xl p-5 hover:border-obsidian-borderFocus transition shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-text-secondary">{title}</span>
        <div className={`p-2 rounded-lg border ${getBadgeStyle()}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-text-primary">{value}</span>
        {trend && <span className="text-[11px] font-medium text-status-success">{trend}</span>}
      </div>
      {subtitle && <p className="text-[11px] text-text-muted mt-1">{subtitle}</p>}
    </div>
  );
};
