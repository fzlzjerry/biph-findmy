"""SQLAlchemy models — the single source of truth for the schema (see scripts/gen_schema.py)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String,
                        Text, TypeDecorator, UniqueConstraint, Uuid)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Always timezone-aware UTC in Python, whatever the database stores."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(60), default="")
    role: Mapped[str] = mapped_column(String(16), default="user")  # user | admin
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(8), index=True)  # lost | found
    status: Mapped[str] = mapped_column(String(12), index=True, default="open")
    title: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text)
    marks_text: Mapped[str] = mapped_column(Text, default="")
    private_detail: Mapped[str] = mapped_column(Text, default="")  # found only, admin/finder eyes only
    category: Mapped[str | None] = mapped_column(String(40), index=True)
    colors: Mapped[list] = mapped_column(JSONType, default=list)
    brand: Mapped[str | None] = mapped_column(String(40))
    locations: Mapped[list] = mapped_column(JSONType, default=list)
    location_note: Mapped[str] = mapped_column(String(200), default="")
    time_from: Mapped[datetime] = mapped_column(UTCDateTime)
    time_to: Mapped[datetime | None] = mapped_column(UTCDateTime)
    holding: Mapped[str | None] = mapped_column(String(20))  # front_desk | with_finder | other
    holding_note: Mapped[str] = mapped_column(String(200), default="")
    photos: Mapped[list] = mapped_column(JSONType, default=list)
    attrs: Mapped[dict] = mapped_column(JSONType, default=dict)
    emb_text: Mapped[bytes | None] = mapped_column(LargeBinary)
    emb_detail: Mapped[bytes | None] = mapped_column(LargeBinary)
    emb_model: Mapped[str | None] = mapped_column(String(60))
    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), index=True)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    returned_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    reporter: Mapped[Profile] = relationship(lazy="joined")


class Match(Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("lost_id", "found_id", name="uq_match_pair"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    lost_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    found_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    probability: Mapped[float] = mapped_column(Float)
    logit: Mapped[float] = mapped_column(Float)
    band: Mapped[str] = mapped_column(String(10))
    contributions: Mapped[dict] = mapped_column(JSONType, default=dict)
    reasons: Mapped[list] = mapped_column(JSONType, default=list)
    model_version: Mapped[str] = mapped_column(String(60))
    feedback: Mapped[str | None] = mapped_column(String(10))  # confirmed | rejected
    feedback_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    found_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"), index=True)
    lost_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("items.id", ondelete="SET NULL"))
    claimant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("profiles.id"), index=True)
    proof: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)
    review_note: Mapped[str] = mapped_column(Text, default="")
    reviewer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("profiles.id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    claimant: Mapped[Profile] = relationship(foreign_keys=[claimant_id], lazy="joined")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    action: Mapped[str] = mapped_column(String(40))
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
