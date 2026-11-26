"""
API Quota Tracking & Milestone Alert Engine.
Tracks third-party API consumption against monthly allowances.
Emits alert milestones at 25%, 50%, 60%, 70%, 80%, and 90%.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from django.conf import settings
from pulse.models import ApiQuota, QuotaAlertLog

logger = logging.getLogger(__name__)

# Milestone percentages where the system alerts Gaurang
ALERT_THRESHOLDS = [25, 50, 60, 70, 80, 90]


def get_current_month_key() -> str:
    """Returns 'YYYY-MM' for the current UTC month."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m")


def get_or_create_monthly_quota() -> ApiQuota:
    """Fetches or initializes the active month's quota tracker."""
    month_key = get_current_month_key()
    default_limit = getattr(settings, "EXTERNAL_API_MONTHLY_QUOTA", 2000)

    quota, _ = ApiQuota.objects.get_or_create(
        month_key=month_key,
        defaults={
            "monthly_limit": default_limit,
            "used_calls": 0,
            "alerted_milestones": [],
        },
    )
    return quota


def record_api_call(
    route: str = "",
    provider: str = "amadeus",
    status_code: int = 200,
) -> Dict[str, Any]:
    """
    Records an external API call, increments counter, evaluates milestone thresholds
    (25%, 50%, 60%, 70%, 80%, 90%), and creates QuotaAlertLog when crossed.
    """
    quota = get_or_create_monthly_quota()
    quota.used_calls += 1
    quota.last_route = route
    quota.last_provider = provider
    quota.last_status_code = status_code
    quota.last_request_at = datetime.now(timezone.utc)

    # Calculate percentage
    limit = max(quota.monthly_limit, 1)
    consumed_pct = (quota.used_calls / limit) * 100.0

    alerted = list(quota.alerted_milestones or [])
    newly_triggered: List[Dict[str, Any]] = []

    for threshold in ALERT_THRESHOLDS:
        if consumed_pct >= threshold and threshold not in alerted:
            alerted.append(threshold)
            remaining = max(0, quota.monthly_limit - quota.used_calls)
            msg = (
                f"API Quota Alert: {threshold}% consumed ({quota.used_calls}/{quota.monthly_limit} calls). "
                f"Triggered by route '{route}' via provider '{provider}' (HTTP {status_code}). "
                f"Remaining calls this month: {remaining}."
            )

            # Record audit log
            alert_log = QuotaAlertLog.objects.create(
                milestone=threshold,
                consumed_percentage=round(consumed_pct, 2),
                used_calls=quota.used_calls,
                monthly_limit=quota.monthly_limit,
                triggering_route=route,
                triggering_provider=provider,
                message=msg,
            )

            newly_triggered.append({
                "milestone": threshold,
                "percentage": round(consumed_pct, 1),
                "used_calls": quota.used_calls,
                "remaining": remaining,
                "message": msg,
                "route": route,
                "provider": provider,
                "alert_id": alert_log.id,
            })
            logger.warning("QUOTA MILESTONE TRIGGERED: %s", msg)

    quota.alerted_milestones = sorted(alerted)
    quota.save()

    return {
        "used_calls": quota.used_calls,
        "monthly_limit": quota.monthly_limit,
        "remaining_calls": max(0, quota.monthly_limit - quota.used_calls),
        "percentage": round(consumed_pct, 2),
        "newly_triggered_alerts": newly_triggered,
    }


def get_quota_telemetry() -> Dict[str, Any]:
    """Retrieves full telemetry, milestone status, and recent audit logs."""
    quota = get_or_create_monthly_quota()
    limit = max(quota.monthly_limit, 1)
    consumed_pct = (quota.used_calls / limit) * 100.0

    recent_logs = list(
        QuotaAlertLog.objects.all()[:15].values(
            "id",
            "milestone",
            "consumed_percentage",
            "used_calls",
            "monthly_limit",
            "triggering_route",
            "triggering_provider",
            "message",
            "created_at",
        )
    )

    return {
        "month_key": quota.month_key,
        "monthly_limit": quota.monthly_limit,
        "used_calls": quota.used_calls,
        "remaining_calls": max(0, quota.monthly_limit - quota.used_calls),
        "consumed_percentage": round(consumed_pct, 2),
        "alert_thresholds": ALERT_THRESHOLDS,
        "alerted_milestones": quota.alerted_milestones,
        "last_request": {
            "route": quota.last_route,
            "provider": quota.last_provider,
            "status_code": quota.last_status_code,
            "timestamp": quota.last_request_at.isoformat() if quota.last_request_at else None,
        },
        "recent_alerts": recent_logs,
    }


def simulate_quota_consumption(
    target_percentage: Optional[int] = None,
    call_count: Optional[int] = None,
    route: str = "DEL-BOM",
    provider: str = "amadeus",
) -> Dict[str, Any]:
    """
    Simulator helper to advance quota directly to specific milestone percentages
    (e.g., 25, 50, 60, 70, 80, 90) or add N calls to test milestone alerts.
    """
    quota = get_or_create_monthly_quota()
    limit = max(quota.monthly_limit, 1)

    if target_percentage is not None:
        target_calls = int(round((target_percentage / 100.0) * limit))
        calls_to_add = max(0, target_calls - quota.used_calls)
    elif call_count is not None:
        calls_to_add = max(0, call_count)
    else:
        calls_to_add = 100

    results = []
    # If adding multiple calls, we simulate step to cross thresholds cleanly
    if calls_to_add > 0:
        quota.used_calls += calls_to_add
        quota.last_route = route
        quota.last_provider = provider
        quota.last_status_code = 200
        quota.last_request_at = datetime.now(timezone.utc)

        consumed_pct = (quota.used_calls / limit) * 100.0
        alerted = list(quota.alerted_milestones or [])

        for threshold in ALERT_THRESHOLDS:
            if consumed_pct >= threshold and threshold not in alerted:
                alerted.append(threshold)
                remaining = max(0, quota.monthly_limit - quota.used_calls)
                msg = (
                    f"SIMULATED Quota Alert: {threshold}% milestone reached "
                    f"({quota.used_calls}/{quota.monthly_limit} calls). "
                    f"Last route: {route}. Remaining: {remaining}."
                )
                alert_log = QuotaAlertLog.objects.create(
                    milestone=threshold,
                    consumed_percentage=round(consumed_pct, 2),
                    used_calls=quota.used_calls,
                    monthly_limit=quota.monthly_limit,
                    triggering_route=route,
                    triggering_provider=provider,
                    message=msg,
                )
                results.append({
                    "milestone": threshold,
                    "percentage": round(consumed_pct, 1),
                    "used_calls": quota.used_calls,
                    "remaining": remaining,
                    "message": msg,
                    "alert_id": alert_log.id,
                })

        quota.alerted_milestones = sorted(alerted)
        quota.save()

    return {
        "status": "success",
        "used_calls": quota.used_calls,
        "monthly_limit": quota.monthly_limit,
        "percentage": round((quota.used_calls / limit) * 100.0, 2),
        "newly_triggered": results,
    }


def reset_quota_counter() -> Dict[str, Any]:
    """Resets the current month's quota counter for testing."""
    quota = get_or_create_monthly_quota()
    quota.used_calls = 0
    quota.alerted_milestones = []
    quota.save()
    return {"status": "reset", "used_calls": 0, "monthly_limit": quota.monthly_limit}
