from abc import ABC, abstractmethod
from typing import Dict, Any
from notifications.schemas import ProviderSendResult


class BaseNotificationProvider(ABC):
    """
    Abstract interface for notification delivery channels (SMS, Push, In-App, Mock).
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the provider, matching notifications.provider column."""
        pass

    @abstractmethod
    def send(self, payload: Dict[str, Any]) -> ProviderSendResult:
        """
        Deliver a notification to a recipient.

        Payload contains:
            - id: str (notification record UUID)
            - farmer_id: str
            - notice_id: str
            - reminder_slot: int (30, 14, 7)
            - channel: str ('in_app', 'sms', 'push')
            - title: str
            - body: str
            - language: str
            - phone: Optional[str]

        Returns:
            ProviderSendResult(ok=True/False, provider_message_id=str, error=str)
        """
        pass
