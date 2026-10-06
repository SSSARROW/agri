"""Seeds the two Pepper protocols (next crop after Tea/Cinnamon). Run with
`python -m app.seed_pepper_protocol` — refuses to run if a Pepper protocol
already exists, same per-crop idempotency guard as seed_cinnamon_protocol.py.

Both are real, sourced standards, not invented tiers:

- "SLS 105-1:2022 Export Grade" reflects the Sri Lanka Standards
  Institution's standard for whole/ground black pepper (Piper nigrum L.).
  It's a voluntary standard — not mandatory for export — but it's the
  reference grading system EDB and buyers use. Its five grades (Grade 1,
  Grade 2/FAQ, Grade 3, Grade 4, Pin heads) are graded primarily by bulk
  density, with moisture, oil content and extraneous matter also assessed.
  https://srilankaexport.com/pepper-grade-calculator/
  (commercial-convention bulk-density bands and the ~11% moisture ceiling
  pepper is dried to before mould/aflatoxin risk rises — explicitly notes
  the definitive grade is set by the buyer's contract and "the relevant
  ASTA/ISO/SLS standard")
  Search results from slsi.lk's own standards catalogue confirm SLS 105-1
  (Black Pepper) was last updated 2022 and covers bulk density, moisture,
  oil content and extraneous matter as its quality parameters — the exact
  per-grade bulk-density/moisture figures were not independently obtained
  from the primary standard text itself, so verify those against a current
  copy of SLS 105-1:2022 before relying on them for an export decision.

- "Organic (SLS 1324)" is the same national organic-agriculture standard
  used for Tea and Cinnamon — not crop-specific, so this reuses its
  sourcing rather than inventing a pepper-specific one.

As with Cinnamon, Sri Lanka doesn't publish a TRI-style approved-pesticide
list for pepper — the instructions point to current Department of Export
Agriculture / EDB guidance instead of a fabricated list.
"""
import asyncio

from sqlalchemy import select

from app.db.models import Protocol, ProtocolStage
from app.db.session import async_session_factory

CROP = "Pepper"

GRADE_TABLE = (
    "Graded primarily by bulk density: Grade 1 (densest/heaviest corns), "
    "Grade 2 / FAQ (Fair Average Quality), Grade 3, Grade 4, and Pin heads "
    "(smallest, broken or underdeveloped corns) — the lowest grade. "
    "Moisture, volatile oil content and freedom from extraneous matter "
    "(stalks, light berries, dust) are also assessed; verify exact "
    "per-grade thresholds against a current copy of SLS 105-1:2022."
)


async def seed_pepper_protocol() -> None:
    async with async_session_factory() as session:
        existing = (
            await session.execute(select(Protocol.id).where(Protocol.crop == CROP).limit(1))
        ).first()
        if existing:
            print(f"A {CROP} protocol already exists — refusing to reseed.")
            return

        export_standard = Protocol(
            crop=CROP,
            tier="export_standard",
            name="SLS 105-1:2022 Export Grade",
            version=1,
            is_active=True,
            source=(
                "Sri Lanka Standard SLS 105-1:2022 (Black Pepper, whole and ground) — a "
                "voluntary national standard, not mandatory for export, but the reference "
                "grading system EDB and buyers use."
            ),
        )
        session.add(export_standard)
        await session.flush()

        session.add_all(
            [
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=1,
                    day_offset=0,
                    title="Planting",
                    instructions=(
                        "Record the planting event with GPS. This protocol applies for the life of "
                        "the plot's growing cycle, not just at planting — see the standing "
                        "requirements below."
                    ),
                    required_event_types=["planted"],
                ),
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=2,
                    day_offset=None,
                    title="Inputs (standing restriction)",
                    instructions=(
                        "There is no single TRI-style approved-pesticide list published for "
                        "pepper the way there is for tea — follow current Department of Export "
                        "Agriculture / EDB guidance on permitted inputs and pre-harvest intervals "
                        "for whatever product is used, rather than a fixed list here."
                    ),
                    required_event_types=None,
                ),
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=3,
                    day_offset=None,
                    title="Harvesting and drying",
                    instructions=(
                        "Pick spikes when one or two corns per spike have just started turning "
                        "red/orange — not fully ripe (fully ripe corns are reserved for white "
                        "pepper, and picking too early loses pungency and yield). Dry promptly "
                        "after harvest and turn regularly; pepper left wet or part-dried too long "
                        "is the main cause of mould and aflatoxin contamination."
                    ),
                    required_event_types=["collect"],
                ),
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=4,
                    day_offset=None,
                    title="Grading and packaging",
                    instructions=(
                        "Grade against SLS 105-1:2022 before packing: "
                        + GRADE_TABLE
                        + " Dry to around 11% moisture or below — above that, mould and aflatoxin "
                        "risk rises sharply and buyers may reject the lot. This app has not "
                        "independently confirmed the standard's exact per-grade figures against "
                        "the published text — verify before relying on them for an export "
                        "decision."
                    ),
                    required_event_types=["process"],
                ),
            ]
        )

        organic = Protocol(
            crop=CROP,
            tier="organic",
            name="Organic (SLS 1324)",
            version=1,
            is_active=True,
            source=(
                "Sri Lanka Standard SLS 1324 (Requirements for Organic Agriculture Production and "
                "Processing), certified through the EDB's National Organic Control Unit (NOCU) and "
                "SLSI; IFOAM-recognized as of the SLS 1324:2025 revision. Not crop-specific — same "
                "standard used for Tea's and Cinnamon's organic tiers."
            ),
        )
        session.add(organic)
        await session.flush()

        session.add_all(
            [
                ProtocolStage(
                    protocol_id=organic.id,
                    sequence=1,
                    day_offset=0,
                    title="Planting",
                    instructions=(
                        "Record the planting event with GPS. A plot converting from conventional "
                        "growing needs to complete NOCU's current conversion period before its first "
                        "harvest can be certified organic — check current NOCU guidance for the "
                        "conversion length that applies to your plot; this build does not track "
                        "conversion status yet."
                    ),
                    required_event_types=["planted"],
                ),
                ProtocolStage(
                    protocol_id=organic.id,
                    sequence=2,
                    day_offset=None,
                    title="Inputs (standing restriction)",
                    instructions=(
                        "No synthetic pesticides, herbicides, or synthetic fertilizers. Use only "
                        "inputs permitted under SLS 1324 (e.g. compost, approved biological pest "
                        "control) and maintain a buffer zone from any neighboring conventionally "
                        "farmed plot, per SLS 1324's requirements on conversion, production and "
                        "handling."
                    ),
                    required_event_types=None,
                ),
                ProtocolStage(
                    protocol_id=organic.id,
                    sequence=3,
                    day_offset=None,
                    title="Harvesting and handling",
                    instructions=(
                        "Keep organic pepper physically separated from any conventional harvest at "
                        "every stage — picking, drying, grading — since commingling is a common "
                        "reason organic certification is refused at audit."
                    ),
                    required_event_types=["collect"],
                ),
            ]
        )

        await session.commit()
        print(f"Seeded 2 {CROP} protocols ({export_standard.name}, {organic.name}).")


if __name__ == "__main__":
    asyncio.run(seed_pepper_protocol())
