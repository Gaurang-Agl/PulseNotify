# Create your models here.


from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        USER = "user", "User"

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.CharField(
        max_length=10,
        choices=Role.choices,
        default=Role.USER,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class PriceAlert(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"
        TRIGGERED = "triggered", "Triggered"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="alerts",
    )
    origin = models.CharField(max_length=10)
    destination = models.CharField(max_length=10)
    threshold_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"{self.origin}-{self.destination} "
            f"@ ₹{self.threshold_price}"
        )


class NotificationLog(models.Model):
    alert = models.ForeignKey(
        PriceAlert,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    triggered_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )
    message = models.TextField()
    notified_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return (
            f"Notification for {self.alert.origin}-"
            f"{self.alert.destination} at ₹{self.triggered_price}"
        )


class ApiQuota(models.Model):
    """
    Tracks monthly third-party API consumption (Amadeus / Kiwi / Skyscanner).
    Maintains milestone alerts at 25%, 50%, 60%, 70%, 80%, and 90%.
    """
    month_key = models.CharField(max_length=7, unique=True, default="")  # e.g. "2026-11"
    monthly_limit = models.PositiveIntegerField(default=2000)
    used_calls = models.PositiveIntegerField(default=0)
    alerted_milestones = models.JSONField(default=list, blank=True)
    last_route = models.CharField(max_length=20, blank=True, default="")
    last_provider = models.CharField(max_length=50, blank=True, default="")
    last_status_code = models.IntegerField(default=200)
    last_request_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ApiQuota({self.month_key}: {self.used_calls}/{self.monthly_limit})"


class QuotaAlertLog(models.Model):
    """
    Audit log of triggered quota milestone alerts.
    """
    milestone = models.IntegerField()  # 25, 50, 60, 70, 80, 90
    consumed_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    used_calls = models.PositiveIntegerField()
    monthly_limit = models.PositiveIntegerField()
    triggering_route = models.CharField(max_length=20, default="")
    triggering_provider = models.CharField(max_length=50, default="")
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Milestone Alert {self.milestone}% ({self.used_calls}/{self.monthly_limit})"

