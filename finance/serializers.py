from rest_framework import serializers
from .models import Transaction, Budget, Goal, Bill, Profile
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email']

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'

class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = '__all__'

class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = '__all__'

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = '__all__'

class BillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = '__all__'

class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = '__all__'

class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.username')
    class Meta:
        model = ActivityLog
        fields = ['id', 'profile', 'user', 'user_name', 'action', 'details', 'created_at']
