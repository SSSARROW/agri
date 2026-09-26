"""Spreading a buyer commitment across the farmers who can supply it (B-51).

Pure so it can be tested without a database. Every farmer is asked for the
same share of their own capacity, which is the only split that both uses
everyone fairly and can never ask anyone for more than they can grow: if the
commitment is smaller than total capacity each farmer supplies the same
fraction of theirs, and if it's larger everyone supplies all of theirs and
the rest is reported as unallocated rather than pushed onto anybody.
"""

import uuid

# Provisional planning figures (kg of green leaf per hectare per year) used to
# turn a plot's area into an expected volume — a mid-range assumption, not
# measured data, to be replaced with an agronomist's numbers. Crops without an
# entry can't be allocated, rather than guessed at.
EXPECTED_KG_PER_HA_YEAR: dict[str, float] = {"tea": 10_000.0}


def expected_volume_kg(crop: str, area_ha: float, window_days: float) -> float | None:
    per_ha_year = EXPECTED_KG_PER_HA_YEAR.get(crop.lower())
    if per_ha_year is None:
        return None
    return area_ha * per_ha_year * (window_days / 365)


def allocate(volume_kg: float, capacities: dict[uuid.UUID, float]) -> tuple[dict[uuid.UUID, float], float]:
    """Returns ({farmer: kg}, unallocated_kg)."""
    capacities = {k: v for k, v in capacities.items() if v > 0}
    total = sum(capacities.values())
    if total <= 0:
        return {}, volume_kg
    if volume_kg >= total:
        return dict(capacities), volume_kg - total
    fraction = volume_kg / total
    return {farmer: capacity * fraction for farmer, capacity in capacities.items()}, 0.0
