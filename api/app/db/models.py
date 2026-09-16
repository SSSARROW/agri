import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


ActorRole = Enum(
    "farmer",
    "collector",
    "processor",
    "exporter",
    "auditor",
    "admin",
    name="actor_role",
)


class Actor(Base):
    __tablename__ = "actor"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role: Mapped[str] = mapped_column(ActorRole, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    # NIC is stored hashed (e.g. sha256 hex digest) — the plaintext number is
    # never persisted or returned by any endpoint.
    nic_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Plot(Base):
    __tablename__ = "plot"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("actor.id"), nullable=True
    )
    geometry = mapped_column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    area_ha: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Event(Base):
    __tablename__ = "event"

    # Client-generated UUID, primary key. Re-posting the same id must be a
    # no-op — this is what makes offline sync idempotent (see B-13).
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("actor.id"), nullable=True)
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
