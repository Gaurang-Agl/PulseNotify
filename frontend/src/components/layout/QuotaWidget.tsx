import React, { useEffect, useState } from 'react';
import { getQuotaTelemetryApi, resetQuotaApi } from '../../api/quota';
import { QuotaTelemetry } from '../../types';
import { useToast } from '../../context/ToastContext';

interface QuotaWidgetProps {
  onThresholdAlert?: (milestone: number, message: string) => void;
}

export const QuotaWidget: React.FC<QuotaWidgetProps> = () => {
  const [telemetry, setTelemetry] = useState<QuotaTelemetry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  const fetchQuota = async () => {
    try {
      const data = await getQuotaTelemetryApi();
      setTelemetry(data);
    } catch {
      // Non-fatal if server not ready
    }
  };

  useEffect(() => {
    fetchQuota();
    const interval = setInterval(fetchQuota, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    setLoading(true);
    try {
      await resetQuotaApi();
      success('API quota counter reset successfully');
      await fetchQuota();
      setIsOpen(false);
    } catch {
      error('Failed to reset quota counter');
    } finally {
      setLoading(false);
    }
  };


  if (!telemetry) return null;

  const pct = telemetry.consumed_percentage;
  let statusColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  let dotColor = 'bg-emerald-400';
  if (pct >= 90) {
    statusColor = 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse';
    dotColor = 'bg-rose-500';
  } else if (pct >= 70) {
    statusColor = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
    dotColor = 'bg-orange-400';
  } else if (pct >= 50) {
    statusColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    dotColor = 'bg-amber-400';
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors hover:brightness-110 ${statusColor}`}
        title="Third-party Flight API Quota Telemetry"
      >
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span>Quota: {pct.toFixed(1)}%</span>
        <span className="hidden sm:inline text-slate-400">({telemetry.used_calls}/{telemetry.monthly_limit})</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl p-4 z-50 text-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
              <h4 className="text-sm font-semibold text-white">API Quota Telemetry</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Monthly Consumption ({telemetry.month_key})</span>
                <span className="font-mono text-white">{pct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-orange-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 bg-slate-800/60 p-2.5 rounded-lg border border-slate-800">
              <div>
                <p className="text-slate-400 text-[11px]">Calls Used</p>
                <p className="text-sm font-mono font-semibold text-white">{telemetry.used_calls}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Remaining</p>
                <p className="text-sm font-mono font-semibold text-emerald-400">{telemetry.remaining_calls}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Monthly Cap</p>
                <p className="text-sm font-mono font-semibold text-white">{telemetry.monthly_limit}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Milestones Alerted</p>
                <p className="text-xs font-mono text-amber-400">
                  {telemetry.alerted_milestones.length > 0
                    ? telemetry.alerted_milestones.map((m) => `${m}%`).join(', ')
                    : 'None yet'}
                </p>
              </div>
            </div>

            {/* Last request */}
            {telemetry.last_request.route && (
              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-800/80">
                <div className="flex justify-between font-mono">
                  <span>Last: <strong className="text-cyan-400">{telemetry.last_request.route}</strong></span>
                  <span className="text-slate-300">({telemetry.last_request.provider})</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center border-t border-slate-800">
              <button
                onClick={fetchQuota}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                ↻ Refresh
              </button>
              <button
                onClick={handleReset}
                disabled={loading}
                className="px-2.5 py-1 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded transition-colors"
              >
                {loading ? 'Resetting...' : 'Reset Quota'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
