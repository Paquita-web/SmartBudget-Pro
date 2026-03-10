from rest_framework import serializers
from .models import Profile, Transaction, Budget, Goal, Investment

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

class InvestmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investment
        fields = '__all__'

class ProfileSerializer(serializers.ModelSerializer):
    transactions = TransactionSerializer(many=True, read_only=True)
    budgets = BudgetSerializer(many=True, read_only=True)
    goals = GoalSerializer(many=True, read_only=True)
    investments = InvestmentSerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = '__all__'
