# Farmer Planting Notices API Specification

All farmer planting notice endpoints are authenticated via Bearer JWT with role `farmer`.
Base URL: `/api/farmer/planting-notices`

---

## 1. List Available Planting Notices
`GET /api/farmer/planting-notices`

Returns all published, upcoming planting notices from the exporter with whom the farmer has an **approved** link, matching the farmer's registered district.

### Query Parameters
- `page` (optional integer, default 1)
- `page_size` (optional integer, default 10, max 50)

### Response (200 OK)
```json
{
  "items": [
    {
      "id": "7a8b9c0d-1234-4567-89ab-cdef01234567",
      "crop": "tea",
      "target_month": "2026-11-01",
      "volume_needed_kg": 5000.0,
      "title": {
        "en": "Sourcing High-Grown Tea Harvest",
        "si": "උසස් තත්ත්වයේ තේ අස්වැන්න",
        "ta": ""
      },
      "exporter_name": "Ceylon Premium Exports Ltd",
      "exporter_logo_url": null,
      "farmer_response": "ready",
      "expected_volume_kg": 750.0,
      "plot_id": "3f4a5b6c-7890-1234-5678-abcdef012345",
      "published_at": "2026-10-15T12:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

---

## 2. Get Notice Details
`GET /api/farmer/planting-notices/{id}`

Returns full notice details, public exporter profile (no contact info), current farmer response, and linked quality standard version stages.

### Response (200 OK)
```json
{
  "id": "7a8b9c0d-1234-4567-89ab-cdef01234567",
  "crop": "tea",
  "target_month": "2026-11-01",
  "volume_needed_kg": 5000.0,
  "title": { "en": "Sourcing High-Grown Tea Harvest" },
  "message": { "en": "Get ready to plant tea in November. Ensure standard adherence." },
  "published_at": "2026-10-15T12:00:00Z",
  "exporter": {
    "company_name": "Ceylon Premium Exports Ltd",
    "logo_url": null
  },
  "current_response": "ready",
  "current_expected_volume_kg": 750.0,
  "current_plot_id": "3f4a5b6c-7890-1234-5678-abcdef012345",
  "standard_version_id": "9a8b7c6d-5432-1098-7654-3210fedcba98",
  "standard_name": "Ceylon Orthodox BOPF Standard",
  "standard_version_number": 1,
  "stages": [
    {
      "id": "11223344-5566-7788-9900-aabbccddeeff",
      "stage_order": 1,
      "name": "Soil Preparation & Organic Fertilization",
      "description": "Baseline soil conditioning",
      "rules_count": 3
    }
  ]
}
```

---

## 3. List Farmer Plots for Reply
`GET /api/farmer/planting-notices/{id}/plots`

Returns plots owned by the farmer that can be selected for a `ready` reply.

### Response (200 OK)
```json
[
  {
    "id": "3f4a5b6c-7890-1234-5678-abcdef012345",
    "name": "Hillside Tea Terrace",
    "area_ha": 1.25,
    "district": "Kandy",
    "dsd": "Ganga Ihala Korale",
    "gn_division": "Kurunduwatta"
  }
]
```

---

## 4. Respond to Notice
`POST /api/farmer/planting-notices/{id}/respond`

Submits or updates the farmer's response.

### Request Body (Ready)
```json
{
  "response": "ready",
  "expected_volume_kg": 750.0,
  "plot_id": "3f4a5b6c-7890-1234-5678-abcdef012345"
}
```

### Request Body (Cannot)
```json
{
  "response": "cannot"
}
```

### Response (200 OK)
```json
{
  "status": "ok",
  "notice_id": "7a8b9c0d-1234-4567-89ab-cdef01234567",
  "farmer_id": "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
  "response": "ready",
  "expected_volume_kg": 750.0,
  "plot_id": "3f4a5b6c-7890-1234-5678-abcdef012345",
  "responded_at": "2026-10-15T14:30:00Z",
  "message": "You responded Ready. Your plot has been bound for this planting season."
}
```

### Errors
| Status | Meaning |
|---|---|
| 400 | Missing expected volume or plot when responding ready; or invalid values |
| 403 | Plot does not belong to farmer |
| 404 | Notice not found or not visible to this farmer |
| 409 | Replies locked (target month has started); or plot already bound for this season and crop |
