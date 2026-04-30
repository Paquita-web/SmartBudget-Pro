import os
import google.generativeai as genai
from django.shortcuts import render, redirect
from rest_framework import viewsets, permissions
from django.db.models import Q
from django.contrib.auth.decorators import login_required
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
    recent_logs = []
    total_assets = 0
    if request.user.is_authenticated:
        user_profiles = Profile.objects.filter(Q(owner=request.user) | Q(members=request.user))
        recent_logs = ActivityLog.objects.filter(profile__in=user_profiles).order_by('-created_at')[:10]
        
        assets = Asset.objects.filter(profile__in=user_profiles)
        for asset in assets:
            total_assets += asset.value
    else:
        # For demo purposes if not logged in
        total_assets = 57450
    
    context = {
        'recent_logs': recent_logs,
        'total_assets': total_assets,
    }
    return render(request, 'dashboard.html', context)

def transactions_view(request):
    if request.method == 'POST' and request.user.is_authenticated:
        # Simple form handling
        desc = request.POST.get('description')
        amount = request.POST.get('amount')
        t_type = request.POST.get('type')
        category = request.POST.get('category')
        
        # Get or create a default profile for the user
        profile, _ = Profile.objects.get_or_create(owner=request.user, name="Principal")
        
        tx = Transaction.objects.create(
            description=desc,
            amount=amount,
            type=t_type,
            category=category,
            profile=profile,
            paid_by=request.user
        )
        log_activity(profile, request.user, "Transacción Registrada", f"{tx.get_type_display()}: {tx.description} por {tx.amount}€")
        return redirect('transactions_page')

    return render(request, 'transactions.html')

def assets_view(request):
    assets_list = []
    total_worth = 0
    
    if request.user.is_authenticated:
        user_profiles = Profile.objects.filter(Q(owner=request.user) | Q(members=request.user))
        
        if request.method == 'POST':
            name = request.POST.get('name')
            value = request.POST.get('value')
            a_type = request.POST.get('type')
            
            profile, _ = Profile.objects.get_or_create(owner=request.user, name="Principal")
            
            asset = Asset.objects.create(
                name=name,
                value=value,
                type=a_type,
                profile=profile
            )
            log_activity(profile, request.user, "Activo Añadido", f"Se añadió {asset.name} por {asset.value}€")
            return redirect('assets_page')

        assets_list = Asset.objects.filter(profile__in=user_profiles).order_by('-value')
        for a in assets_list:
            total_worth += a.value
    else:
        # Mock values for demo
        total_worth = 45000

    return render(request, 'assets.html', {'assets': assets_list, 'total_worth': total_worth})

def ai_advisor_view(request):
    advice = "Configura tu GEMINI_API_KEY para recibir consejos personalizados."
    if request.user.is_authenticated:
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                
                # Resumen de datos para la IA
                user_profiles = Profile.objects.filter(Q(owner=request.user) | Q(members=request.user))
                assets = Asset.objects.filter(profile__in=user_profiles)
                txs = Transaction.objects.filter(profile__in=user_profiles).order_by('-date')[:5]
                
                context_str = f"Tengo un patrimonio de {sum(a.value for a in assets)}€ repartido en {assets.count()} activos. Mis últimas transacciones son: "
                for t in txs:
                    context_str += f"{t.description} ({t.amount}€), "
                
                prompt = f"{context_str}. Actúa como un asesor financiero experto y dame un consejo breve y accionable en español de máximo 3 frases."
                response = model.generate_content(prompt)
                advice = response.text
            except Exception as e:
                advice = f"Error al conectar con la IA: {str(e)}"
    
    return render(request, 'ai_advisor.html', {'advice': advice})

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
