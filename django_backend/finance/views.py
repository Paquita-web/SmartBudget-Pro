from django.shortcuts import render
from rest_framework import viewsets, permissions
from django.db.models import Q
from .models import Transaction, Budget, Goal, Bill, Profile
from .serializers import TransactionSerializer, BudgetSerializer, GoalSerializer, BillSerializer, ProfileSerializer

# Template Views
def dashboard_view(request):
    # Here we would fetch real data from models
    # transactions = Transaction.objects.order_by('-date')[:5]
    return render(request, 'dashboard.html')

def transactions_view(request):
    return render(request, 'transactions.html')

# API ViewSets
class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Profile.objects.filter(models.Q(owner=self.request.user) | models.Q(members=self.request.user))

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile_id = self.request.query_params.get('profile_id')
        if profile_id:
            return Transaction.objects.filter(profile_id=profile_id)
        return Transaction.objects.none()
