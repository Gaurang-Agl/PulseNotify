from django.urls import path

from .views import (
    AdminSummaryView,
    ApiQuotaSimulateView,
    ApiQuotaView,
    FlightPriceView,
    LoginView,
    PriceAlertDetailView,
    PriceAlertListCreateView,
    RegisterView,
    NotificationListView,
)

urlpatterns = [
    # Auth endpoints
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),

    # Price alert endpoints
    path("alerts/", PriceAlertListCreateView.as_view(), name="alert-list-create"),
    path("alerts/<int:id>/", PriceAlertDetailView.as_view(), name="alert-detail"),

    # Real-time / Mock flight price feed
    path("flights/price/", FlightPriceView.as_view(), name="flight-price"),

    # Admin analytics & Quota telemetry
    path("admin/summary/", AdminSummaryView.as_view(), name="admin-summary"),
    path("admin/quota/", ApiQuotaView.as_view(), name="admin-quota"),
    path("admin/quota/simulate/", ApiQuotaSimulateView.as_view(), name="admin-quota-simulate"),

    # Notification endpoints
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
]

