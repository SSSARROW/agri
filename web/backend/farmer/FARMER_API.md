# Farmer-to-Exporter Link API Documentation

This API enables farmer mobile clients to discover verified exporters, request connection links, inspect their current link status, and cancel pending requests.

## Base Prefix
`/api/farmer/exporter-link`

## Authentication
All requests require a valid JWT for an authenticated user with `role = "farmer"`:
```http
Authorization: Bearer <farmer_jwt_token>
```
Non-farmer tokens return `403 Forbidden`.

---

## 1. Directory of Verified Exporters
Returns a list of all currently verified exporters. Exporters with pending or rejected verification status are strictly omitted. Sensitive contact details (phone number, direct email, registration numbers) are hidden to protect privacy before a link is established.

- **Method**: `GET`
- **Path**: `/api/farmer/exporter-link/exporters`
- **Response**: `200 OK`
```json
[
  {
    "id": "e892cfa1-032a-4a25-83f1-d0fb3a8ef5b4",
    "company_name": "Lanka Ceylon Spices PLC",
    "description": "Leading exporter of Ceylon Organic Tea and Alba Cinnamon.",
    "logo_url": "https://example.com/logo.png",
    "districts_served": ["Kandy", "Nuwara Eliya", "Matale"],
    "crops_bought": ["tea", "cinnamon"],
    "certifications": ["organic", "rainforest_alliance"]
  }
]
```

---

## 2. Request a Link with an Exporter
Submit a link request to a verified exporter.

- **Method**: `POST`
- **Path**: `/api/farmer/exporter-link/request`
- **Body**:
```json
{
  "exporter_profile_id": "e892cfa1-032a-4a25-83f1-d0fb3a8ef5b4"
}
```
- **Response**: `200 OK`
```json
{
  "id": "f5194f4a-2503-4f0e-b816-56ffcb0dae59",
  "farmer_id": "8489c7ad-6f01-447a-85d6-d0aebef6ea62",
  "exporter_profile_id": "e892cfa1-032a-4a25-83f1-d0fb3a8ef5b4",
  "exporter_company_name": "Lanka Ceylon Spices PLC",
  "status": "requested",
  "requested_at": "2026-10-12T14:30:00Z",
  "decided_at": null,
  "decision_reason": null
}
```
- **Error Responses**:
  - `400 Bad Request`: Exporter profile does not exist or is not verified.
  - `409 Conflict`: The farmer already has an active link (`requested` or `approved`).

---

## 3. Get Current Link Status
Retrieves the farmer's current active connection (status `requested` or `approved`).

- **Method**: `GET`
- **Path**: `/api/farmer/exporter-link/current`
- **Response (when link exists)**: `200 OK`
```json
{
  "has_active_link": true,
  "link": {
    "id": "f5194f4a-2503-4f0e-b816-56ffcb0dae59",
    "farmer_id": "8489c7ad-6f01-447a-85d6-d0aebef6ea62",
    "exporter_profile_id": "e892cfa1-032a-4a25-83f1-d0fb3a8ef5b4",
    "exporter_company_name": "Lanka Ceylon Spices PLC",
    "status": "approved",
    "requested_at": "2026-10-12T14:30:00Z",
    "decided_at": "2026-10-12T15:00:00Z",
    "decision_reason": null
  }
}
```
- **Response (when no active link)**: `200 OK`
```json
{
  "has_active_link": false,
  "link": null
}
```

---

## 4. Cancel a Pending Request
Allows a farmer to cancel their pending `requested` link before the exporter acts on it.

- **Method**: `POST`
- **Path**: `/api/farmer/exporter-link/cancel`
- **Response**: `200 OK`
```json
{
  "id": "f5194f4a-2503-4f0e-b816-56ffcb0dae59",
  "farmer_id": "8489c7ad-6f01-447a-85d6-d0aebef6ea62",
  "exporter_profile_id": "e892cfa1-032a-4a25-83f1-d0fb3a8ef5b4",
  "status": "cancelled",
  "requested_at": "2026-10-12T14:30:00Z",
  "decided_at": "2026-10-12T15:10:00Z",
  "decision_reason": "Cancelled by farmer"
}
```
- **Error Responses**:
  - `400 Bad Request`: No pending `requested` link found to cancel (e.g., link is already approved, declined, or removed).
