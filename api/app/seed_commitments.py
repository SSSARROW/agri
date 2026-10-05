"""Seeds a few more varied buyer commitments so the farmer-facing "Buyers
looking right now" list (GET /api/v1/commitments) isn't just the single Tea
order from seed.py — real, live data, but with only one row it reads as
static across every test session. Run with
`python -m app.seed_commitments` — refuses to run if more than the
original one commitment already exists, so it's safe to run once.

Reuses the same buyer_user_id as the existing Tea commitment rather than
inventing a new buyer account, since this api only holds a stub `users`
row (auth/profile lives in web/backend's Supabase-backed service — see
app/db/models.py's User).
"""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models import Commitment, Protocol
from app.db.session import async_session_factory


async def seed_commitments() -> None:
    async with async_session_factory() as session:
        existing = (await session.execute(select(Commitment))).scalars().all()
        if len(existing) > 1:
            print(f"{len(existing)} commitments already exist — refusing to reseed.")
            return
        if not existing:
            print("No existing commitment found — expected seed.py's Tea order first.")
            return
        buyer_user_id = existing[0].buyer_user_id

        protocols = {
            (p.crop, p.tier): p
            for p in (await session.execute(select(Protocol))).scalars().all()
        }
        now = datetime.now(timezone.utc)

        session.add_all(
            [
                Commitment(
                    id=uuid.uuid4(),
                    buyer_user_id=buyer_user_id,
                    crop="Cinnamon",
                    protocol_id=protocols[("Cinnamon", "export_standard")].id,
                    volume_kg=180,
                    remaining_kg=180,
                    delivery_window_start=now,
                    delivery_window_end=now + timedelta(days=45),
                    indicative_price_lkr_per_kg=3200,
                ),
                Commitment(
                    id=uuid.uuid4(),
                    buyer_user_id=buyer_user_id,
                    crop="Cinnamon",
                    protocol_id=None,
                    volume_kg=90,
                    remaining_kg=90,
                    delivery_window_start=now,
                    delivery_window_end=now + timedelta(days=20),
                    indicative_price_lkr_per_kg=2600,
                ),
                Commitment(
                    id=uuid.uuid4(),
                    buyer_user_id=buyer_user_id,
                    crop="Tea",
                    protocol_id=protocols[("Tea", "export_standard")].id,
                    volume_kg=750,
                    remaining_kg=750,
                    delivery_window_start=now,
                    delivery_window_end=now + timedelta(days=60),
                    indicative_price_lkr_per_kg=1650,
                ),
            ]
        )
        await session.commit()
        print("Seeded 3 more commitments (Cinnamon export, Cinnamon any standard, Tea export).")


if __name__ == "__main__":
    asyncio.run(seed_commitments())
