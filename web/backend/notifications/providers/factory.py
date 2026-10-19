import os
from typing import Optional
from notifications.providers.base import BaseNotificationProvider
from notifications.providers.mock import MockNotificationProvider
from notifications.providers.in_app import InAppNotificationProvider


def get_notification_provider(override_name: Optional[str] = None) -> BaseNotificationProvider:
    """
    Factory to resolve active notification provider.
    Env NOTIFICATION_PROVIDER defaults to 'mock'.
    """
    provider_name = (override_name or os.getenv("NOTIFICATION_PROVIDER", "mock")).lower().strip()
    if provider_name == "in_app":
        return InAppNotificationProvider()
    return MockNotificationProvider()
