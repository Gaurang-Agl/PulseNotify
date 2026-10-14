import random
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.generics import ListCreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import NotificationLog, PriceAlert, UserProfile
from .permissions import IsAdminUser
from .serializers import PriceAlertSerializer, RegisterSerializer, NotificationLogSerializer

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logs = NotificationLog.objects.filter(
            alert__user=request.user
        ).order_by('-notified_at')
        serializer = NotificationLogSerializer(logs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        if username and User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = serializer.save()

        profile, _ = UserProfile.objects.get_or_create(user=user)

        access_token = RefreshToken.for_user(user).access_token

        return Response(
            {
                "username": user.username,
                "access": str(access_token),
                "role": profile.role,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")

        user = None

        if isinstance(username, str) and isinstance(password, str):
            user = authenticate(
                request=request,
                username=username,
                password=password,
            )

        if user is None:
            return Response(
                {"error": "Invalid credentials"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        profile, _ = UserProfile.objects.get_or_create(user=user)

        access_token = RefreshToken.for_user(user).access_token

        return Response(
            {
                "username": user.username,
                "access": str(access_token),
                "role": profile.role,
            },
            status=status.HTTP_200_OK,
        )


class PriceAlertListCreateView(ListCreateAPIView):
    serializer_class = PriceAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        status_filter = self.request.query_params.get('status')
        queryset = PriceAlert.objects.filter(user=self.request.user)
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)
        return queryset.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PriceAlertDetailView(APIView):
    """
    DELETE /api/alerts/<id>/ - Deactivates alert (sets status to INACTIVE).
    Returns 404 if not found or belongs to another user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        alert = get_object_or_404(PriceAlert, id=id)
        if alert.user != request.user:
            return Response(
                {"error": "Alert not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PriceAlertSerializer(alert)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id):
        alert = get_object_or_404(PriceAlert, id=id)
        if alert.user != request.user:
            return Response(
                {"error": "Alert not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        alert.status = PriceAlert.Status.INACTIVE
        alert.save()
        return Response({"status": "inactive"}, status=status.HTTP_200_OK)


MOCK_PRICES = {
    "DEL-BOM": (3000, 7000),
    "BLR-HYD": (1500, 4000),
    "DEL-BLR": (4000, 9000),
    "BOM-GOA": (2000, 5000),
}


class FlightPriceView(APIView):
    """
    GET /api/flights/price/?route=DEL-BOM
    Internal mock flight price feed.
    """
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        route = request.GET.get("route", "").strip()
        price_range = MOCK_PRICES.get(route)
        if not price_range:
            return Response(
                {"error": "Route not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        price = random.randint(*price_range)
        return Response(
            {"route": route, "price": price},
            status=status.HTTP_200_OK,
        )


class AdminSummaryView(APIView):
    """
    GET /api/admin/summary/
    Returns platform-wide statistics. Only accessible to users with role = ADMIN.
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        alerts_agg = PriceAlert.objects.aggregate(
            total_alerts=Count("id"),
            active_alerts=Count("id", filter=Q(status=PriceAlert.Status.ACTIVE)),
            triggered_alerts=Count("id", filter=Q(status=PriceAlert.Status.TRIGGERED)),
        )
        total_alerts = alerts_agg["total_alerts"] or 0
        active_alerts = alerts_agg["active_alerts"] or 0
        triggered_alerts = alerts_agg["triggered_alerts"] or 0

        notif_agg = NotificationLog.objects.aggregate(total=Count("id"))
        total_notifications = notif_agg["total"] or 0

        routes_agg = (
            PriceAlert.objects.values("origin", "destination")
            .annotate(alert_count=Count("id"))
            .order_by("-alert_count")
        )
        top_routes = [
            {
                "route": f"{item['origin']}-{item['destination']}",
                "alert_count": item["alert_count"],
            }
            for item in routes_agg
        ]

        return Response(
            {
                "total_alerts": total_alerts,
                "active_alerts": active_alerts,
                "triggered_alerts": triggered_alerts,
                "total_notifications": total_notifications,
                "top_routes": top_routes,
            },
            status=status.HTTP_200_OK,
        )