import React, { useState, useEffect, useCallback } from 'react';
import {
  Radar,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  BellRing,
  ArrowRight,
  ShieldCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { SUPPORTED_ROUTES, ROUTE_AIRPORTS } from '../api/flights';
import { listAlertsApi } from '../api/alerts';
import { PriceAlert } from '../types';
import { formatCurrencyINR } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useTelemetry } from '../context/TelemetryContext';

interface FlightRadarViewProps {
  onSelectRouteForAlert: (origin: string, destination: string, defaultPrice: number) => void;
  onRefreshBadges?: () => void;
  onNavigateToAlerts?: () => void;
}

export const FlightRadarView: React.FC<FlightRadarViewProps> = ({
  onSelectRouteForAlert,
  onRefreshBadges,
  onNavigateToAlerts,
}) => {
  const { isAuthenticated } = useAuth();
  const { countdown, isScanning: isLoading, routesData, scanAllPrices, registerOnPriceTrigger } = useTelemetry();
  const [userAlerts, setUserAlerts] = useState<PriceAlert[]>([]);

  const fetchUserAlerts = useCallback(async () => {
    if (!isAuthenticated) {
      setUserAlerts([]);
      return;
    }
    try {
      const data = await listAlertsApi('all');
      setUserAlerts(data);
    } catch {
      // Ignore background errors
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchUserAlerts();
  }, [fetchUserAlerts]);

  // Synchronize user alerts whenever a price drop triggers in global telemetry
  useEffect(() => {
    return registerOnPriceTrigger(() => {
      fetchUserAlerts();
      if (onRefreshBadges) onRefreshBadges();
    });
  }, [registerOnPriceTrigger, fetchUserAlerts, onRefreshBadges]);

  const handleScanPrices = () => {
    scanAllPrices(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-sky-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Radar className="w-4 h-4 animate-spin text-sky-400" />
            Live Aeronautical Telemetry Feed
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
            Live Flight Radar & Routes
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time fluctuating airline pricing stream with instant event-driven alert triggers and synchronized 30s Celery Beat checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Next Scan: {countdown}s</span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleScanPrices()}
            isLoading={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            title="Scan fresh fluctuating flight prices right now"
          >
            Scan Now
          </Button>
        </div>
      </div>

      {/* Route Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {SUPPORTED_ROUTES.map((routeKey) => {
          const [origin, destination] = routeKey.split('-');
          const meta = ROUTE_AIRPORTS[routeKey];
          const data = routesData[routeKey];
          const price = data ? data.price : meta.min;
          const prev = data ? data.prevPrice : null;
          const diff = prev ? price - prev : 0;
          const routeMin = data?.minPrice ?? meta.min;
          const routeMax = data?.maxPrice ?? meta.max;
          const percentOfRange = Math.round(((price - routeMin) / (routeMax - routeMin)) * 100);

          // Check if the user has active or triggered alerts for this route (supports multiple alerts)
          const routeAlerts = userAlerts.filter(
            (a) => a.origin === origin && a.destination === destination
          );
          const routeActiveAlerts = routeAlerts.filter((a) => a.status === 'active');
          const routeTriggeredAlerts = routeAlerts.filter((a) => a.status === 'triggered');
          const isActive = routeActiveAlerts.length > 0;
          const isTriggered = routeTriggeredAlerts.length > 0;

          return (
            <Card
              key={routeKey}
              className={`relative overflow-hidden group transition-all duration-300 ${
                isTriggered
                  ? 'border-purple-500/50 shadow-lg shadow-purple-500/10 bg-slate-900/90'
                  : isActive
                  ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/5'
                  : 'border-slate-800/90 hover:border-sky-500/40'
              }`}
            >
              {/* Top Accent Line */}
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isTriggered
                    ? 'bg-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.7)]'
                    : isActive
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : data?.status === 'low'
                    ? 'bg-emerald-400'
                    : data?.status === 'high'
                    ? 'bg-rose-400'
                    : 'bg-sky-400'
                }`}
              />

              <div className="flex items-start justify-between mb-4">
                {/* Route Header */}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-black font-mono tracking-wider text-slate-100">
                      {origin}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <span className="text-lg font-black font-mono tracking-wider text-slate-100">
                      {destination}
                    </span>

                    {/* Live Alert Status Badges (Handles Multiple Alerts) */}
                    {routeActiveAlerts.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          <BellRing className="w-3 h-3 text-emerald-400" />
                          {routeActiveAlerts.length > 1 ? `${routeActiveAlerts.length} Alerts Active` : 'Alert Active'}
                        </span>
                        {routeActiveAlerts.map((alert) => (
                          <span
                            key={alert.id}
                            className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-xs"
                            title={`Alert #${alert.id}: Target ≤${formatCurrencyINR(alert.threshold_price)}`}
                          >
                            ≤{formatCurrencyINR(alert.threshold_price)}
                          </span>
                        ))}
                      </div>
                    )}

                    {routeTriggeredAlerts.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/50 animate-pulse">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          {routeTriggeredAlerts.length > 1 ? `${routeTriggeredAlerts.length} Triggered!` : 'Triggered!'}
                        </span>
                        {routeTriggeredAlerts.map((alert) => (
                          <span
                            key={alert.id}
                            className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-200 border border-purple-500/40 shadow-xs"
                            title={`Triggered Alert #${alert.id}: Target ≤${formatCurrencyINR(alert.threshold_price)}`}
                          >
                            ≤{formatCurrencyINR(alert.threshold_price)}
                          </span>
                        ))}
                      </div>
                    )}

                    {!isActive && !isTriggered && data?.status === 'low' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Sparkles className="w-3 h-3" />
                        Best Value
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    <span>{meta.originName}</span>
                    <span>→</span>
                    <span>{meta.destName}</span>
                    {data?.flightNumber && (
                      <span className="font-mono text-cyan-400 text-[11px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {data.airline} • {data.flightNumber}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        data?.isRealTime
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                      }`}
                    >
                      {data?.isRealTime ? '● Amadeus Live API' : '○ Simulator Feed'}
                    </span>
                  </div>
                </div>


                {/* Price Display */}
                <div className="text-right">
                  <div className="text-2xl font-black font-mono text-slate-100 tracking-tight">
                    {formatCurrencyINR(price)}
                  </div>
                  {diff !== 0 && (
                    <div
                      className={`flex items-center justify-end gap-1 text-xs font-mono font-medium ${
                        diff < 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {diff < 0 ? (
                        <>
                          <TrendingDown className="w-3.5 h-3.5" />
                          <span>-₹{Math.abs(diff)}</span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+₹{diff}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Price Range Visualizer */}
              <div className="space-y-1.5 mb-5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Range: {formatCurrencyINR(routeMin)}</span>
                  <span>{percentOfRange}% of peak</span>
                  <span>{formatCurrencyINR(routeMax)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isTriggered
                        ? 'bg-purple-400'
                        : isActive
                        ? 'bg-emerald-400'
                        : data?.status === 'low'
                        ? 'bg-emerald-400'
                        : data?.status === 'high'
                        ? 'bg-rose-400'
                        : 'bg-sky-400'
                    }`}
                    style={{ width: `${Math.max(8, Math.min(100, percentOfRange))}%` }}
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="text-[11px] font-mono text-slate-500">
                  API: /api/flights/price/?route={routeKey}
                </span>
                <div className="flex items-center gap-2">
                  {(isActive || isTriggered) && onNavigateToAlerts && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onNavigateToAlerts}
                      className="text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 px-2"
                    >
                      View in Hub
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={isActive ? 'secondary' : 'outline'}
                    onClick={() => onSelectRouteForAlert(origin, destination, price)}
                    icon={<BellRing className="w-3.5 h-3.5 text-sky-400" />}
                    className="hover:border-sky-500 hover:text-sky-300"
                  >
                    {isActive ? 'Add Another Alert' : 'Set Price Alert'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* System Explanation Banner */}
      <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-semibold text-slate-100">
            How Route Batching & Asynchronous Monitoring Operates:
          </div>
          <p className="text-slate-400 leading-relaxed">
            PulseNotify clusters alerts by distinct origin-destination pairs. Even if 1,000 users monitor{' '}
            <code className="text-sky-300 font-mono">DEL-BOM</code>, the backend worker queries the pricing feed
            only once per 30-second Celery Beat tick (with instant zero-delay evaluation whenever a price drop is ingested), checking all user budgets in memory against the shared Redis price snapshot.
          </p>
        </div>
      </div>
    </div>
  );
};
