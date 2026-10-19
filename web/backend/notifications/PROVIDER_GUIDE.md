# Notification Provider Guide

This document describes how to implement and plug in new notification delivery providers (e.g., real SMS via Twilio / Dialog / Mobitel or Push Notifications via Firebase Cloud Messaging).

---

## 1. Provider Interface

All notification providers extend `BaseNotificationProvider` from `notifications.providers.base`:

```python
from abc import ABC, abstractmethod
from typing import Dict, Any
from notifications.schemas import ProviderSendResult

class BaseNotificationProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the provider, stored in notifications.provider column."""
        pass

    @abstractmethod
    def send(self, payload: Dict[str, Any]) -> ProviderSendResult:
        """Deliver the notification."""
        pass
```

### The Payload Dictionary
The `send(payload)` method receives:
- `id`: str (UUID of the notification row)
- `farmer_id`: str (UUID of the farmer)
- `notice_id`: str (UUID of the planting notice)
- `reminder_slot`: int (30, 14, or 7)
- `channel`: str (`"in_app"`, `"sms"`, `"push"`)
- `title`: str (Localized title)
- `body`: str (Localized message body)
- `language`: str (`"en"`, `"si"`, or `"ta"`)
- `phone`: Optional[str] (Farmer's phone from `users.phone`)

### Return Contract
Must return a `ProviderSendResult`:
- `ok`: `True` if delivery succeeded or was queued upstream, `False` on failure.
- `provider_message_id`: Upstream ID (e.g. Twilio SID, FCM message ID).
- `error`: Error message string when `ok=False`.

---

## 2. Implementing a Real SMS Provider (Example)

Create `web/backend/notifications/providers/sms_twilio.py`:

```python
import os
from typing import Dict, Any
from notifications.providers.base import BaseNotificationProvider
from notifications.schemas import ProviderSendResult

class TwilioSMSProvider(BaseNotificationProvider):
    @property
    def name(self) -> str:
        return "twilio_sms"

    def send(self, payload: Dict[str, Any]) -> ProviderSendResult:
        phone = payload.get("phone")
        if not phone:
            return ProviderSendResult(ok=False, error="Recipient phone number missing.")

        try:
            # from twilio.rest import Client
            # client = Client(os.getenv("TWILIO_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
            # message = client.messages.create(
            #     body=f"{payload['title']}: {payload['body']}",
            #     from_=os.getenv("TWILIO_FROM"),
            #     to=phone
            # )
            # return ProviderSendResult(ok=True, provider_message_id=message.sid)
            return ProviderSendResult(ok=True, provider_message_id="mock-sid")
        except Exception as exc:
            return ProviderSendResult(ok=False, error=str(exc))
```

---

## 3. Registering the Provider

Update `web/backend/notifications/providers/factory.py`:

```python
from notifications.providers.sms_twilio import TwilioSMSProvider

def get_notification_provider(override_name: Optional[str] = None) -> BaseNotificationProvider:
    provider_name = (override_name or os.getenv("NOTIFICATION_PROVIDER", "mock")).lower().strip()
    if provider_name == "twilio":
        return TwilioSMSProvider()
    elif provider_name == "in_app":
        return InAppNotificationProvider()
    return MockNotificationProvider()
```

Set environment variable:
```env
NOTIFICATION_PROVIDER=twilio
```
