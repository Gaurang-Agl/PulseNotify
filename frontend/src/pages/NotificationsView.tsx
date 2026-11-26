import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { listNotificationsApi } from '../api/notifications';
import { NotificationLog } from '../types';
import { formatCurrencyINR, formatDate, formatTimeAgo } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { parseApiError } from '../api/client';

export const NotificationsView: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { error } = useToast();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await listNotificationsApi();
      setLogs(data);
    } catch (err) {
      error(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, error]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 6000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  if (!isAuthenticated) {
    return (
      <Card className="text-center py-16">
        <EmptyState
          icon={Inbox}
          title="Sign in to View Notifications"
          description="PulseNotify notification logs are scoped to your personal traveler account. Sign in to view your price drop events."
          actionLabel="Sign In Now"
          onAction={openAuthModal}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Inbox className="w-4 h-4 text-sky-400" />
            Asynchronous Event Audit Trail
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Notification History
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable log of all price drops that met your target threshold budgets. Generated via Celery worker background tasks.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchNotifications}
          isLoading={isLoading}
          icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh Log
        </Button>
      </div>

      {/* Notifications List */}
      {isLoading && logs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
          Loading notification logs...
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="No Notifications Triggered Yet"
            description="When an active price alert detects that an airline ticket has dropped to or below your budget, Celery workers will log the event here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card
              key={log.id}
              className="border-slate-800/80 hover:border-slate-700 transition-all p-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-inner mt-0.5">
                    <Sparkles className="w-5 h-5 text-sky-400" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-100">
                        {log.message}
                      </span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                        Alert #{log.alert}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(log.notified_at)} ({formatTimeAgo(log.notified_at)})
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800/60">
                  <span className="text-[11px] text-slate-500 font-mono">Triggered Price:</span>
                  <span className="text-lg font-black font-mono text-emerald-400">
                    {formatCurrencyINR(log.triggered_price)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
