from rest_framework.permissions import BasePermission
from .models import UserProfile

class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and (
                request.user.is_staff or
                request.user.is_superuser or (
                    hasattr(request.user, "profile") and
                    request.user.profile.role == UserProfile.Role.ADMIN
                )
            )
        )