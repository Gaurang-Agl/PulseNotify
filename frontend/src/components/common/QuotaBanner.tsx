import React, { useEffect, useState } from 'react';
import { getQuotaTelemetryApi } from '../../api/quota';
import { QuotaTelemetry } from '../../types';

export const QuotaBanner: React.FC = () => {
  const [telemetry, setTelemetry] = useState<QuotaTelemetry | null>(null);
  const [dismissedMilestone, setDismissedMilestone] = useState<number | null>(null);

  useEffect(() => {
    const checkQuota = async () => {
      try {
        const data = await getQuotaTelemetryApi();
        setTelemetry(data);
      } catch {
        // silent
      }
    };
    checkQuota();
    const timer = setInterval(checkQuota, 20000);
    return () => clearInterval(timer);
  }, []);

  if (!telemetry) return null;

  const pct = telemetry.consumed_percentage;
  // Highest milestone crossed
  const activeMilestones = telemetry.alerted_milestones;
  const currentMilestone = activeMilestones.length > 0 ? activeMilestones[activeMilestones.length - 1] : null;

  // Don't render banner if under 25% or user already acknowledged current highest milestone
  if (!currentMilestone || currentMilestone === dismissedMilestone) {
    return null;
  }

  const isSevere = currentMilestone >= 90;
  const isHigh = currentMilestone >= 70;

  const bgStyles = isSevere
    ? 'bg-rose-950/80 border-rose-500/60 text-rose-200'
    : isHigh
    ? 'bg-orange-950/80 border-orange-500/60 text-orange-200'
    : 'bg-amber-950/80 border-amber-500/60 text-amber-200';

  const badgeStyles = isSevere
    ? 'bg-rose-500 text-white'
    : isHigh
    ? 'bg-orange-500 text-white'
    : 'bg-amber-500 text-slate-950 font-bold';

  return (
    <div className={`w-full px-4 py-2.5 border-b backdrop-blur-md transition-all ${bgStyles}`}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
        <div className="flex items-center gap-2.5">
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold tracking-wider ${badgeStyles}`}>
            {currentMilestone}% QUOTA ALERT
          </span>
          <span>
            API Quota consumption reached <strong>{pct.toFixed(1)}%</strong> ({telemetry.used_calls}/{telemetry.monthly_limit} calls).
            {telemetry.last_request.route && (
              <span className="hidden sm:inline text-slate-300 ml-1.5 font-mono">
                [Trigger: {telemetry.last_request.route} via {telemetry.last_request.provider}]
              </span>
            )}
            <span className="ml-1.5 font-semibold text-white">
              Remaining: {telemetry.remaining_calls} calls.
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setDismissedMilestone(currentMilestone)}
            className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors border border-white/20"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
};
