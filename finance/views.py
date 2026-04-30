from django.shortcuts import render
from rest_framework import viewsets, permissions
from django.db.models import Q
from .models import Transaction, Budget, Goal, Bill, Profile, ActivityLog, Asset
from .serializers import (
    TransactionSerializer, BudgetSerializer, GoalSerializer, 
    BillSerializer, ProfileSerializer, ActivityLogSerializer, AssetSerializer
)

def log_activity(profile, user, action, details=""):
    ActivityLog.objects.create(
        profile=profile,
        user=user,
        action=action,
        details=details
    )

# Template Views
def dashboard_view(request):
    # Fetching some context for the template
    recent_logs = []
    total_assets = 0
    if request.user.is_authenticated:
        # Get profiles where user is owner or member
        user_profiles = Profile.objects.filter(Q(owner=request.user) | Q(members=request.user))
        recent_logs = ActivityLog.objects.filter(profile__in=user_profiles).order_by('-created_at')[:10]
        
        # Calculate total assets value
        assets = Asset.objects.filter(profile__in=user_profiles)
        for asset in assets:
            total_assets += asset.value
    
    context = {
        'recent_logs': recent_logs,
        'total_assets': total_assets,
    }
    return render(request, 'dashboard.html', context)

def transactions_view(request):
    return render(request, 'transactions.html')

def assets_view(request):
    assets_list = []
    total_worth = 0
    if request.user.is_authenticated:
        user_profiles = Profile.objects.filter(Q(owner=request.user) | Q(members=request.user))
        assets_list = Asset.objects.filter(profile__in=user_profiles).order_by('-value')
        for a in assets_list:
            total_worth += a.value
            
    return render(request, 'assets.html', {'assets': assets_list, 'total_worth': total_worth})

# API ViewSets
class AssetViewSet(viewsets.ModelViewSet):
    queryset = Asset.objects.all()
    serializer_class = AssetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Asset.objects.filter(Q(profile__owner=self.request.user) | Q(profile__members=self.request.user))

    def perform_create(self, serializer):
        asset = serializer.save()
        log_activity(asset.profile, self.request.user, "Activo Añadido", f"Se añadió {asset.name} por {asset.value}€")

class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile_id = self.request.query_params.get('profile_id')
        if profile_id:
            return ActivityLog.objects.filter(profile_id=profile_id)
        return ActivityLog.objects.filter(Q(profile__owner=self.request.user) | Q(profile__members=self.request.user))

class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Profile.objects.filter(models.Q(owner=self.request.user) | models.Q(members=self.request.user))

    def perform_create(self, serializer):
        profile = serializer.save(owner=self.request.user)
        log_activity(profile, self.request.user, "Perfil Creado", f"Se creó el perfil {profile.name}")

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        profile_id = self.request.query_params.get('profile_id')
        if profile_id:
            return Transaction.objects.filter(profile_id=profile_id)
        return Transaction.objects.filter(Q(profile__owner=self.request.user) | Q(profile__members=self.request.user))

    def perform_create(self, serializer):
        transaction = serializer.save(paid_by=self.request.user)
        log_activity(
            transaction.profile, 
            self.request.user, 
            "Transacción Registrada", 
            f"{transaction.get_type_display()}: {transaction.description} por {transaction.amount}€"
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        log_activity(
            instance.profile,
            self.request.user,
            "Transacción Actualizada",
            f"Cambios en: {instance.description}"
        )

    def perform_destroy(self, instance):
        profile = instance.profile
        desc = instance.description
        instance.delete()
        log_activity(profile, self.request.user, "Transacción Eliminada", f"Se eliminó: {desc}")
