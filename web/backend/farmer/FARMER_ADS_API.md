# Farmer Advertisements & Purchase Requests API

Base URL prefix: `/api/farmer/ads`
Authentication: Bearer JWT token with role `farmer` (`Authorization: Bearer <token>`).

---

## 1. Browse Open Advertisements
Returns active purchase requests published by verified exporters that match the farmer's registered district (or all districts if unspecified by the ad). Ads that are expired or filled are excluded.

- **Method**: `GET`
- **Path**: `/api/farmer/ads`
- **Query Parameters**:
  - `crop` (optional, string): Filter by crop (`tea`, `cinnamon`).
  - `page` (optional, integer, default: `1`): Page number.
  - `page_size` (optional, integer, default: `10`): Items per page.

### Response (200 OK)
```json
{
  "items": [
    {
      "id": "1d27932e-5f9e-4e4b-9e41-61cfb36e09cb",
      "crop": "tea",
      "grade_tier": "BOPF Special",
      "quantity_kg": 5000.0,
      "approved_quantity_kg": 1500.0,
      "remaining_quantity_kg": 3500.0,
      "price_type": "fixed",
      "price_fixed": 1250.0,
      "price_min": null,
      "price_max": null,
      "collection_window_start": "2026-10-20T00:00:00Z",
      "collection_window_end": "2026-11-05T00:00:00Z",
      "pickup_location": "Kandy Tea Factory Gate",
      "eligible_districts": ["Kandy", "Nuwara Eliya"],
      "expires_at": "2026-10-25T00:00:00Z",
      "title": {
        "en": "Sourcing 5,000kg Pure BOPF High Grown Tea",
        "si": "උසස් තත්ත්වයේ තේ මිලදී ගැනීමේ දැන්වීම"
      },
      "exporter": {
        "company_name": "Ceylon Premium Exports Ltd",
        "description": "Leading single-origin tea exporter.",
        "logo_url": null,
        "certifications": ["SLSI", "Fair Trade"]
      }
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

---

## 2. Get Advertisement Detail with Quality Standards & Terms
Returns the complete live version of the advertisement including full commercial terms, the linked published quality standard version, and all quality stages. Includes `terms_hash` computed deterministically by the server.

- **Method**: `GET`
- **Path**: `/api/farmer/ads/{id}`

### Response (200 OK)
```json
{
  "id": "1d27932e-5f9e-4e4b-9e41-61cfb36e09cb",
  "crop": "tea",
  "status": "published",
  "computed_status": "live",
  "ad_version_id": "40b1c098-b806-444d-8ff7-5bc68efbb57a",
  "version_number": 1,
  "title": {
    "en": "Sourcing 5,000kg Pure BOPF High Grown Tea"
  },
  "description": {
    "en": "Looking for fresh, clean two leaves and a bud harvest."
  },
  "grade_tier": "BOPF Special",
  "quantity_kg": 5000.0,
  "approved_quantity_kg": 1500.0,
  "remaining_quantity_kg": 3500.0,
  "price_type": "fixed",
  "price_fixed": 1250.0,
  "price_min": null,
  "price_max": null,
  "collection_window_start": "2026-10-20T00:00:00Z",
  "collection_window_end": "2026-11-05T00:00:00Z",
  "pickup_location": "Kandy Tea Factory Gate",
  "eligible_districts": ["Kandy", "Nuwara Eliya"],
  "terms": {
    "payment_timing": "Within 7 days of delivery",
    "rejection_handling": "Returned at seller cost"
  },
  "expires_at": "2026-10-25T00:00:00Z",
  "exporter": {
    "company_name": "Ceylon Premium Exports Ltd",
    "description": "Leading single-origin tea exporter.",
    "logo_url": null,
    "certifications": ["SLSI"]
  },
  "standard_name": "High-Grown Orthodox Standard",
  "standard_version_number": 1,
  "standard_stages": [
    {
      "position": 1,
      "name": "Plucking Standards",
      "timing_type": "recurring",
      "start_offset_days": 0,
      "instructions": { "en": "Pluck only tender bud and two leaves." },
      "dos": { "en": ["Use clean bamboo baskets"] },
      "donts": { "en": ["Do not compress leaves"] },
      "allowed_inputs": [],
      "banned_inputs": [],
      "required_proof": { "photo_count": 2 }
    }
  ],
  "terms_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

---

## 3. Accept Advertisement (Submit Purchase Request Supply)
Submit an acceptance to supply a specified quantity (kg) for a live advertisement.
- Creates an active link in `farmer_exporter_links` if none exists, or reuses an existing active link with the same exporter.
- Rejects if the farmer is currently linked to a different exporter (HTTP 409).
- Rejects if `ad_version_id` is outdated (HTTP 409).
- Rejects duplicate acceptance for the same ad by the same farmer (HTTP 409).

- **Method**: `POST`
- **Path**: `/api/farmer/ads/{id}/accept`

### Request Body
```json
{
  "ad_version_id": "40b1c098-b806-444d-8ff7-5bc68efbb57a",
  "supply_quantity_kg": 750.0
}
```

### Response (200 OK)
```json
{
  "acceptance_id": "2b31f810-749e-4e48-8df0-7a0c8b2e1a3b",
  "ad_id": "1d27932e-5f9e-4e4b-9e41-61cfb36e09cb",
  "ad_version_id": "40b1c098-b806-444d-8ff7-5bc68efbb57a",
  "farmer_id": "f5e921d7-2f3b-4171-897c-658b5a8e0f19",
  "link_id": "3c7a1024-5d9e-40e1-bb54-1b918f6c3a21",
  "supply_quantity_kg": 750.0,
  "terms_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "accepted_at": "2026-10-13T14:40:00Z",
  "derived_status": "pending",
  "message": "Advertisement acceptance submitted successfully."
}
```

---

## 4. Withdraw Acceptance
Farmer withdraws an acceptance while it is still pending (`status: requested`).
- Marks acceptance as `withdrawn_at = now()`.
- If no other pending acceptance depends on that link, sets link status to `cancelled`.
- If acceptance was already approved by the exporter, returns HTTP 400 instructing the farmer to contact the exporter.

- **Method**: `POST`
- **Path**: `/api/farmer/ads/{id}/withdraw`

### Response (200 OK)
```json
{
  "success": true,
  "message": "Advertisement acceptance withdrawn successfully.",
  "withdrawn_at": "2026-10-13T14:45:00Z"
}
```

---

## 5. My Acceptances
Returns all advertisements accepted by the farmer with their derived status (`pending`, `approved`, `declined`, `withdrawn`, `removed`).

- **Method**: `GET`
- **Path**: `/api/farmer/ads/my-acceptances`

### Response (200 OK)
```json
{
  "items": [
    {
      "acceptance_id": "2b31f810-749e-4e48-8df0-7a0c8b2e1a3b",
      "ad_id": "1d27932e-5f9e-4e4b-9e41-61cfb36e09cb",
      "ad_title": { "en": "Sourcing 5,000kg Pure BOPF High Grown Tea" },
      "crop": "tea",
      "grade_tier": "BOPF Special",
      "ad_version_number": 1,
      "exporter_name": "Ceylon Premium Exports Ltd",
      "exporter_logo_url": null,
      "supply_quantity_kg": 750.0,
      "price_type": "fixed",
      "price_fixed": 1250.0,
      "price_min": null,
      "price_max": null,
      "collection_window_start": "2026-10-20T00:00:00Z",
      "collection_window_end": "2026-11-05T00:00:00Z",
      "accepted_at": "2026-10-13T14:40:00Z",
      "withdrawn_at": null,
      "derived_status": "pending",
      "link_status": "requested"
    }
  ],
  "total": 1
}
```

---

## 5. Report an Advertisement

Report a live advertisement for review by the Paramparā team.

- **Method**: `POST`
- **Path**: `/api/farmer/ads/{id}/report`
- **Auth**: Bearer JWT with role `farmer`

### Request Body
```json
{
  "reason": "fake_ad",
  "details": "The contact number is invalid and the company name does not exist."
}
```

`reason` must be one of: `fake_ad`, `wrong_information`, `suspicious_exporter`, `other`.
`details` is optional, max 500 characters.

### Response (200 OK)
```json
{
  "report_id": "a1b2c3d4-...",
  "ad_id": "1d27932e-...",
  "farmer_id": "9f4ac2b1-...",
  "reason": "fake_ad",
  "details": "...",
  "status": "open",
  "created_at": "2026-10-15T09:00:00Z",
  "message": "Report submitted. Our team will review it shortly."
}
```

### Errors
| Status | Meaning |
|---|---|
| 400 | Ad is not live (closed or expired) |
| 404 | Ad not found |
| 409 | You have already reported this ad |
| 403 | Not a farmer token |

