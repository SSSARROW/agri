import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# People are owned by the auth team's `public.users` table (Supabase), not a
# table of ours — no local `actor` table. Its `role` enum currently only has
# admin/farmer/exporter; collector/processor/auditor aren't login-backed yet,
# so user_id below is intentionally nullable and role-agnostic.
#
# This stub only declares the column our FKs point at. It exists purely so
# SQLAlchemy's ORM can resolve those FKs (insert ordering etc.) — we never
# create/alter this table ourselves, and migrations/env.py excludes it from
# autogenerate so a future `alembic revision --autogenerate` never proposes
# "fixing" the real users table to match this stub.
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)


class Plot(Base):
    __tablename__ = "plot"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    geometry = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    area_ha: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    # "walked" (a real boundary, corner pins dropped in the field) vs
    # "estimated_square" (a single GPS pin + an approximate side length) —
    # downstream consumers (an exporter, a certifier) need to know which.
    boundary_source: Mapped[str] = mapped_column(String, nullable=False, server_default="estimated_square")
    # A plot's boundary polygon already supports any shape (a walked circle
    # or an irregular greenhouse footprint work the same as a field) — this
    # is separate metadata about the growing environment itself, since some
    # protocol requirements (e.g. organic's buffer-zone-from-neighbors rule)
    # don't cleanly apply to an enclosed structure.
    plot_type: Mapped[str] = mapped_column(String, nullable=False, server_default="open_field")
    # Optional farmer-chosen label ("Lower field") — plots in the same GN
    # division otherwise look identical in a list.
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    district: Mapped[str | None] = mapped_column(String, nullable=True)
    dsd: Mapped[str | None] = mapped_column(String, nullable=True)
    gn_division: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Batch(Base):
    __tablename__ = "batch"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    crop: Mapped[str] = mapped_column(String, nullable=False)
    plot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("plot.id"), nullable=True)
    # Lineage: the DAG is walked with a recursive CTE (B-14) rather than a join
    # table, since splits/merges are rare writes but ancestry reads are common.
    parent_batch_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )
    # Which quality standard this batch is claiming to meet (B-30) — chosen by
    # the farmer at batch registration, since that's the point they commit to
    # a grading path. Nullable: pre-protocol batches, or a farmer who skips it.
    protocol_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("protocol.id"), nullable=True)
    # Auto-matched to an open buyer commitment for the same crop/protocol at
    # creation time (B-50) — "one buyer" for the first working loop makes this
    # safe; a real matching/claim flow can replace it once there's more than one.
    commitment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("commitment.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Protocol(Base):
    __tablename__ = "protocol"

    # A (crop, tier) pair, versioned rather than mutated in place — a batch
    # stores the exact protocol_id it was registered under, so editing the
    # "live" version for future batches never rewrites what past batches
    # claimed to meet (B-30's versioning requirement).
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    crop: Mapped[str] = mapped_column(String, nullable=False)
    tier: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Citation for where this standard actually comes from (circular number,
    # standard number, URL) — shown to farmers and consumers, never fabricated.
    source: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProtocolStage(Base):
    __tablename__ = "protocol_stage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    protocol_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("protocol.id"), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    # Null day_offset means "applies throughout" (e.g. a standing pesticide
    # restriction) rather than a one-time milestone.
    day_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    instructions: Mapped[str] = mapped_column(String, nullable=False)
    required_event_types: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)


class Commitment(Base):
    __tablename__ = "commitment"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    buyer_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    crop: Mapped[str] = mapped_column(String, nullable=False)
    protocol_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("protocol.id"), nullable=True)
    volume_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # Decremented as matched batches report a weight (B-50's "shows remaining
    # unallocated volume") — never negative; clamped at 0 in the route.
    remaining_kg: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    delivery_window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    delivery_window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    indicative_price_lkr_per_kg: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Event(Base):
    __tablename__ = "event"

    # Client-generated UUID, primary key. Re-posting the same id must be a
    # no-op — this is what makes offline sync idempotent (see B-13).
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("batch.id"), nullable=True)
    plot_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("plot.id"), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Device-reported capture time vs. server receipt time — an event captured
    # offline must keep its true capture time after syncing hours later (M-06).
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Scan(Base):
    __tablename__ = "scan"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("batch.id"), nullable=True)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    hashed_ip: Mapped[str] = mapped_column(String, nullable=False)
    # Coarse geolocation only (rounded to ~1km) — never store precise scanner location.
    coarse_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    coarse_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
