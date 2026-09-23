import uuid
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings

# Field photos (plot registration, planting progress) — public read (a QR
# scan needs to show them with no auth), write restricted to the service
# role key used server-side here. Never the anon key, never from the client.
PHOTOS_BUCKET = "field-photos"


@lru_cache
def _client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_key)


def _ensure_bucket() -> None:
    client = _client()
    existing = {b.name for b in client.storage.list_buckets()}
    if PHOTOS_BUCKET not in existing:
        client.storage.create_bucket(PHOTOS_BUCKET, options={"public": True})


def upload_photo(content: bytes, content_type: str, extension: str) -> str:
    """Uploads one field photo and returns its public URL. Filenames are
    server-generated (a UUID) — never derived from user input."""
    _ensure_bucket()
    path = f"{uuid.uuid4()}.{extension.lstrip('.')}"
    _client().storage.from_(PHOTOS_BUCKET).upload(
        path, content, file_options={"content-type": content_type}
    )
    return _client().storage.from_(PHOTOS_BUCKET).get_public_url(path)
