import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  Sparkles,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { getFlightPriceApi, SUPPORTED_ROUTES } from '../api/flights';
import { listAlertsApi } from '../api/alerts';
import { simulateQuotaApi, resetQuotaApi } from '../api/quota';
import { formatCurrencyINR } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SimulatorView: React.FC = () => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const { success, error, info } = useToast();

  const [selectedRoute, setSelectedRoute] = useState<string>('DEL-BOM');
  const [simPrice, setSimPrice] = useState<number | null>(null);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [isSimulatingQuota, setIsSimulatingQuota] = useState<boolean>(false);
  const [simLog, setSimLog] = useState<string[]>([]);


  const addLog = (msg: string) => {
    setSimLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleFetchRoutePrice = async () => {
    setIsLoadingPrice(true);
    try {
      const res = await getFlightPriceApi(selectedRoute);
      setSimPrice(res.price);
      addLog(`Queried price feed: Route ${res.route} is currently ₹${res.price}`);
      if (res.triggered_alerts && res.triggered_alerts.length > 0) {
        addLog(`⚡ Instant Event Trigger: ${res.triggered_alerts.length} active alert(s) satisfied & dispatched to worker! (Alert IDs: ${res.triggered_alerts.join(', ')})`);
        success(`⚡ ${res.triggered_alerts.length} alert(s) triggered instantly on price scan!`);
      }
    } catch {
      error('Failed to query flight price feed.');
    } finally {
      setIsLoadingPrice(false);
    }
  };

  const handleEvaluateSimulation = async () => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    if (!simPrice) {
      error('Please scan the current route price first.');
      return;
    }

    addLog(`Evaluating active alerts against current price ${formatCurrencyINR(simPrice)}...`);
    try {
      const alerts = await listAlertsApi('active');
      const [origin, dest] = selectedRoute.split('-');
      const matching = alerts.filter((a) => a.origin === origin && a.destination === dest);

      if (matching.length === 0) {
        addLog(`No active alerts found monitoring ${selectedRoute}. Create an alert first!`);
        info(`No active alerts for ${selectedRoute}. Set an alert in Price Alerts Hub.`);
        return;
      }

      addLog(`Found ${matching.length} active alert(s) watching ${selectedRoute}.`);
      let triggeredCount = 0;
      matching.forEach((a) => {
        const threshold = parseFloat(String(a.threshold_price));
        if (simPrice <= threshold) {
          triggeredCount++;
          addLog(`✓ HIT: Alert #${a.id} threshold (${formatCurrencyINR(threshold)}) satisfied by current price (${formatCurrencyINR(simPrice)})!`);
        } else {
          addLog(`✗ WAIT: Alert #${a.id} threshold (${formatCurrencyINR(threshold)}) is below current price (${formatCurrencyINR(simPrice)}).`);
        }
      });

      if (triggeredCount > 0) {
        success(`${triggeredCount} alert(s) satisfied! Processed instantly by Celery worker.`);
      } else {
        info('No alerts met the threshold condition at this price.');
      }
    } catch {
      error('Evaluation check encountered an error.');
    }
  };

  const handleAdvanceQuota = async (pct: number) => {
    setIsSimulatingQuota(true);
    addLog(`Advancing External API Quota to ${pct}% for testing...`);
    try {
      const res = await simulateQuotaApi({ target_percentage: pct, route: selectedRoute, provider: 'amadeus' });
      addLog(`✓ Advanced: Quota now at ${res.percentage}% (${res.used_calls}/${res.monthly_limit} calls).`);
      if (res.newly_triggered && res.newly_triggered.length > 0) {
        res.newly_triggered.forEach((al) => {
          addLog(`⚡ MILESTONE ALERT: ${al.milestone}% threshold reached! Remaining: ${al.remaining} calls.`);
          success(`API Quota ${al.milestone}% milestone reached!`);
        });
      } else {
        info(`Quota reached ${res.percentage}%. Milestone already alerted.`);
      }
    } catch {
      error('Failed to advance quota.');
    } finally {
      setIsSimulatingQuota(false);
    }
  };

  const handleResetQuotaSimulator = async () => {
    setIsSimulatingQuota(true);
    addLog('Resetting API quota counter back to 0%...');
    try {
      await resetQuotaApi();
      addLog('✓ Quota counter reset to 0/2000. All milestone flags cleared.');
      success('Quota reset to 0.');
    } catch {
      error('Failed to reset quota.');
    } finally {
      setIsSimulatingQuota(false);
    }
  };

  return (

    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-amber-400 font-mono text-xs uppercase tracking-wider mb-1">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          Interactive Evaluation Sandbox
        </div>
        <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
          Concurrency & Trigger Simulator
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Simulate airline price checks and inspect threshold comparison logic without waiting for the 30-second Celery Beat clock.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulator Controls */}
        <div className="space-y-4">
          <Card className="space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Play className="w-4 h-4 text-amber-400" />
              Price Feed Probe
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">
                Select Route to Probe
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SUPPORTED_ROUTES.map((route) => (
                  <button
                    key={route}
                    type="button"
                    onClick={() => {
                      setSelectedRoute(route);
                      setSimPrice(null);
                    }}
                    className={`p-2 rounded-lg text-xs font-mono font-bold transition-all ${
                      selectedRoute === route
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                        : 'bg-slate-950/60 text-slate-400 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {route}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 font-mono block">Simulated Feed Price:</span>
                <span className="text-2xl font-black font-mono text-slate-100">
                  {simPrice ? formatCurrencyINR(simPrice) : '— Not Scanned —'}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFetchRoutePrice}
                isLoading={isLoadingPrice}
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingPrice ? 'animate-spin' : ''}`} />}
              >
                Scan Price
              </Button>
            </div>

            <Button
              variant="primary"
              onClick={handleEvaluateSimulation}
              disabled={!simPrice}
              icon={<Sparkles className="w-4 h-4" />}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950"
            >
              Evaluate Against My Active Alerts
            </Button>
          </Card>

          {/* Third-Party API Quota Milestone Testing Panel */}
          <Card className="space-y-3 border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  API Quota Milestone Alert Tester
                </h4>
              </div>
              <button
                onClick={handleResetQuotaSimulator}
                disabled={isSimulatingQuota}
                className="text-xs font-mono text-rose-400 hover:text-rose-300 underline"
              >
                Reset to 0%
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Test milestone alert transitions (25%, 50%, 60%, 70%, 80%, 90%) to verify that banner, toast, and audit logs trigger reliably.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[25, 50, 60, 70, 80, 90].map((th) => (
                <button
                  key={th}
                  onClick={() => handleAdvanceQuota(th)}
                  disabled={isSimulatingQuota}
                  className="py-1.5 px-2 rounded-lg text-xs font-mono font-bold bg-slate-900 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                >
                  Advance {th}%
                </button>
              ))}
            </div>
          </Card>

          {/* Quick Terminal Trigger Tip */}
          <Card className="bg-slate-950/60 border-slate-800 text-xs text-slate-400 space-y-2">

            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Terminal className="w-4 h-4 text-sky-400" />
              Manual Immediate Backend Trigger:
            </div>
            <p className="leading-relaxed">
              To trigger price checks directly inside Django shell without waiting for Celery Beat:
            </p>
            <pre className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-sky-300 overflow-x-auto">
              python manage.py shell -c "from pulse.tasks import check_prices; check_prices()"
            </pre>
          </Card>
        </div>

        {/* Live Simulation Output Console */}
        <Card className="flex flex-col h-[420px] bg-slate-950/90 border-slate-800 p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Terminal className="w-4 h-4 text-amber-400" />
              Simulation Event Console
            </span>
            <button
              onClick={() => setSimLog([])}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear Log
            </button>
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1.5 pt-3">
            {simLog.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 italic">
                Ready for simulation. Scan a route price and evaluate.
              </div>
            ) : (
              simLog.map((line, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    line.includes('✓')
                      ? 'text-emerald-400'
                      : line.includes('✗')
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }`}
                >
                  {line}
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
