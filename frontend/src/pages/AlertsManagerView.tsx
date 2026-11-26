import React, { useState, useEffect, useCallback } from 'react';
import {
  BellRing,
  Plus,
  Filter,
  Eye,
  ArrowRight,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import {
  listAlertsApi,
  createAlertApi,
  deactivateAlertApi,
  getAlertDetailApi,
} from '../api/alerts';
import { ROUTE_AIRPORTS } from '../api/flights';
import { PriceAlert } from '../types';
import { formatCurrencyINR, formatDate } from '../utils/formatters';
import { getAlertStatusBadge } from '../utils/badges';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { parseApiError } from '../api/client';

interface AlertsManagerViewProps {
  initialOrigin?: string;
  initialDestination?: string;
  initialThreshold?: number;
  onClearInitialRoute?: () => void;
}

export const AlertsManagerView: React.FC<AlertsManagerViewProps> = ({
  initialOrigin = '',
  initialDestination = '',
  initialThreshold,
  onClearInitialRoute,
}) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { success, error, warning } = useToast();

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>(initialOrigin);
  const [destination, setDestination] = useState<string>(initialDestination);
  const [threshold, setThreshold] = useState<string>(
    initialThreshold ? String(initialThreshold) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Detail Modal State
  const [activeDetail, setActiveDetail] = useState<PriceAlert | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await listAlertsApi(selectedFilter);
      setAlerts(data);
    } catch (err) {
      error(parseApiError(err));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, selectedFilter, error]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 6000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Open create modal if initial route passed from Radar tab
  useEffect(() => {
    if (initialOrigin && initialDestination) {
      setOrigin(initialOrigin);
      setDestination(initialDestination);
      if (initialThreshold) setThreshold(String(initialThreshold));
      setIsCreateModalOpen(true);
      if (onClearInitialRoute) onClearInitialRoute();
    }
  }, [initialOrigin, initialDestination, initialThreshold, onClearInitialRoute]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrigin = origin.trim().toUpperCase();
    const cleanDest = destination.trim().toUpperCase();
    const numericPrice = parseFloat(threshold);

    if (cleanOrigin.length !== 3 || cleanDest.length !== 3) {
      error('Airport codes must be 3-letter IATA codes (e.g. DEL, BOM).');
      return;
    }
    if (cleanOrigin === cleanDest) {
      error('Origin and Destination cannot be identical.');
      return;
    }
    if (isNaN(numericPrice) || numericPrice <= 0) {
      error('Threshold price must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createAlertApi({
        origin: cleanOrigin,
        destination: cleanDest,
        threshold_price: numericPrice,
      });

      const routeKey = `${cleanOrigin}-${cleanDest}`;
      const routeMeta = ROUTE_AIRPORTS[routeKey];
      if (routeMeta && numericPrice < routeMeta.min) {
        warning(`Alert saved @ ${formatCurrencyINR(numericPrice)} (Note: Below route minimum of ${formatCurrencyINR(routeMeta.min)}).`);
      } else if (routeMeta && numericPrice > routeMeta.max) {
        warning(`Alert saved @ ${formatCurrencyINR(numericPrice)} (Note: Above route maximum of ${formatCurrencyINR(routeMeta.max)}).`);
      } else {
        success(`Price alert created for ${created.origin}-${created.destination} @ ${formatCurrencyINR(created.threshold_price)}`);
      }

      setIsCreateModalOpen(false);
      setOrigin('');
      setDestination('');
      setThreshold('');
      fetchAlerts();
    } catch (err) {
      error(parseApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await deactivateAlertApi(id);
      success('Alert deactivated (marked inactive).');
      // Optimistic update
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'inactive' } : a))
      );
    } catch (err) {
      error(parseApiError(err));
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const detail = await getAlertDetailApi(id);
      setActiveDetail(detail);
    } catch (err) {
      error(parseApiError(err));
    }
  };

  const filterTabs = [
    { id: 'all', label: 'All Alerts' },
    { id: 'active', label: 'Active' },
    { id: 'triggered', label: 'Triggered' },
    { id: 'inactive', label: 'Inactive' },
  ];

  if (!isAuthenticated) {
    return (
      <Card className="text-center py-16">
        <EmptyState
          icon={BellRing}
          title="Sign in to View & Create Price Alerts"
          description="PulseNotify price monitors are securely scoped to your individual account. Log in or create a traveler account to track flights."
          actionLabel="Sign In Now"
          onAction={openAuthModal}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-mono text-xs uppercase tracking-wider mb-1">
            <BellRing className="w-4 h-4 text-sky-400" />
            Threshold Monitor Engine
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Flight Price Alerts
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage your personal flight monitors. Celery Beat evaluates active alerts every 30s & instantly upon price arrival against live airline feeds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAlerts}
            isLoading={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            icon={<Plus className="w-4 h-4" />}
          >
            New Alert
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 overflow-x-auto">
        <span className="text-xs text-slate-500 font-mono mr-2 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          Filter:
        </span>
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedFilter === tab.id
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alerts Table / List */}
      {isLoading && alerts.length === 0 ? (
        <div className="p-12 text-center text-slate-500 font-mono text-xs animate-pulse">
          Loading alerts from PostgreSQL...
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <EmptyState
            icon={BellRing}
            title={selectedFilter === 'all' ? 'No Price Alerts Set' : `No ${selectedFilter} alerts`}
            description="Create your first flight price alert to receive an instant notification whenever the ticket drops below your target budget."
            actionLabel="Create Price Alert"
            onAction={() => setIsCreateModalOpen(true)}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className="relative group border-slate-800/90 hover:border-slate-700 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black font-mono tracking-wider text-slate-100">
                    {alert.origin}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="text-lg font-black font-mono tracking-wider text-slate-100">
                    {alert.destination}
                  </span>
                </div>
                {getAlertStatusBadge(alert.status)}
              </div>

              <div className="space-y-2 mb-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800/70">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Target Budget:</span>
                  <span className="text-base font-bold font-mono text-slate-100">
                    {formatCurrencyINR(alert.threshold_price)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <span>Created:</span>
                  <span>{formatDate(alert.created_at)}</span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="text-[10px] font-mono text-slate-500">ID #{alert.id}</span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewDetail(alert.id)}
                    className="px-2 text-slate-400 hover:text-slate-200"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </Button>

                  {alert.status === 'active' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeactivate(alert.id)}
                      className="text-xs px-2.5 py-1"
                      title="Deactivate alert (Soft Delete)"
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Alert Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Flight Price Alert"
        subtitle="Specify origin, destination, and your maximum threshold budget in INR (₹)"
        maxWidth="md"
      >
        <form onSubmit={handleCreateAlert} className="space-y-4">
          {/* Quick Route Presets */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-400 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Quick Supported Routes:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { o: 'DEL', d: 'BOM', defaultP: 4500 },
                { o: 'BLR', d: 'HYD', defaultP: 2500 },
                { o: 'DEL', d: 'BLR', defaultP: 5500 },
                { o: 'BOM', d: 'GOA', defaultP: 3000 },
              ].map((preset) => (
                <button
                  key={`${preset.o}-${preset.d}`}
                  type="button"
                  onClick={() => {
                    setOrigin(preset.o);
                    setDestination(preset.d);
                    setThreshold(String(preset.defaultP));
                  }}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-slate-300 font-mono text-left transition-colors"
                >
                  <span className="font-bold text-sky-400">{preset.o}</span> →{' '}
                  <span className="font-bold text-sky-400">{preset.d}</span>
                  <span className="block text-[10px] text-slate-400">
                    Est: {formatCurrencyINR(preset.defaultP)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Origin IATA Code
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={origin}
                onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                placeholder="DEL"
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono uppercase font-bold text-center tracking-widest"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Destination IATA Code
              </label>
              <input
                type="text"
                required
                maxLength={3}
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                placeholder="BOM"
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono uppercase font-bold text-center tracking-widest"
              />
            </div>
          </div>

          {(() => {
            const currentRouteKey = `${origin.trim().toUpperCase()}-${destination.trim().toUpperCase()}`;
            const routeMeta = ROUTE_AIRPORTS[currentRouteKey];
            const numThreshold = parseFloat(threshold);
            const hasThreshold = !isNaN(numThreshold) && numThreshold > 0;

            return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                    Maximum Threshold Price (₹ INR)
                  </label>
                  {routeMeta && (
                    <span className="text-[11px] font-mono text-slate-400">
                      Fare Bracket: <strong className="text-slate-200">{formatCurrencyINR(routeMeta.min)} – {formatCurrencyINR(routeMeta.max)}</strong>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    required
                    min={1}
                    step="any"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                    placeholder={routeMeta ? String(Math.round((routeMeta.min + routeMeta.max) / 2)) : "4500"}
                    className={`w-full bg-slate-950/80 border rounded-lg pl-8 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono font-semibold transition-colors ${
                      routeMeta && hasThreshold && (numThreshold < routeMeta.min || numThreshold > routeMeta.max)
                        ? 'border-amber-500/70 focus:border-amber-400'
                        : 'border-slate-700 focus:border-sky-500'
                    }`}
                  />
                </div>

                {/* Real-time Dynamic Advisory Guidance */}
                {routeMeta && hasThreshold && numThreshold < routeMeta.min && (
                  <div className="mt-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-300 block">Notice: Price Below Route Minimum</span>
                      <p className="text-[11px] leading-relaxed text-amber-200/90">
                        The minimum ticket fare for <strong className="text-white font-mono">{currentRouteKey}</strong> starts at <strong className="text-white font-mono">{formatCurrencyINR(routeMeta.min)}</strong>. Setting an alert below this falls outside the flight's pricing bracket and will not be able to trigger. Consider increasing your alert price to at least <strong className="text-white font-mono">{formatCurrencyINR(routeMeta.min)}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {routeMeta && hasThreshold && numThreshold > routeMeta.max && (
                  <div className="mt-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200 animate-fadeIn">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold text-amber-300 block">Notice: Price Above Route Maximum</span>
                      <p className="text-[11px] leading-relaxed text-amber-200/90">
                        The maximum ticket fare for <strong className="text-white font-mono">{currentRouteKey}</strong> is capped at <strong className="text-white font-mono">{formatCurrencyINR(routeMeta.max)}</strong>. Setting an alert above this falls outside the flight's price ceiling. Consider setting an alert price within the viable bracket of <strong className="text-white font-mono">{formatCurrencyINR(routeMeta.min)} to {formatCurrencyINR(routeMeta.max)}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {routeMeta && hasThreshold && numThreshold >= routeMeta.min && numThreshold <= routeMeta.max && (
                  <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-xs text-emerald-200 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-200/90">
                      <strong className="text-emerald-300">Optimal Target:</strong> Within viable route range (<strong className="font-mono text-white">{formatCurrencyINR(routeMeta.min)} – {formatCurrencyINR(routeMeta.max)}</strong>). Triggers when price drops ≤ <strong className="font-mono text-white">{formatCurrencyINR(numThreshold)}</strong>.
                    </p>
                  </div>
                )}

                {!hasThreshold && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Trigger condition: Fired when live price is strictly less than or equal to this budget.
                  </p>
                )}
              </div>
            );
          })()}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Price Alert
            </Button>
          </div>
        </form>
      </Modal>

      {/* Alert Detail Modal */}
      <Modal
        isOpen={!!activeDetail}
        onClose={() => setActiveDetail(null)}
        title={activeDetail ? `Alert Details #${activeDetail.id}` : 'Alert Details'}
        subtitle="Detailed record retrieved from GET /api/alerts/<id>/"
        maxWidth="sm"
      >
        {activeDetail && (
          <div className="space-y-4">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold font-mono text-slate-100">
                    {activeDetail.origin}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  <span className="text-xl font-bold font-mono text-slate-100">
                    {activeDetail.destination}
                  </span>
                </div>
                {getAlertStatusBadge(activeDetail.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Threshold:</span>
                  <span className="font-mono font-bold text-slate-100 text-sm">
                    {formatCurrencyINR(activeDetail.threshold_price)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Database ID:</span>
                  <span className="font-mono text-slate-200">#{activeDetail.id}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400 block">Registered At:</span>
                  <span className="font-mono text-slate-200">
                    {formatDate(activeDetail.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {activeDetail.status === 'active' ? (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    handleDeactivate(activeDetail.id);
                    setActiveDetail(null);
                  }}
                >
                  Deactivate Alert
                </Button>
              ) : (
                <div className="text-xs text-slate-500 font-mono">
                  State is immutable ({activeDetail.status})
                </div>
              )}

              <Button size="sm" variant="secondary" onClick={() => setActiveDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
