from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TransactionViewSet, BudgetViewSet, GoalViewSet, BillViewSet, ProfileViewSet

# Using placeholder check if they were defined in views.py (added them just in case)
router = DefaultRouter()
router.register(r'profiles', ProfileViewSet)
router.register(r'transactions', TransactionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
