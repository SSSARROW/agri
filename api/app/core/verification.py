"""Verification rules (B-23) and per-actor risk scoring (B-24).

Everything here is self-reported evidence, so the point isn't to prove fraud
— it's to surface the records that don't add up, with a plain-language reason
an auditor can act on. Each rule returns a Finding only when something looks
wrong; a rule that lacks the data to decide (no recorded weight, too few
peers) says nothing rather than passing or failing, so missing data never
counts against anyone.

The rules are pure functions over plain dataclasses so they can be tested
without a database; load_facts (bottom of the file) builds them from the
event log.
"""

from __future__ import annotations

import statistics
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

# Output may exceed input by this much before it's flagged — scale error and
# leaf moisture differences between two weighings are normal.
MASS_BALANCE_TOLERANCE = 0.02
# Losing more than this between input and output at a plain merge (no
# processing step) is unusual enough to mention, though it can be innocent.
MASS_BALANCE_MAX_LOSS = 0.35

# Kilograms per hectare per year a plot can plausibly produce. Provisional:
# a deliberately generous cap for green leaf, set above the yields of the
# best-managed estates so it only trips on the impossible — replace with a
# figure from an agronomist before treating a flag as more than a prompt to
# look. Crops with no entry are simply not checked.
YIELD_CEILING_KG_PER_HA_YEAR: dict[str, float] = {"tea": 25_000.0}
YIELD_WINDOW = timedelta(days=365)

# Offline capture legitimately lags by days, even weeks in a dead-signal
# area (see M-07) — only lags well beyond that suggest backdating.
RECORDING_LAG_THRESHOLD = timedelta(days=21)

PEER_MIN_COUNT = 5
PEER_Z_THRESHOLD = 2.5

# How much each rule can add to an actor's 0-100 risk score at full severity.
RULE_WEIGHTS: dict[str, float] = {
    "mass_balance": 45,
    "yield_ceiling": 35,
    "sequence": 30,
    "peer_zscore": 25,
    "recording_lag": 15,
}
_EXTRA_FINDING_POINTS = 2


@dataclass(frozen=True)
class EventFact:
    id: uuid.UUID
    event_type: str
    user_id: uuid.UUID | None
    batch_id: uuid.UUID | None
    plot_id: uuid.UUID | None
    weight_kg: float | None
    occurred_at: datetime
    recorded_at: datetime


@dataclass(frozen=True)
class BatchFact:
    id: uuid.UUID
    code: str
    crop: str
    plot_id: uuid.UUID | None
    parent_ids: tuple[uuid.UUID, ...]


@dataclass(frozen=True)
class PlotFact:
    id: uuid.UUID
    owner_user_id: uuid.UUID | None
    area_ha: float | None
    gn_division: str | None
    district: str | None


@dataclass
class Facts:
    events: list[EventFact]
    batches: list[BatchFact]
    plots: list[PlotFact]
    now: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class Finding:
    rule: str
    user_id: uuid.UUID | None
    severity: float  # 0..1
    explanation: str
    batch_code: str | None = None
    plot_id: uuid.UUID | None = None


def _latest_weigh_events(events: list[EventFact]) -> dict[uuid.UUID, EventFact]:
    """The most recent recorded weight per batch — the farmer's own weighing
    and a collector's are the same kind of event, and the later one is the
    better statement of what the batch weighs now."""
    latest: dict[uuid.UUID, EventFact] = {}
    for e in events:
        if e.event_type != "weigh" or e.weight_kg is None or e.batch_id is None:
            continue
        current = latest.get(e.batch_id)
        if current is None or e.occurred_at > current.occurred_at:
            latest[e.batch_id] = e
    return latest


def _plot_yields(facts: Facts) -> dict[tuple[uuid.UUID, str], float]:
    """kg per hectare harvested from each (plot, crop) within the trailing
    year — the shared input to the ceiling and peer rules."""
    plots = {p.id: p for p in facts.plots}
    latest = _latest_weigh_events(facts.events)
    cutoff = facts.now - YIELD_WINDOW
    kg: dict[tuple[uuid.UUID, str], float] = defaultdict(float)
    for batch in facts.batches:
        weigh = latest.get(batch.id)
        if weigh is None or batch.plot_id is None or weigh.occurred_at < cutoff:
            continue
        kg[(batch.plot_id, batch.crop.lower())] += weigh.weight_kg  # type: ignore[operator]
    yields = {}
    for (plot_id, crop), total in kg.items():
        plot = plots.get(plot_id)
        if plot is not None and plot.area_ha and plot.area_ha > 0:
            yields[(plot_id, crop)] = total / plot.area_ha
    return yields


