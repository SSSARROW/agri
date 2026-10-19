# Farmer Notifications API

Additive REST API enabling the mobile application and farmers to view and manage in-app notifications and planting notice reminders.

Base Path: `/api/farmer/notifications`
Authentication: Bearer JWT (`role: "farmer"`)

---

## Endpoints

### 1. List Notifications
`GET /api/farmer/notifications`

Lists delivered notifications for the authenticated farmer, ordered newest first. Includes an `unread_count` for badge displays.

#### Query Parameters:
- `page` (optional integer, default `1`): Page number (>= 1).
- `page_size` (optional integer, default `20`): Page size (1 to 100).

#### Response: `200 OK`
```json
{
  "items": [
    {
      "id": "e4f3a1b0-9c2d-4e8f-8a1b-0c2d4e8f8a1b",
      "notice_id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
      "reminder_slot": 14,
      "title": "Ceylon Cinnamon Planting Notice Reminder",
      "body": "Reminder: Target planting month 2026-11 is in 14 days. Please submit your confirmation.",
      "language": "en",
      "channel": "in_app",
      "status": "sent",
      "sent_at": "2026-10-18T02:00:00Z",
      "read_at": null,
      "created_at": "2026-10-18T02:00:00Z"
    }
  ],
  "total": 1,
  "unread_count": 1,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

---

### 2. Mark Notification Read
`POST /api/farmer/notifications/{id}/read`

Marks the specified notification as read (`status = "read"`, `read_at = now()`).
This endpoint is **idempotent**: calling it multiple times on an already read notification returns `200 OK` with the existing `read_at` timestamp.

#### Response: `200 OK`
```json
{
  "id": "e4f3a1b0-9c2d-4e8f-8a1b-0c2d4e8f8a1b",
  "status": "read",
  "read_at": "2026-10-19T06:30:00Z"
}
```

#### Errors:
- `401 Unauthorized`: Missing or expired token.
- `403 Forbidden`: Account is not a farmer.
- `404 Not Found`: Notification does not exist or belongs to another farmer.
