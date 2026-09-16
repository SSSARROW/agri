"""Seed script (B-04): one district, 20 plots, 30 batches with plausible
event chains. Run with `python -m app.seed` against a fresh database — it
refuses to run if plots already exist, to avoid duplicating demo data on a
second run.

People are not seeded here — `public.users` (Supabase, owned by the auth
team) is the source of truth for actors. Plot ownership and event
attribution use whatever real users already exist there; if none do yet,
those foreign keys are left null rather than fabricating accounts in
someone else's auth table.
"""
import asyncio
import math
import random
import uuid
from datetime import datetime, timedelta, timezone

from geoalchemy2.elements import WKTElement
from sqlalchemy import select, text

from app.db.models import Batch, Event, Plot
from app.db.session import async_session_factory

random.seed(42)

# Nuwara Eliya — Sri Lanka's principal tea-growing district (single crop,
# single district, per the build plan's assumptions).
DISTRICT = "Nuwara Eliya"
DSD_OPTIONS = ["Nuwara Eliya DSD", "Kotmale DSD", "Walapane DSD"]
GN_OPTIONS = ["Kandapola", "Labookellie", "Ramboda", "Bogawantalawa", "Agarapatana"]
CENTER_LAT, CENTER_LON = 6.9497, 80.7891
CROP = "Tea"

# Unambiguous code alphabet — no 0/O, 1/I/L, so a code stays readable aloud.
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def make_square_polygon(center_lat: float, center_lon: float, side_m: float) -> tuple[WKTElement, float]:
    """A small square plot around (center_lat, center_lon). Returns (geometry, area_ha)."""
    half = side_m / 2
    dlat = half / 111_320  # metres per degree latitude, ~constant
    dlon = half / (111_320 * abs(math.cos(math.radians(center_lat))))
    corners = [
        (center_lon - dlon, center_lat - dlat),
        (center_lon + dlon, center_lat - dlat),
        (center_lon + dlon, center_lat + dlat),
        (center_lon - dlon, center_lat + dlat),
        (center_lon - dlon, center_lat - dlat),
    ]
    wkt = "POLYGON((" + ", ".join(f"{lon} {lat}" for lon, lat in corners) + "))"
    area_ha = (side_m * side_m) / 10_000
    return WKTElement(wkt, srid=4326), round(area_ha, 4)


def make_batch_code() -> str:
    return "".join(random.choices(CODE_ALPHABET, k=6))


def pick_user(user_ids: list[uuid.UUID]) -> uuid.UUID | None:
    return random.choice(user_ids) if user_ids else None


async def seed() -> None:
    async with async_session_factory() as session:
        existing = (await session.execute(select(Plot.id).limit(1))).first()
        if existing:
            print("Plots already exist — refusing to reseed. Reset the database first if you want fresh demo data.")
            return

        user_ids = [row[0] for row in (await session.execute(text("SELECT id FROM users")))]
        if not user_ids:
            print("No rows in public.users yet — plots/events will be seeded with no owner/actor attributed.")

        plots: list[Plot] = []
        for i in range(20):
            offset_lat = random.uniform(-0.05, 0.05)
            offset_lon = random.uniform(-0.05, 0.05)
            side_m = random.uniform(30, 140)  # small tea smallholdings
            geometry, area_ha = make_square_polygon(CENTER_LAT + offset_lat, CENTER_LON + offset_lon, side_m)
            plots.append(
                Plot(
                    owner_user_id=pick_user(user_ids),
                    geometry=geometry,
                    area_ha=area_ha,
                    district=DISTRICT,
                    dsd=random.choice(DSD_OPTIONS),
                    gn_division=random.choice(GN_OPTIONS),
                )
            )
        session.add_all(plots)
        await session.flush()

        used_codes: set[str] = set()

        def unique_code() -> str:
            while True:
                code = make_batch_code()
                if code not in used_codes:
                    used_codes.add(code)
                    return code

        batches: list[Batch] = []
        for i in range(25):
            batches.append(Batch(code=unique_code(), crop=CROP, plot_id=random.choice(plots).id))
        session.add_all(batches)
        await session.flush()

        # A handful of merges, to give lineage (B-14) something to walk.
        merged_batches: list[Batch] = []
        for i in range(5):
            parents = random.sample(batches, 2)
            merged_batches.append(
                Batch(
                    code=unique_code(),
                    crop=CROP,
                    plot_id=parents[0].plot_id,
                    parent_batch_ids=[p.id for p in parents],
                )
            )
        session.add_all(merged_batches)
        await session.flush()

        all_batches = batches + merged_batches

        events: list[Event] = []
        now = datetime.now(timezone.utc)
        for batch in all_batches:
            # Harvest (collect) offset is always well under the minimum planting
            # offset, so no event in the chain can land in the future.
            planted_at = now - timedelta(days=random.randint(100, 150))
            plot_id = batch.plot_id
            owner = next((p.owner_user_id for p in plots if p.id == plot_id), None)

            chain = [
                ("planted", owner, planted_at),
                ("collect", pick_user(user_ids), planted_at + timedelta(days=random.randint(45, 80))),
            ]
            collect_at = chain[-1][2]
            chain += [
                ("weigh", pick_user(user_ids), collect_at + timedelta(hours=random.randint(1, 6))),
                ("process", pick_user(user_ids), collect_at + timedelta(hours=random.randint(6, 24))),
                ("grade", pick_user(user_ids), collect_at + timedelta(days=random.randint(1, 3))),
                ("pack", pick_user(user_ids), collect_at + timedelta(days=random.randint(3, 5))),
            ]

            for event_type, user_id, occurred_at in chain:
                events.append(
                    Event(
                        id=uuid.uuid4(),
                        event_type=event_type,
                        user_id=user_id,
                        batch_id=batch.id if event_type != "planted" else None,
                        plot_id=plot_id if event_type == "planted" else None,
                        payload={"crop": CROP, "batch_code": batch.code},
                        occurred_at=occurred_at,
                    )
                )
        session.add_all(events)

        await session.commit()
        print(
            f"Seeded {len(plots)} plots, {len(all_batches)} batches, {len(events)} events "
            f"(attributed to {len(user_ids)} existing users)."
        )


if __name__ == "__main__":
    asyncio.run(seed())