def check_mass_balance(facts: Facts) -> list[Finding]:
    """A merged batch can't hold more than went into it, and shouldn't quietly
    lose a large share either. Attributed to whoever recorded the outgoing
    weight, since a batch has no recorded creator of its own."""
    weigh_events = _latest_weigh_events(facts.events)
    batches = {b.id: b for b in facts.batches}
    findings = []
    for batch in facts.batches:
        if not batch.parent_ids:
            continue
        out_event = weigh_events.get(batch.id)
        parent_events = [weigh_events.get(pid) for pid in batch.parent_ids]
        if out_event is None or any(p is None for p in parent_events):
            continue  # can't balance without every weight
        weight_in = sum(p.weight_kg for p in parent_events)  # type: ignore[union-attr]
        weight_out = out_event.weight_kg
        if weight_in <= 0 or weight_out is None:
            continue
        parents = ", ".join(batches[pid].code for pid in batch.parent_ids if pid in batches)
        if weight_out > weight_in * (1 + MASS_BALANCE_TOLERANCE):
            excess = (weight_out - weight_in) / weight_in
            findings.append(
                Finding(
                    rule="mass_balance",
                    user_id=out_event.user_id,
                    severity=min(1.0, 0.5 + excess),
                    batch_code=batch.code,
                    explanation=(
                        f"Batch {batch.code} was weighed at {weight_out:g} kg but only "
                        f"{weight_in:g} kg went into it (from {parents}) — {excess:.0%} more than it can contain."
                    ),
                )
            )
        elif weight_out < weight_in * (1 - MASS_BALANCE_MAX_LOSS):
            loss = (weight_in - weight_out) / weight_in
            findings.append(
                Finding(
                    rule="mass_balance",
                    user_id=out_event.user_id,
                    severity=0.3,
                    batch_code=batch.code,
                    explanation=(
                        f"Batch {batch.code} came out at {weight_out:g} kg from {weight_in:g} kg in "
                        f"(from {parents}) — {loss:.0%} unaccounted for."
                    ),
                )
            )
    return findings


def check_yield_ceiling(facts: Facts) -> list[Finding]:
    plots = {p.id: p for p in facts.plots}
    findings = []
    for (plot_id, crop), per_ha in _plot_yields(facts).items():
        ceiling = YIELD_CEILING_KG_PER_HA_YEAR.get(crop)
        if ceiling is None or per_ha <= ceiling:
            continue
        plot = plots[plot_id]
        findings.append(
            Finding(
                rule="yield_ceiling",
                user_id=plot.owner_user_id,
                plot_id=plot_id,
                severity=min(1.0, 0.5 + (per_ha / ceiling - 1)),
                explanation=(
                    f"A {plot.area_ha:g} ha {crop} plot in {plot.gn_division or plot.district or 'an unrecorded area'} "
                    f"reports {per_ha:,.0f} kg/ha in a year — above the {ceiling:,.0f} kg/ha ceiling."
                ),
            )
        )
    return findings


def check_sequence(facts: Facts) -> list[Finding]:
    """Events that can't have happened in the order recorded: a harvest weighed
    before the plot was ever recorded as planted, or an event dated in the
    future."""
    batches = {b.id: b for b in facts.batches}
    first_planted: dict[uuid.UUID, datetime] = {}
    for e in facts.events:
        if e.event_type == "planted" and e.plot_id is not None:
            current = first_planted.get(e.plot_id)
            if current is None or e.occurred_at < current:
                first_planted[e.plot_id] = e.occurred_at

    findings = []
    for e in facts.events:
        batch = batches.get(e.batch_id) if e.batch_id else None
        if e.occurred_at > facts.now + timedelta(days=1):
            findings.append(
                Finding(
                    rule="sequence",
                    user_id=e.user_id,
                    severity=0.6,
                    batch_code=batch.code if batch else None,
                    explanation=f"A {e.event_type} event is dated {e.occurred_at:%d %b %Y}, in the future.",
                )
            )
        if e.event_type == "weigh" and batch is not None and batch.plot_id in first_planted:
            planted_at = first_planted[batch.plot_id]
            if e.occurred_at < planted_at:
                findings.append(
                    Finding(
                        rule="sequence",
                        user_id=e.user_id,
                        severity=0.8,
                        batch_code=batch.code,
                        explanation=(
                            f"Batch {batch.code} was weighed on {e.occurred_at:%d %b %Y}, before its plot "
                            f"was recorded as planted on {planted_at:%d %b %Y}."
                        ),
                    )
                )
    return findings


def check_recording_lag(facts: Facts) -> list[Finding]:
    """One finding per actor, not per event — a farmer who habitually logs
    things weeks late has one pattern, not thirty problems."""
    per_user: dict[uuid.UUID, list[timedelta]] = defaultdict(list)
    lagging: dict[uuid.UUID, list[timedelta]] = defaultdict(list)
    for e in facts.events:
        if e.user_id is None or e.event_type == "scan":
            continue
        lag = e.recorded_at - e.occurred_at
        per_user[e.user_id].append(lag)
        if lag > RECORDING_LAG_THRESHOLD:
            lagging[e.user_id].append(lag)

    findings = []
    for user_id, lags in lagging.items():
        longest = max(lags).days
        findings.append(
            Finding(
                rule="recording_lag",
                user_id=user_id,
                severity=min(1.0, 0.3 + longest / 180),
                explanation=(
                    f"{len(lags)} of {len(per_user[user_id])} recorded events were logged more than "
                    f"{RECORDING_LAG_THRESHOLD.days} days after they happened (longest {longest} days) — "
                    f"possibly backdated."
                ),
            )
        )
    return findings


