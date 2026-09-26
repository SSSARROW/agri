"""A deliberately falsified data set run through the verification rules —
for showing what the audit queue catches without writing anything to the
database (the event log is append-only, so demo events could never be
cleaned up afterwards).

    python -m app.audit_demo
"""

import uuid
from datetime import datetime, timedelta, timezone

from app.core.verification import (
    BatchFact,
    EventFact,
    Facts,
    PlotFact,
    risk_level,
    run_rules,
    score_actors,
)


def build_demo_facts() -> tuple[Facts, dict[uuid.UUID, str]]:
    now = datetime.now(timezone.utc)
    names: dict[uuid.UUID, str] = {}
    plots, batches, events = [], [], []

    def person(name: str) -> uuid.UUID:
        uid = uuid.uuid4()
        names[uid] = name
        return uid

    def harvest(owner, area, kg, *, gn="Kandapola", weighed_days_ago=30, logged_days_late=0, planted_days_ago=200):
        plot = PlotFact(uuid.uuid4(), owner, area, gn, "Nuwara Eliya")
        batch = BatchFact(uuid.uuid4(), f"DEMO-{len(batches) + 1:02d}", "Tea", plot.id, ())
        plots.append(plot)
        batches.append(batch)
        planted = now - timedelta(days=planted_days_ago)
        events.append(EventFact(uuid.uuid4(), "planted", owner, None, plot.id, None, planted, planted))
        weighed = now - timedelta(days=weighed_days_ago)
        events.append(
            EventFact(
                uuid.uuid4(), "weigh", owner, batch.id, plot.id, kg, weighed, weighed + timedelta(days=logged_days_late)
            )
        )
        return batch

    honest = [person(n) for n in ("Nimal", "Kamala", "Saman", "Priya", "Ruwan", "Dilani", "Chaminda")]
    honest_batches = [harvest(owner, 1.0, 850 + i * 30) for i, owner in enumerate(honest)]

    cheat = person("Suresh (falsified)")
    harvest(cheat, 0.4, 15_000, logged_days_late=45)  # ~37,500 kg/ha, logged 45 days late
    harvest(cheat, 1.0, 40, weighed_days_ago=300)  # weighed before it was planted

    collector = person("Anura (collector)")

    def merged(code: str, parents, kg: float) -> None:
        batch = BatchFact(uuid.uuid4(), code, "Tea", None, tuple(p.id for p in parents))
        batches.append(batch)
        events.append(EventFact(uuid.uuid4(), "weigh", collector, batch.id, None, kg, now, now))

    parents = honest_batches[:2]
    input_kg = sum(850 + i * 30 for i in range(2))
    merged("DEMO-MERGE-HONEST", parents, input_kg * 0.97)  # normal shrink: not flagged
    merged("DEMO-MERGE-FALSIFIED", parents, input_kg * 1.4)  # more out than went in

    return Facts(events=events, batches=batches, plots=plots, now=now), names


def main() -> None:
    facts, names = build_demo_facts()
    for entry in score_actors(run_rules(facts)):
        print(f"\n{names[entry.user_id]}: risk {entry.score}/100 ({risk_level(entry.score)})")
        for f in entry.findings:
            print(f"  [{f.rule}] {f.explanation}")


if __name__ == "__main__":
    main()
