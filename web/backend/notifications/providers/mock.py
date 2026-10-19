import os
import uuid
import logging
from typing import Dict, Any
from notifications.providers.base import BaseNotificationProvider
from notifications.schemas import ProviderSendResult

logger = logging.getLogger("notifications.providers.mock")


class MockNotificationProvider(BaseNotificationProvider):
    """
    Mock delivery provider for testing and development.
    Records delivery in memory/logs, sends nothing externally.
    Allows simulating failures via NOTIFICATION_MOCK_FAIL=true.
    """

    @property
    def name(self) -> str:
        return "mock"

    def send(self, payload: Dict[str, Any]) -> ProviderSendResult:
        mock_fail = os.getenv("NOTIFICATION_MOCK_FAIL", "false").lower() == "true"
        if mock_fail:
            logger.warning(
                f"[MockProvider] Simulated failure for farmer {payload.get('farmer_id')} "
                f"notice {payload.get('notice_id')} slot {payload.get('reminder_slot')}"
            )
            return ProviderSendResult(
                ok=False,
                error="Simulated provider failure (NOTIFICATION_MOCK_FAIL is true)",
            )

        msg_id = f"mock-msg-{uuid.uuid4().hex[:12]}"
        logger.info(
            f"[MockProvider] Simulated sending to {payload.get('farmer_id')} (phone={payload.get('phone')}): "
            f"'{payload.get('title')}' -> {msg_id}"
        )
        return ProviderSendResult(
            ok=True,
            provider_message_id=msg_id,
        )