def check_peer_zscore(facts: Facts) -> list[Finding]:
    """A plot whose yield sits far above the other plots in its own area. The
    plot is left out of its own comparison group so an outlier can't inflate
    the spread it's being measured against."""
    plots = {p.id: p for p in facts.plots}
    groups: dict[tuple[str, str], list[tuple[uuid.UUID, float]]] = defaultdict(list)
    for (plot_id, crop), per_ha in _plot_yields(facts).items():
        plot = plots[plot_id]
        area = plot.gn_division or plot.district
        if area is None:
            continue
        groups[(area, crop)].append((plot_id, per_ha))

    findings = []
    for (area, crop), members in groups.items():
        for plot_id, per_ha in members:
            peers = [y for pid, y in members if pid != plot_id]
            if len(peers) < PEER_MIN_COUNT:
                continue
            spread = statistics.pstdev(peers)
            if spread == 0:
                continue
            mean = statistics.fmean(peers)
            z = (per_ha - mean) / spread
            if z < PEER_Z_THRESHOLD:
                continue
            findings.append(
                Finding(
                    rule="peer_zscore",
                    user_id=plots[plot_id].owner_user_id,
                    plot_id=plot_id,
                    severity=min(1.0, 0.4 + (z - PEER_Z_THRESHOLD) * 0.2),
                    explanation=(
                        f"A {crop} plot in {area} yields {per_ha:,.0f} kg/ha — "
                        f"{'over 10' if z > 10 else f'{z:.1f}'} standard deviations "
                        f"above the {len(peers)} other plots there (average {mean:,.0f} kg/ha)."
                    ),
                )
            )
    return findings


RULES = (check_mass_balance, check_yield_ceiling, check_sequence, check_recording_lag, check_peer_zscore)


def run_rules(facts: Facts) -> list[Finding]:
    return [f for rule in RULES for f in rule(facts)]


@dataclass(frozen=True)
class ActorRisk:
    user_id: uuid.UUID
    score: int
    findings: list[Finding]


def risk_level(score: int) -> str:
    return "high" if score >= 60 else "medium" if score >= 30 else "low"


def score_actors(findings: list[Finding]) -> list[ActorRisk]:
    """0-100 per actor, highest first. Each rule contributes its weight times
    the worst severity found for that rule, plus a couple of points per
    further finding — so one serious problem outranks many trivial ones, but
    a pile of them still moves the needle. Findings with no attributable
    actor are ignored (there's nobody to queue them under)."""
    by_user: dict[uuid.UUID, list[Finding]] = defaultdict(list)
    for f in findings:
        if f.user_id is not None:
            by_user[f.user_id].append(f)

    ranked = []
    for user_id, user_findings in by_user.items():
        worst: dict[str, float] = defaultdict(float)
        for f in user_findings:
            worst[f.rule] = max(worst[f.rule], f.severity)
        raw = sum(RULE_WEIGHTS[rule] * sev for rule, sev in worst.items())
        raw += _EXTRA_FINDING_POINTS * (len(user_findings) - len(worst))
        ranked.append(
            ActorRisk(
                user_id=user_id,
                score=min(100, round(raw)),
                findings=sorted(user_findings, key=lambda f: -f.severity),
            )
        )
    return sorted(ranked, key=lambda r: -r.score)


async def load_facts(db) -> Facts:
    """Builds Facts from the event log. Loads everything — fine at this scale;
    windowing to a trailing period is the obvious first step once the log is
    large."""
    from sqlalchemy import select

    from app.db.models import Batch, Event, Plot

    def weight(payload: dict) -> float | None:
        try:
            return float(payload["weight_kg"])
        except (KeyError, TypeError, ValueError):
            return None

    events = [
        EventFact(
            id=e.id,
            event_type=e.event_type,
            user_id=e.user_id,
            batch_id=e.batch_id,
            plot_id=e.plot_id,
            weight_kg=weight(e.payload) if e.event_type == "weigh" else None,
            occurred_at=e.occurred_at,
            recorded_at=e.recorded_at,
        )
        for e in (await db.execute(select(Event))).scalars().all()
    ]
    batches = [
        BatchFact(
            id=b.id,
            code=b.code,
            crop=b.crop,
            plot_id=b.plot_id,
            parent_ids=tuple(b.parent_batch_ids or ()),
        )
        for b in (await db.execute(select(Batch))).scalars().all()
    ]
    plots = [
        PlotFact(
            id=p.id,
            owner_user_id=p.owner_user_id,
            area_ha=float(p.area_ha) if p.area_ha is not None else None,
            gn_division=p.gn_division,
            district=p.district,
        )
        for p in (await db.execute(select(Plot))).scalars().all()
    ]
    return Facts(events=events, batches=batches, plots=plots)
