from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TransactionViewSet, ProfileViewSet, ActivityLogViewSet, AssetViewSet,
    dashboard_view, transactions_view, assets_view
)

router = DefaultRouter()
router.register(r'profiles', ProfileViewSet)
router.register(r'transactions', TransactionViewSet)
router.register(r'assets', AssetViewSet)
router.register(r'history', ActivityLogViewSet)

urlpatterns = [
    path('', dashboard_view, name='home'),
    path('transactions/', transactions_view, name='transactions_page'),
    path('assets/', assets_view, name='assets_page'),
    path('api/', include(router.urls)),
]
