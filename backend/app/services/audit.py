from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from ..models import AuditLog


def log(db: Session, actor_id: uuid.UUID | None, action: str, target_type: str, target_id, **data) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, target_type=target_type, target_id=str(target_id), data=data))
