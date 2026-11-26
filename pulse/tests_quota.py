from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from pulse.models import ApiQuota, QuotaAlertLog
from pulse.services.quota_tracker import (
    ALERT_THRESHOLDS,
    get_or_create_monthly_quota,
    record_api_call,
    get_quota_telemetry,
    simulate_quota_consumption,
    reset_quota_counter,
)
from pulse.services.flight_provider import (
    MockFlightProvider,
    AmadeusFlightProvider,
    get_flight_provider,
)


class QuotaTrackerTests(TestCase):
    def setUp(self):
        reset_quota_counter()

    def test_quota_record_increments_and_calculates_pct(self):
        res = record_api_call(route="DEL-BOM", provider="amadeus", status_code=200)
        self.assertEqual(res["used_calls"], 1)
        self.assertEqual(res["monthly_limit"], 2000)
        self.assertAlmostEqual(res["percentage"], 0.05, places=2)

    def test_milestone_alert_triggers_at_25_and_50_percent(self):
        # 25% of 2000 = 500 calls
        sim_res = simulate_quota_consumption(target_percentage=25, route="DEL-BOM")
        self.assertEqual(sim_res["status"], "success")
        self.assertEqual(sim_res["used_calls"], 500)
        self.assertEqual(len(sim_res["newly_triggered"]), 1)
        self.assertEqual(sim_res["newly_triggered"][0]["milestone"], 25)

        # Verify DB audit log
        log = QuotaAlertLog.objects.filter(milestone=25).first()
        self.assertIsNotNone(log)
        self.assertIn("25% milestone reached", log.message)

        # Advance to 50%
        sim_50 = simulate_quota_consumption(target_percentage=50, route="BLR-HYD")
        self.assertEqual(sim_50["used_calls"], 1000)
        self.assertEqual(len(sim_50["newly_triggered"]), 1)
        self.assertEqual(sim_50["newly_triggered"][0]["milestone"], 50)

        # Subsequent call does not duplicate 50% alert
        call_res = record_api_call(route="DEL-BLR")
        self.assertEqual(len(call_res["newly_triggered_alerts"]), 0)

    def test_all_milestones_covered(self):
        self.assertEqual(ALERT_THRESHOLDS, [25, 50, 60, 70, 80, 90])

    def test_reset_quota(self):
        simulate_quota_consumption(target_percentage=60)
        quota = get_or_create_monthly_quota()
        self.assertGreater(quota.used_calls, 0)

        reset_res = reset_quota_counter()
        self.assertEqual(reset_res["used_calls"], 0)
        refreshed = get_or_create_monthly_quota()
        self.assertEqual(refreshed.used_calls, 0)
        self.assertEqual(refreshed.alerted_milestones, [])


class FlightProviderApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        reset_quota_counter()

    def test_flight_price_endpoint_returns_rich_payload(self):
        url = reverse("flight-price") + "?route=DEL-BOM"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data["route"], "DEL-BOM")
        self.assertIn("price", data)
        self.assertGreater(data["price"], 0)
        self.assertIn("provider", data)
        self.assertIn("airline", data)
        self.assertIn("flight_number", data)
        self.assertIn("quota", data)
        self.assertEqual(data["quota"]["used_calls"], 1)

    def test_flight_price_invalid_route_format(self):
        url = reverse("flight-price") + "?route=DELBOM"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_quota_telemetry_endpoint(self):
        url = reverse("admin-quota")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("used_calls", data)
        self.assertIn("monthly_limit", data)
        self.assertIn("consumed_percentage", data)
        self.assertIn("alert_thresholds", data)
        self.assertIn("recent_alerts", data)

    def test_admin_quota_simulate_endpoint(self):
        url = reverse("admin-quota-simulate")
        response = self.client.post(url, {"target_percentage": 50, "route": "BOM-GOA"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["percentage"], 50.0)
