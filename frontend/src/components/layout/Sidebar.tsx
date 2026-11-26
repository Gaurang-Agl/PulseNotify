import React from 'react';
import {
  Radar,
  BellRing,
  Inbox,
  BarChart3,
  FlaskConical,
  BookOpen,
  ExternalLink,
  Plane,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeAlertsCount?: number;
  unreadNotificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeAlertsCount = 0,
  unreadNotificationsCount = 0,
}) => {
  const { isAdmin } = useAuth();

  const navItems = [
    {
      id: 'radar',
      label: 'Live Flight Radar',
      icon: Radar,
      badge: null,
    },
    {
      id: 'alerts',
      label: 'Price Alerts Hub',
      icon: BellRing,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'notifications',
      label: 'Notification Center',
      icon: Inbox,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : null,
      badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    },
    {
      id: 'admin',
      label: 'Admin Intelligence',
      icon: BarChart3,
      badge: isAdmin ? 'ADMIN' : 'RBAC',
      badgeColor: isAdmin
        ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
        : 'bg-slate-800 text-slate-500 border-slate-700',
    },
    {
      id: 'simulator',
      label: 'Trigger Simulator',
      icon: FlaskConical,
      badge: 'TEST',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    {
      id: 'docs',
      label: 'Architecture & Guide',
      icon: BookOpen,
      badge: null,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-cyan-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
          <Plane className="w-5 h-5 -rotate-45" />
        </div>
        <div>
          <div className="font-bold text-slate-100 text-base tracking-tight flex items-center gap-1.5">
            PulseNotify
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium bg-sky-500/20 text-sky-400 border border-sky-500/30">
              v1.0
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">Flight Price Engine</div>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase font-mono">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-sky-400' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== null && (
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                    item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer System Links */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Django Admin UI</span>
          <a
            href="http://localhost:8000/admin/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sky-400 hover:underline"
          >
            Browser UI <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="text-[10px] text-slate-500 leading-tight">
          Backend: PostgreSQL 17 + Redis 7 + Celery Beat (30s) + Instant Evaluation
        </div>
      </div>
    </aside>
  );
};
