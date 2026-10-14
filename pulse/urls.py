from django.urls import path

from .views import (
    AdminSummaryView,
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

    # Mock flight price feed
    path("flights/price/", FlightPriceView.as_view(), name="flight-price"),

    # Admin analytics
    path("admin/summary/", AdminSummaryView.as_view(), name="admin-summary"),

    # Notification endpoints
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
]
