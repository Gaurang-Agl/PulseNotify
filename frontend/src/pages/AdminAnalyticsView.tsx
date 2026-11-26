import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  RefreshCw,
  BellRing,
  CheckCircle,
  Inbox,
  TrendingUp,
  Terminal,
  Copy,
  Check,
  User,
  CheckCircle2,
  Clock,
  Plane,
  Tag,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { getAdminSummaryApi } from '../api/admin';
import { getQuotaTelemetryApi, resetQuotaApi } from '../api/quota';
import { AdminSummaryResponse, QuotaTelemetry } from '../types';
import { formatCurrencyINR, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { parseApiError } from '../api/client';

export const AdminAnalyticsView: React.FC = () => {
  const { user, isAuthenticated, isAdmin, openAuthModal, switchDemoUser } = useAuth();
  const { success, error } = useToast();
  const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
  const [quota, setQuota] = useState<QuotaTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasCopied, setHasCopied] = useState<boolean>(false);
  const [isResettingQuota, setIsResettingQuota] = useState<boolean>(false);

  const fetchAdminSummary = useCallback(async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [sumData, quotaData] = await Promise.all([
        getAdminSummaryApi(),
        getQuotaTelemetryApi().catch(() => null),
      ]);
      setSummary(sumData);
      setQuota(quotaData);
    } catch (err) {
      error(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, error]);

  const handleResetQuota = async () => {
    setIsResettingQuota(true);
    try {
      await resetQuotaApi();
      success('External API Quota has been reset to 0.');
      const updated = await getQuotaTelemetryApi();
      setQuota(updated);
    } catch {
      error('Failed to reset quota.');
    } finally {
      setIsResettingQuota(false);
    }
  };

  useEffect(() => {
    fetchAdminSummary();
  }, [fetchAdminSummary]);


  const copyShellCommand = () => {
    const cmd = `python manage.py shell -c "from django.contrib.auth.models import User; u = User.objects.get(username='${user?.username || 'admin_user'}'); u.profile.role='admin'; u.profile.save(); print('Promoted', u.username, 'to', u.profile.role)"`;
    navigator.clipboard.writeText(cmd);
    setHasCopied(true);
    success('Promotion command copied to clipboard!');
    setTimeout(() => setHasCopied(false), 2500);
  };

  // RBAC Lock View if not Admin
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-purple-400 font-mono text-xs uppercase tracking-wider mb-1">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            Role-Based Access Control (RBAC) Enforcement
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Administrator Intelligence Hub
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Only users with role <code className="text-purple-300 font-mono">admin</code> are authorized to access <code className="text-sky-300 font-mono">/api/admin/summary/</code>.
          </p>
        </div>

        <Card className="text-center py-12 max-w-xl mx-auto border-purple-500/20 bg-slate-900/40">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto mb-4 shadow-inner">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>

          <h3 className="text-lg font-bold text-slate-100 mb-2">
            Admin Privileges Required (HTTP 403)
          </h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Public user registration strictly defaults accounts to <span className="text-emerald-400 font-mono">role: 'user'</span>. To view platform-wide telemetry, switch to the pre-seeded admin profile or promote your account.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => switchDemoUser('admin')}
              icon={<Shield className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
            >
              Sign In as admin_user
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={openAuthModal}
              className="w-full sm:w-auto"
            >
              Custom Login
            </Button>
          </div>

          {/* Quick Terminal Guide */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 text-left">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                Promote Any User via Django Shell:
              </span>
              <button
                onClick={copyShellCommand}
                className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300"
              >
                {hasCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{hasCopied ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800">
              {`python manage.py shell -c "from django.contrib.auth.models import User; u = User.objects.get(username='${user?.username || 'admin_user'}'); u.profile.role='admin'; u.profile.save()"`}
            </pre>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-purple-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-purple-400" />
            Platform Telemetry & Analytics
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Admin Intelligence Hub
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            System-wide statistics aggregated directly from PostgreSQL (<code className="text-sky-300 font-mono">/api/admin/summary/</code>).
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={fetchAdminSummary}
          isLoading={isLoading}
          icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh Stats
        </Button>
      </div>

      {isLoading && !summary ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
          Loading platform analytics...
        </div>
      ) : summary ? (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Total Alerts
                </span>
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                  <BellRing className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-slate-100 mt-2">
                {summary.total_alerts}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-1">
                Configured across all users
              </div>
            </Card>

            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider font-mono">
                  Active Monitors
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <RefreshCw className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-emerald-400 mt-2">
                {summary.active_alerts}
              </div>
              <div className="text-[11px] text-emerald-500/70 font-mono mt-1">
                Checked every 30s & instantly on price arrival
              </div>
            </Card>

            <Card className="border-sky-500/20 bg-sky-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider font-mono">
                  Triggered Alerts
                </span>
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-sky-400 mt-2">
                {summary.triggered_alerts}
              </div>
              <div className="text-[11px] text-sky-500/70 font-mono mt-1">
                Threshold price satisfied
              </div>
            </Card>

            <Card className="border-purple-500/20 bg-purple-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider font-mono">
                  Notifications Logged
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <Inbox className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black font-mono text-purple-300 mt-2">
                {summary.total_notifications}
              </div>
              <div className="text-[11px] text-purple-400/70 font-mono mt-1">
                Dispatched by Celery workers
              </div>
            </Card>
          </div>

          {/* Top Watched Routes Ranking */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Top Watched Flight Routes
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500">
                Ranked by Total Alert Count
              </span>
            </div>

            {summary.top_routes.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-mono">
                No routes monitored yet. Create alerts in the Alerts Hub to generate route analytics.
              </div>
            ) : (
              <div className="space-y-3">
                {summary.top_routes.map((item, idx) => {
                  const maxAlerts = summary.top_routes[0]?.alert_count || 1;
                  const percent = Math.round((item.alert_count / maxAlerts) * 100);

                  return (
                    <div key={item.route} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-4 font-bold">#{idx + 1}</span>
                          <span className="text-slate-200 font-bold tracking-wider">
                            {item.route}
                          </span>
                        </div>
                        <span className="text-sky-400 font-semibold">
                          {item.alert_count} alert{item.alert_count > 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Complete Multi-Tenant Master Registry */}
          {summary.alerts && (
            <Card className="space-y-4 border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                    <BellRing className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      Multi-Tenant Alerts Master Registry
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                        {summary.alerts.length} Total Monitors
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Unified cross-user registry displaying traveler alerts, operating airlines, target budgets, real-time live ticket fares, and instant execution states.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto text-xs font-mono">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                    {summary.alerts.filter((a) => a.status === 'triggered').length} Triggered
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                    {summary.alerts.filter((a) => a.status === 'active').length} Active
                  </span>
                </div>
              </div>

              {summary.alerts.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono">
                  No alerts created across the system yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">Alert ID</th>
                        <th className="py-2.5 px-3">Traveler User</th>
                        <th className="py-2.5 px-3">Route & Operating Airline</th>
                        <th className="py-2.5 px-3">Target Budget</th>
                        <th className="py-2.5 px-3">Live Fare & Evaluation Tag</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Created / Triggered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {summary.alerts.map((alert) => {
                        const savings =
                          alert.triggered_price && alert.threshold_price > alert.triggered_price
                            ? alert.threshold_price - alert.triggered_price
                            : 0;

                        return (
                          <tr
                            key={alert.id}
                            className={`transition-colors ${
                              alert.status === 'triggered'
                                ? 'bg-emerald-950/20 hover:bg-emerald-900/30'
                                : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td className="py-3 px-3 font-mono text-slate-500">#{alert.id}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5 font-medium text-slate-200">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                  alert.status === 'triggered'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}>
                                  <User className="w-3 h-3" />
                                </span>
                                <span className="font-mono font-bold text-slate-100">
                                  {alert.username}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-400">
                                  {alert.route}
                                </span>
                                {alert.airline && (
                                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                                    <Plane className="w-3 h-3 text-sky-400" />
                                    <span>{alert.airline}</span>
                                    {alert.flight_number && (
                                      <span className="text-slate-500">({alert.flight_number})</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-100">
                              &lt; {formatCurrencyINR(alert.threshold_price)}
                            </td>
                            <td className="py-3 px-3">
                              {alert.status === 'triggered' ? (
                                <div className="space-y-0.5 font-mono">
                                  <div className="text-emerald-400 font-bold text-sm">
                                    {alert.triggered_price ? formatCurrencyINR(alert.triggered_price) : 'Triggered'}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                      <Tag className="w-2.5 h-2.5" /> Trigger Tag
                                    </span>
                                    {savings > 0 && (
                                      <span className="text-[10px] text-emerald-300 font-bold">
                                        (+{formatCurrencyINR(savings)} saved)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : alert.status === 'active' ? (
                                <div className="space-y-0.5 font-mono">
                                  <div className="text-slate-200 font-bold">
                                    {alert.live_price ? formatCurrencyINR(alert.live_price) : 'Scanning...'}
                                  </div>
                                  {alert.distance_to_trigger !== null && alert.distance_to_trigger !== undefined && (
                                    <div className="text-[10px] text-amber-400">
                                      {alert.distance_to_trigger > 0
                                        ? `Needs drop of ₹${Math.round(alert.distance_to_trigger)}`
                                        : 'Eligible for instant trigger'}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono">Inactive</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {alert.status === 'triggered' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Triggered
                                </span>
                              ) : alert.status === 'active' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                                  <Clock className="w-3 h-3 animate-pulse" />
                                  Active (30s Polling)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                              {alert.triggered_at ? (
                                <div>
                                  <div className="text-emerald-400 font-bold">
                                    {formatDate(alert.triggered_at)}
                                  </div>
                                  <div className="text-slate-500 text-[10px]">
                                    Created: {formatDate(alert.created_at)}
                                  </div>
                                </div>
                              ) : (
                                formatDate(alert.created_at)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* External API Quota & Milestone Monitor */}
          {quota && (
            <Card className="space-y-5 border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                    <h3 className="text-base font-bold text-slate-100">
                      External Flight API Quota & Milestone Monitor
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monthly third-party call allowance tracker with threshold alerts configured at 25%, 50%, 60%, 70%, 80%, and 90%.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAdminSummary}
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleResetQuota}
                    isLoading={isResettingQuota}
                  >
                    Reset Quota
                  </Button>
                </div>
              </div>

              {/* Progress Bar with Milestones */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">
                    Cycle: <strong>{quota.month_key}</strong>
                  </span>
                  <span className={`font-bold ${
                    quota.consumed_percentage >= 90
                      ? 'text-rose-400'
                      : quota.consumed_percentage >= 70
                      ? 'text-orange-400'
                      : quota.consumed_percentage >= 50
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {quota.consumed_percentage.toFixed(1)}% Consumed
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      quota.consumed_percentage >= 90
                        ? 'bg-rose-500'
                        : quota.consumed_percentage >= 70
                        ? 'bg-orange-500'
                        : quota.consumed_percentage >= 50
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, quota.consumed_percentage)}%` }}
                  />
                </div>

                {/* Milestone Threshold Notches */}
                <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
                  {quota.alert_thresholds.map((th) => {
                    const isPassed = quota.alerted_milestones.includes(th);
                    return (
                      <span
                        key={th}
                        className={`transition-colors ${
                          isPassed ? 'text-amber-400 font-bold' : 'text-slate-600'
                        }`}
                      >
                        {isPassed ? '✓ ' : ''}{th}%
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* 4 Stats Chips */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400">Calls Consumed</span>
                  <p className="text-xl font-bold font-mono text-slate-100 mt-1">{quota.used_calls}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400">Remaining Calls</span>
                  <p className="text-xl font-bold font-mono text-emerald-400 mt-1">{quota.remaining_calls}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400">Monthly Limit</span>
                  <p className="text-xl font-bold font-mono text-slate-100 mt-1">{quota.monthly_limit}</p>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400">Alerted Thresholds</span>
                  <p className="text-sm font-bold font-mono text-amber-400 mt-1.5">
                    {quota.alerted_milestones.length > 0
                      ? quota.alerted_milestones.map((m) => `${m}%`).join(', ')
                      : 'None triggered'}
                  </p>
                </div>
              </div>

              {/* Recent Quota Milestone Alerts Audit Log */}
              <div className="space-y-3 pt-2">
                <div className="text-xs font-semibold text-slate-200 uppercase font-mono tracking-wider">
                  Milestone Alert Audit Log ({quota.recent_alerts.length})
                </div>

                {quota.recent_alerts.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 font-mono bg-slate-950/40 rounded-lg border border-slate-800">
                    No milestone alerts logged yet this month. Alerts trigger automatically at 25%, 50%, 60%, 70%, 80%, and 90%.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Milestone</th>
                          <th className="py-2 px-3">Used / Cap</th>
                          <th className="py-2 px-3">Trigger Route</th>
                          <th className="py-2 px-3">Provider</th>
                          <th className="py-2 px-3">Message</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {quota.recent_alerts.map((al) => (
                          <tr key={al.id} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                {al.milestone}%
                              </span>
                            </td>
                            <td className="py-2 px-3">{al.used_calls} / {al.monthly_limit}</td>
                            <td className="py-2 px-3 text-cyan-400 font-bold">{al.triggering_route || 'N/A'}</td>
                            <td className="py-2 px-3 text-slate-400">{al.triggering_provider}</td>
                            <td className="py-2 px-3 max-w-md truncate text-slate-300">{al.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
};
