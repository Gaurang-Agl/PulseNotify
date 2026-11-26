import logging
from celery import shared_task
from .models import PriceAlert, NotificationLog
from .services.flight_provider import get_flight_provider
from .services.quota_tracker import record_api_call

logger = logging.getLogger(__name__)


def evaluate_alerts_for_price(origin: str, destination: str, current_price: float):
    """
    Evaluates active alerts for a specific route against a given price.
    Immediately creates notification log and transitions status to TRIGGERED
    synchronously so DB state matches the response, then dispatches to Celery.
    Returns a list of triggered alert IDs.
    """
    active_alerts = PriceAlert.objects.filter(
        origin=origin,
        destination=destination,
        status=PriceAlert.Status.ACTIVE,
    )
    triggered_ids = []
    for alert in active_alerts:
        if current_price <= float(alert.threshold_price):
            # Synchronously execute notification creation and state flip
            send_notification(alert.id, current_price)
            try:
                send_notification.delay(alert.id, current_price)
            except Exception:
                pass
            triggered_ids.append(alert.id)
    return triggered_ids


@shared_task
def check_prices():
    active_alerts = PriceAlert.objects.filter(status=PriceAlert.Status.ACTIVE)
    routes = active_alerts.values_list('origin', 'destination').distinct()
    provider = get_flight_provider()

    for origin, destination in routes:
        route = f'{origin}-{destination}'

        try:
            flight_res = provider.get_route_price(origin, destination)
            current_price = flight_res.price

            # Record quota consumption and milestone telemetry
            record_api_call(
                route=flight_res.route,
                provider=flight_res.provider,
                status_code=flight_res.status_code,
            )
        except Exception as exc:
            logger.warning("Failed to fetch price for route %s: %s", route, exc)
            continue

        evaluate_alerts_for_price(origin, destination, current_price)


@shared_task
def send_notification(alert_id, triggered_price):
    try:
        alert = PriceAlert.objects.get(id=alert_id)
    except PriceAlert.DoesNotExist:
        logger.warning("PriceAlert with id %s does not exist", alert_id)
        return

    # Idempotency guard: only trigger if notification hasn't been logged yet
    if NotificationLog.objects.filter(alert=alert).exists():
        if alert.status != PriceAlert.Status.TRIGGERED:
            alert.status = PriceAlert.Status.TRIGGERED
            alert.save(update_fields=['status'])
        return

    message = (
        f'Price alert triggered! {alert.origin}-{alert.destination} '
        f'is now ₹{triggered_price} - below your threshold of '
        f'₹{alert.threshold_price}'
    )
    NotificationLog.objects.create(
        alert=alert,
        triggered_price=triggered_price,
        message=message,
    )
    # Mark alert as triggered so it doesn't fire again
    alert.status = PriceAlert.Status.TRIGGERED
    alert.save(update_fields=['status'])