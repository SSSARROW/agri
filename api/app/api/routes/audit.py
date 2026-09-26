from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.provenance import resolve_batch_by_code
from app.core.auth import CurrentUser, require_role
from app.core.errors import AppError
from app.core.verification import Finding, load_facts, risk_level, run_rules, score_actors
from app.db.session import get_db
from app.schemas.audit import AuditFinding, AuditQueueEntry, AuditQueueOut, BatchAuditOut

router = APIRouter(prefix="/audit", tags=["audit"])


def _to_finding_out(f: Finding) -> AuditFinding:
    return AuditFinding(
        rule=f.rule,
        severity=round(f.severity, 2),
        explanation=f.explanation,
        batch_code=f.batch_code,
        plot_id=f.plot_id,
    )


@router.get("/queue", response_model=AuditQueueOut)
async def audit_queue(
    min_score: int = Query(default=1, ge=0, le=100),
    _: CurrentUser = Depends(require_role("admin", "exporter")),
    db: AsyncSession = Depends(get_db),
) -> AuditQueueOut:
    """Actors ranked by how much of their recorded activity doesn't add up
    (B-24), each with the plain-language reasons. Computed from the event log
    on request rather than by a nightly job — cheap at this scale, and it
    means a fix is reflected immediately; a job that caches this is a small
    wrapper around the same functions if that ever stops being true."""
    facts = await load_facts(db)
    ranked = [r for r in score_actors(run_rules(facts)) if r.score >= min_score]

    people = {}
    if ranked:
        rows = await db.execute(
            text("SELECT id, name, role, district FROM users WHERE id IN :ids").bindparams(
                bindparam("ids", expanding=True)
            ),
            {"ids": [str(r.user_id) for r in ranked]},
        )
        people = {row.id: row for row in rows}

    return AuditQueueOut(
        entries=[
            AuditQueueEntry(
                user_id=r.user_id,
                name=getattr(people.get(r.user_id), "name", None),
                role=getattr(people.get(r.user_id), "role", None),
                district=getattr(people.get(r.user_id), "district", None),
                score=r.score,
                level=risk_level(r.score),
                findings=[_to_finding_out(f) for f in r.findings],
            )
            for r in ranked
        ]
    )


@router.get("/batches/{batch_code}", response_model=BatchAuditOut)
async def audit_batch(
    batch_code: str,
    _: CurrentUser = Depends(require_role("admin", "exporter")),
    db: AsyncSession = Depends(get_db),
) -> BatchAuditOut:
    """Everything the rules flag about one batch: findings on the batch
    itself, plus plot-level ones (yield) for the plot it came from."""
    batch = await resolve_batch_by_code(db, batch_code)
    if batch is None:
        raise AppError(code="not_found", message="No batch found with that code.", status_code=status.HTTP_404_NOT_FOUND)
    findings = run_rules(await load_facts(db))
    relevant = [
        f for f in findings if f.batch_code == batch.code or (batch.plot_id is not None and f.plot_id == batch.plot_id)
    ]
    return BatchAuditOut(
        batch_code=batch.code,
        findings=[_to_finding_out(f) for f in sorted(relevant, key=lambda f: -f.severity)],
    )
