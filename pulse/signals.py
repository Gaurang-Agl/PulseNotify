from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import UserProfile


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        role = UserProfile.Role.ADMIN if (instance.is_staff or instance.is_superuser) else UserProfile.Role.USER
        UserProfile.objects.get_or_create(user=instance, defaults={"role": role})
    elif instance.is_staff or instance.is_superuser:
        profile, _ = UserProfile.objects.get_or_create(user=instance)
        if profile.role != UserProfile.Role.ADMIN:
            profile.role = UserProfile.Role.ADMIN
            profile.save(update_fields=["role"])
