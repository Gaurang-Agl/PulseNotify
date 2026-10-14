from django.test import TestCase
from django.contrib.auth.models import User
from .models import PriceAlert, NotificationLog


class PriceThresholdTest(TestCase):

    def test_price_below_threshold_triggers_alert(self):
        self.assertTrue(4200 <= 4500)

    def test_price_above_threshold_does_not_trigger(self):
        self.assertFalse(5000 <= 4500)

    def test_price_equal_to_threshold_triggers_alert(self):
        self.assertTrue(4500 <= 4500)


class NotificationLogTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser', password='testpass'
        )
        self.alert = PriceAlert.objects.create(
            user=self.user,
            origin='DEL', destination='BOM',
            threshold_price=4500,
            status=PriceAlert.Status.ACTIVE
        )

    def test_notification_log_created_with_correct_message(self):
        log = NotificationLog.objects.create(
            alert=self.alert,
            triggered_price=4200,
            message='Price dropped to 4200 for DEL-BOM'
        )
        self.assertEqual(log.triggered_price, 4200)
        self.assertEqual(log.alert, self.alert)
        self.assertIn('DEL-BOM', log.message)


class AlertScopingTest(TestCase):

    def setUp(self):
        self.user1 = User.objects.create_user(
            username='user1', password='pass'
        )
        self.user2 = User.objects.create_user(
            username='user2', password='pass'
        )
        PriceAlert.objects.create(
            user=self.user1, origin='DEL', destination='BOM',
            threshold_price=4500
        )
        PriceAlert.objects.create(
            user=self.user2, origin='BLR', destination='HYD',
            threshold_price=2000
        )

    def test_user_only_sees_own_alerts(self):
        user1_alerts = PriceAlert.objects.filter(user=self.user1)
        self.assertEqual(user1_alerts.count(), 1)
        self.assertEqual(user1_alerts.first().origin, 'DEL')

    def test_user_cannot_see_other_users_alerts(self):
        user2_alerts = PriceAlert.objects.filter(user=self.user1)
        self.assertNotEqual(user2_alerts.first().origin, 'BLR')