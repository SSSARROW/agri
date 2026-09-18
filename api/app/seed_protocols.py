"""Seeds the two Tea protocols (B-30) this build ships with. Run with
`python -m app.seed_protocols` — refuses to run if any protocol already
exists, same guard style as seed.py.

Both are real, sourced standards, not invented tiers:

- "SLTB Export Standard" reflects the Sri Lanka Tea Board's mandatory
  minimum for exported Sri Lankan-origin tea: ISO 3720:1986 basic
  requirements plus the pesticide list in Circular AL/MQS-Rev/2010,
  Annexure A (the 27 pesticides TRI recommends for use on tea — anything
  else is a residue violation for export).
  https://srilankateaboard.lk/wp-content/uploads/2021/04/Sri_Lanka_Tea_Board_Standards__Guidelines_for_tea.pdf

- "Organic (SLS 1324)" reflects Sri Lanka's national organic standard,
  administered by the EDB's National Organic Control Unit and certified
  by SLSI — IFOAM-recognized as of the 2025 revision.
  https://slsi.lk/en/services/organic-product-certification/
  https://slsi.lk/en/sri-lanka-organic-standard-sls-13242025-receives-ifoam-recognition/

Where the source document doesn't give a specific number (e.g. an exact
pre-harvest interval per product, or the current conversion-period length),
the instruction text says to check current TRI/NOCU guidance rather than
inventing one — these are real standards farmers and buyers can be held to,
so a fabricated figure would be worse than no figure.
"""
import asyncio

from sqlalchemy import select

from app.db.models import Protocol, ProtocolStage
from app.db.session import async_session_factory

CROP = "Tea"

# The 27 pesticides TRI recommends for use on tea, per SLTB Circular
# AL/MQS-Rev/2010 Annexure A — Sri Lankan-origin export tea should carry
# residues of nothing outside this list.
TRI_APPROVED_PESTICIDES = [
    "2,4-D", "Azadirachtin (neem extract)", "Bitertanol", "Carbofuran", "Carbosulfan",
    "Chlorfluazuron", "Copper hydroxide", "Copper oxide", "Copper oxychloride", "Dazomet",
    "Diazinon", "Diuron", "Fenamiphos", "Fenthion", "Glufosinate-ammonium", "Glyphosate",
    "Hexaconazole", "Imidacloprid", "MCPA", "Metam sodium", "Oxyfluorfen", "Paraquat",
    "Propargite", "Propiconazole", "Sulphur", "Tebuconazole", "Tebufenozide",
]


async def seed_protocols() -> None:
    async with async_session_factory() as session:
        existing = (await session.execute(select(Protocol.id).limit(1))).first()
        if existing:
            print("Protocols already exist — refusing to reseed.")
            return

        export_standard = Protocol(
            crop=CROP,
            tier="export_standard",
            name="SLTB Export Standard",
            version=1,
            is_active=True,
            source=(
                "Sri Lanka Tea Board Circular AL/MQS-Rev/2010 (Standards/Guidelines for Tea), "
                "Annexure A — ISO 3720:1986 basic requirements + TRI-approved pesticide list."
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
                        "the plot's growing cycle, not just at planting — see the standing pesticide "
                        "restriction below."
                    ),
                    required_event_types=["planted"],
                ),
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=2,
                    day_offset=None,
                    title="Pesticide use (standing restriction)",
                    instructions=(
                        "Use only pesticides on the TRI-approved list for tea: "
                        + ", ".join(TRI_APPROVED_PESTICIDES)
                        + ". Follow the pre-harvest interval on each product's label before "
                        "plucking — this varies by product and isn't a single fixed number of days. "
                        "Any residue outside this list is grounds for export rejection under SLTB "
                        "Circular AL/MQS-Rev/2010."
                    ),
                    required_event_types=None,
                ),
                ProtocolStage(
                    protocol_id=export_standard.id,
                    sequence=3,
                    day_offset=None,
                    title="Plucking and handling",
                    instructions=(
                        "Pluck into clean containers; keep leaf free of foreign matter (soil, other "
                        "plant material, packaging) — SLTB guidelines require finished tea to be "
                        "completely free of foreign matter, which starts at the plucking stage."
                    ),
                    required_event_types=["collect"],
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
                "SLSI; IFOAM-recognized as of the SLS 1324:2025 revision."
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
                    title="Plucking and handling",
                    instructions=(
                        "Keep organic leaf physically separated from any conventional leaf at every "
                        "stage — collection, weighing, processing — since commingling is a common "
                        "reason organic certification is refused at audit."
                    ),
                    required_event_types=["collect"],
                ),
            ]
        )

        await session.commit()
        print(f"Seeded 2 protocols ({export_standard.name}, {organic.name}) with 3 stages each.")


if __name__ == "__main__":
    asyncio.run(seed_protocols())
