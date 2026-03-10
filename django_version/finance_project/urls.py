from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from finance_app.views import (
    ProfileViewSet, TransactionViewSet, BudgetViewSet, 
    GoalViewSet, InvestmentViewSet
)

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet, basename='profile')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'budgets', BudgetViewSet, basename='budget')
router.register(r'goals', GoalViewSet, basename='goal')
router.register(r'investments', InvestmentViewSet, basename='investment')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls')),
]
