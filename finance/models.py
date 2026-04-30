from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    PROFILE_TYPES = [
        ('personal', 'Personal'),
        ('shared', 'Compartido'),
    ]
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=PROFILE_TYPES, default='personal')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_profiles')
    members = models.ManyToManyField(User, related_name='shared_profiles', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Transaction(models.Model):
    TX_TYPES = [
        ('income', 'Ingreso'),
        ('expense', 'Gasto'),
    ]
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    type = models.CharField(max_length=10, choices=TX_TYPES)
    category = models.CharField(max_length=100)
    date = models.DateTimeField(auto_now_add=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='transactions')
    paid_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    is_split = models.BooleanField(default=False)

class Budget(models.Model):
    category = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='budgets')

class Goal(models.Model):
    name = models.CharField(max_length=100)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='goals')

class Bill(models.Model):
    name = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=100)
    due_date = models.IntegerField() # Day of month
    is_paid = models.BooleanField(default=False)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='bills')

class Asset(models.Model):
    ASSET_TYPES = [
        ('property', 'Propiedad/Inmueble'),
        ('investment', 'Inversión (Acciones/Cripto)'),
        ('passive_income', 'Ingreso Pasivo (Negocio/Royalty)'),
        ('cash', 'Efectivo/Ahorros'),
        ('other', 'Otros'),
    ]
    name = models.CharField(max_length=100)
    value = models.DecimalField(max_digits=15, decimal_places=2)
    type = models.CharField(max_length=20, choices=ASSET_TYPES)
    description = models.TextField(blank=True)
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='assets')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_type_display()}) - {self.value}€"

class ActivityLog(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='activity_logs')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField(max_length=255)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} - {self.action} - {self.created_at}"
