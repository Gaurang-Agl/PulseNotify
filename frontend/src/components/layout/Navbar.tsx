import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, UserCheck, LogIn, LogOut, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { checkBackendHealth } from '../../api/flights';
import { clearAllPlatformDataApi } from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { parseApiError } from '../../api/client';
import { getUserRoleBadge } from '../../utils/badges';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { QuotaWidget } from './QuotaWidget';
import { useTelemetry } from '../../context/TelemetryContext';

interface NavbarProps {
  onRefreshAll?: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onRefreshAll, isRefreshing }) => {
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  const { countdown, isScanning } = useTelemetry();
  const { success, error } = useToast();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const checkHealth = async () => {
    const ok = await checkBackendHealth();
    setIsBackendHealthy(ok);
  };

  const handleClearAllData = async () => {
    setIsClearing(true);
    try {
      const res = await clearAllPlatformDataApi();
      success(
        `Wiped all platform data! Removed ${res.cleared.alerts} alerts, ${res.cleared.notifications} notifications.`
      );
      setIsClearConfirmOpen(false);
      if (onRefreshAll) {
        onRefreshAll();
      }
    } catch (err) {
      error(parseApiError(err));
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Backend Health & Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendHealthy === null
                ? 'bg-slate-500 animate-ping'
                : isBackendHealthy
                ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse'
                : 'bg-rose-500 shadow-lg shadow-rose-500/50'
            }`}
          />
          <span className="font-mono text-slate-300 hidden sm:inline">
            API Backend:{' '}
            <strong
              className={
                isBackendHealthy
                  ? 'text-emerald-400 font-semibold'
                  : isBackendHealthy === false
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }
            >
              {isBackendHealthy === null ? 'Pinging...' : isBackendHealthy ? 'Online (8000)' : 'Offline'}
            </strong>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-3 py-1 rounded-full border border-sky-500/30 shadow-sm">
          <Radio className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-amber-400' : 'animate-pulse text-emerald-400'}`} />
          <span className="font-mono text-[11px] font-semibold text-slate-200">
            Celery Beat: <span className="text-amber-300">30s Cycle</span>{' '}
            <span className="text-sky-400 font-bold">({countdown}s)</span> +{' '}
            <span className="text-emerald-400">Instant</span>
          </span>
        </div>

        {/* Third-Party API Quota Monitor */}
        <QuotaWidget />
      </div>


      {/* Right Controls: Refresh & Auth Status */}
      <div className="flex items-center gap-3">
        {onRefreshAll && (
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/60 transition-colors disabled:opacity-50"
            title="Refresh All Feeds & Alerts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
        )}

        {/* Clear Data Button (Admin Only) */}
        {isAuthenticated && user && user.role === 'admin' && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsClearConfirmOpen(true)}
            icon={<Trash2 className="w-3.5 h-3.5" />}
            title="Clear all alerts, notifications, and quota logs across all users"
            className="border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-mono text-xs"
          >
            Clear Data
          </Button>
        )}

        {isAuthenticated && user ? (
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
            <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200">{user.username}</span>
              {getUserRoleBadge(user.role)}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              title="Logout"
              className="px-2 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={openAuthModal}
            icon={<LogIn className="w-3.5 h-3.5" />}
          >
            Sign In / Register
          </Button>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title="Confirm Platform Data Wipe"
        subtitle="Irreversible system maintenance action for administrators"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-xs text-rose-200">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-300 block text-sm">Wipe All Alerts & Notifications?</span>
              <p className="leading-relaxed text-rose-200/90 text-xs">
                This will permanently delete <strong>all Price Alerts</strong> and <strong>all Notification Logs</strong> across <strong>every user</strong> (both regular travelers and administrators). It will also reset monthly quota consumption to 0 and flush Redis price cache.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsClearConfirmOpen(false)}
              disabled={isClearing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClearAllData}
              isLoading={isClearing}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Yes, Wipe All Data
            </Button>
          </div>
        </div>
      </Modal>
    </header>
  );
};
