import uuid
import logging
from typing import Dict, Any
from notifications.providers.base import BaseNotificationProvider
from notifications.schemas import ProviderSendResult

logger = logging.getLogger("notifications.providers.in_app")


class InAppNotificationProvider(BaseNotificationProvider):
    """
    In-app provider: the notification row in PostgreSQL is the delivery target itself.
    Farmers read notifications via the farmer notifications API.
    """

    @property
    def name(self) -> str:
        return "in_app"

    def send(self, payload: Dict[str, Any]) -> ProviderSendResult:
        msg_id = f"inapp-{uuid.uuid4().hex[:12]}"
        logger.info(
            f"[InAppProvider] Prepared in-app notification for {payload.get('farmer_id')}: "
            f"'{payload.get('title')}' -> {msg_id}"
        )
        return ProviderSendResult(
            ok=True,
            provider_message_id=msg_id,
        )
