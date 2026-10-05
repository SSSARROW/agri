"""Seeds the two Cinnamon protocols (B-30) this build ships with. Run with
`python -m app.seed_cinnamon_protocol` — refuses to run if a Cinnamon
protocol already exists, same idempotency guard as seed_protocols.py, but
scoped to this crop rather than "any protocol anywhere" so it can run
alongside Tea's seed without touching it.

Both are real, sourced standards, not invented tiers:

- "SLS 81:2021 Export Grade" reflects the Sri Lanka Standards Institution's
  mandatory standard for Ceylon Cinnamon — the EDB requires an SLS 81 test
  report before a product can carry the "Pure Ceylon Cinnamon" certification
  mark. The 13-grade table (quill diameter, quills per kg, max foxing) and
  the chemical/microbiological limits below are taken directly from the
  2021 revision.
  https://www.srilankabusiness.com/pdfs/spices/pcc/pcc-guidelines.pdf
  (EDB, "Guidelines for the use of 'Pure Ceylon Cinnamon' Logo" — point 16:
  processing must follow SLS 81 for hygiene, grading, packaging and
  labelling)
  https://druera.com/blogs/ceylon-cinnamon-basics/the-sri-lanka-standards-institute-standard-for-ceylon-cinnamon-sls-81-2021
  (secondary source for the grade table itself — SLS 81:2021 is not
  published free online; verify the figures below against a current copy
  of the standard before relying on them for an actual export decision)

- "Organic (SLS 1324)" is the same national organic-agriculture standard
  used for Tea in seed_protocols.py — SLS 1324 isn't crop-specific, so this
  reuses its sourcing rather than inventing a cinnamon-specific one.

Sri Lanka doesn't publish a TRI-style approved-pesticide list for cinnamon
the way it does for tea, so unlike Tea's export standard this doesn't claim
one — the instructions point to current Department of Export Agriculture /
EDB guidance instead of a fabricated list.
"""
import asyncio

from sqlalchemy import select

from app.db.models import Protocol, ProtocolStage
from app.db.session import async_session_factory

CROP = "Cinnamon"

# SLS 81:2021's 13 grades, coarsest requirement (foxing %) per market group —
# shown to the farmer as a reference table, not enforced mechanically (grading
# happens by hand against the physical quills, not from anything this app
# can measure).
GRADE_TABLE = (
    "Continental: Alba (max 6mm, 45+ quills/kg, max 10% foxing), "
    "C5 Extra Special (8mm, 33+/kg, 10%), C5 Special (10mm, 30+/kg, 10%), "
    "C5 (12mm, 27+/kg, 5%), C4 (16mm, 22+/kg, 15%), C3 (18mm, 20+/kg, 20%). "
    "Mexican: M5 Special, M5, M4 (16-21mm, 15-22/kg, up to 60% foxing). "
    "Hamburg: H1-H3 (23-38mm, 6-10/kg, up to 65% foxing)."
)


async def seed_cinnamon_protocol() -> None:
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
            name="SLS 81:2021 Export Grade",
            version=1,
            is_active=True,
            source=(
                "Sri Lanka Standard SLS 81:2021 (Ceylon Cinnamon) — required test report for the "
                "EDB's 'Pure Ceylon Cinnamon' certification mark."
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
                        "cinnamon the way there is for tea — follow current Department of Export "
                        "Agriculture / EDB guidance on permitted inputs and pre-harvest intervals "
                        "for whatever product is used, rather than a fixed list here."
                    ),
                    required_event_types=None,
                ),
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=3,
                    day_offset=None,
                    title="Harvesting and peeling",
                    instructions=(
                        "Keep peeled bark free of foreign matter and separated by harvest batch — "
                        "grading in the next stage depends on quill diameter and condition being "
                        "traceable to a single harvest, not mixed lots."
                    ),
                    required_event_types=["collect"],
                ),
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=4,
                    day_offset=None,
                    title="Grading, processing and packaging",
                    instructions=(
                        "Grade quills against SLS 81:2021's table before packing: "
                        + GRADE_TABLE
                        + " Processing must also meet SLS 81's moisture (14% max whole / 12% max "
                        "ground), total ash, volatile oil, and sulphur dioxide (150 mg/kg max) "
                        "limits, its heavy-metal limits (arsenic 0.1, cadmium 0.2, lead 0.2 mg/kg "
                        "max), and its microbiological requirement (E. coli and Salmonella absent). "
                        "Verify these figures against a current copy of SLS 81:2021 before relying "
                        "on them for an export decision — this app has not independently confirmed "
                        "them against the published standard."
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
                "standard used for Tea's organic tier."
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
                        "Keep organic bark physically separated from any conventional harvest at "
                        "every stage — collection, peeling, processing — since commingling is a "
                        "common reason organic certification is refused at audit."
                    ),
                    required_event_types=["collect"],
                ),
            ]
        )

        await session.commit()
        print(
            f"Seeded 2 {CROP} protocols ({export_standard.name}, {organic.name})."
        )


if __name__ == "__main__":
    asyncio.run(seed_cinnamon_protocol())
