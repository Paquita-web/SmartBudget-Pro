from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TransactionViewSet, ProfileViewSet, 
    dashboard_view, transactions_view
)

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet)
router.register(r'transactions', TransactionViewSet)

urlpatterns = [
    path('', dashboard_view, name='home'),
    path('transactions/', transactions_view, name='transactions_page'),
    path('api/', include(router.urls)),
]
