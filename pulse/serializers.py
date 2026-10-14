from rest_framework import serializers
from django.contrib.auth.models import User
from .models import UserProfile, PriceAlert, NotificationLog

class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ('username', 'password', 'email')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', '')
        )
        return user

RegisterSerializer = UserRegisterSerializer

class PriceAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceAlert
        fields = ('id', 'origin', 'destination', 'threshold_price', 'status', 'created_at')
        read_only_fields = ('id', 'status', 'created_at')

    def validate_origin(self, value):
        val = value.strip().upper()
        if len(val) != 3 or not val.isalpha():
            raise serializers.ValidationError("Origin must be a 3-letter IATA code (e.g. DEL).")
        return val

    def validate_destination(self, value):
        val = value.strip().upper()
        if len(val) != 3 or not val.isalpha():
            raise serializers.ValidationError("Destination must be a 3-letter IATA code (e.g. BOM).")
        return val

    def validate_threshold_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Threshold price must be greater than zero.")
        return value

    def validate(self, attrs):
        origin = attrs.get('origin', getattr(self.instance, 'origin', None))
        destination = attrs.get('destination', getattr(self.instance, 'destination', None))
        if origin and destination and origin == destination:
            raise serializers.ValidationError("Origin and destination cannot be identical.")
        return attrs


class NotificationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationLog
        fields = ('id', 'alert', 'triggered_price', 'message', 'notified_at')
        read_only_fields = ('id', 'notified_at')