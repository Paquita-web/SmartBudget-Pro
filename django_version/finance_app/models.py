from django.db import models
from django.contrib.auth.models import User

class Profile(models.Model):
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_profiles')
    members = models.ManyToManyField(User, related_name='profiles')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Transaction(models.Model):
    TRANSACTION_TYPES = (
        ('income', 'Ingreso'),
        ('expense', 'Gasto'),
    )
    profile = models.ForeignKey(Profile, on_snapshot=models.CASCADE, related_name='transactions')
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    date = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

class Budget(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='budgets')
    category = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    month = models.CharField(max_length=7) # YYYY-MM

class Goal(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='goals')
    name = models.CharField(max_length=100)
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deadline = models.DateTimeField()

class Investment(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='investments')
    symbol = models.CharField(max_length=10)
    name = models.CharField(max_length=100)
    shares = models.DecimalField(max_digits=12, decimal_places=4)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2)
    current_price = models.DecimalField(max_digits=12, decimal_places=2)
