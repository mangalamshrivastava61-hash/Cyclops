"""Scenario presets for Break My Plan and server-side what-if runs."""

import json
from functools import lru_cache
from pathlib import Path

from .. import schemas
from . import policy
from .decisions import Bundle

_PRESETS = Path(__file__).resolve().parent.parent / "seed" / "data" / "scenarios.json"

#: Search ranges for the flip point of each stress.
RANGES = {"demand": (0.0, 0.6), "leadTime": (0.0, 6.0), "cost": (-0.1, 0.4), "penalty": (1.0, 4.0), "bias": (-0.2, 0.2), "shock": (0.0, 80.0), "shortfall": (0.0, 0.5)}


@lru_cache
def presets() -> schemas.ScenarioPresets:
    return schemas.ScenarioPresets.model_validate(json.loads(_PRESETS.read_text()))


def run(bundle: Bundle, overrides: dict[str, float]) -> schemas.ScenarioResponse:
    s = policy.stress(**overrides)
    keep = bundle.decision.recommended_order
    result = policy.solve(bundle.policy, s, keep)
    flip = policy.flip_point(bundle.policy, {**s, "leadTime": 0.0}, "leadTime", keep, *RANGES["leadTime"])
    return schemas.ScenarioResponse(
        decision_id=bundle.decision.id,
        keep=keep,
        stress=s,
        result=result.as_schema(),
        flip_lead_time=None if flip is None or flip <= 0 else bundle.product.lead_time_days + flip,
    )
