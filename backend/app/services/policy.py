"""The replenishment policy: the decision engine behind every order (deterministic, not ML).

A base-stock (newsvendor) rule over the protection period (lead time + review cycle):

    target = mean + z(CR) · sd,    CR = cu / (cu + co)
    order  = target − on hand − on order

cu = margin + goodwill of a lost sale, co = holding + markdown cost of a leftover pair.
The forecast (mean, sd) comes from the forecast provider; today that is the stored synthetic
forecast, later the ML model. With the SKU 1842 record this gives 127 units, target 249 and a
16% stockout risk. The frontend keeps an identical copy for instant what-if sliders.
"""

import math
from dataclasses import dataclass

from .. import schemas
from .formatting import js_round
from .normal import cdf, loss, ppf

Stress = dict[str, float]

STRESS_KEYS = ("demand", "leadTime", "cost", "penalty", "bias", "shock", "shortfall")
#: No stress applied. ``penalty`` is a multiplier; the rest are offsets.
NEUTRAL: Stress = {"demand": 0.0, "leadTime": 0.0, "cost": 0.0, "penalty": 1.0, "bias": 0.0, "shock": 0.0, "shortfall": 0.0}


@dataclass(frozen=True)
class PolicyInput:
    mean: float  # P50 over the horizon
    horizon: float  # days = lead time + review cycle
    sd: float
    goodwill: float
    overage_rate: float
    daily_beyond: float
    price: float
    unit_cost: float
    on_hand: float
    on_order: float

    def as_schema(self) -> schemas.PolicyInput:
        return schemas.PolicyInput(**self.__dict__)


@dataclass(frozen=True)
class Result:
    order: int
    target: int
    mean: float
    sd: float
    critical_ratio: float
    risk_if_keep: float
    risk_at_order: float
    changed: bool
    delta: int

    def as_schema(self) -> schemas.ScenarioResult:
        return schemas.ScenarioResult(**self.__dict__)


def stress(**overrides: float) -> Stress:
    unknown = set(overrides) - set(STRESS_KEYS)
    if unknown:
        raise ValueError(f"unknown stress keys: {sorted(unknown)}")
    return {**NEUTRAL, **overrides}


def policy_input(decision: schemas.Decision, forecast: schemas.Forecast, product: schemas.Product) -> PolicyInput:
    return PolicyInput(
        mean=forecast.p50,
        horizon=forecast.horizon_days,
        sd=forecast.policy.sd,
        goodwill=forecast.policy.goodwill,
        overage_rate=forecast.policy.overage_rate,
        daily_beyond=forecast.policy.daily_beyond_horizon,
        price=product.price,
        unit_cost=product.unit_cost,
        on_hand=decision.on_hand,
        on_order=decision.on_order,
    )


def demand_over(p: PolicyInput, s: Stress = NEUTRAL) -> tuple[float, float]:
    """Mean and sd of demand over the (possibly stressed) protection period."""
    period = p.horizon + s["leadTime"]
    mean = p.mean * period / p.horizon if period <= p.horizon else p.mean + p.daily_beyond * (period - p.horizon)
    sd = p.sd * math.sqrt(period / p.horizon)
    mean *= (1 + s["demand"]) * (1 + s["bias"])
    sd *= 1 + s["demand"]
    if s["shock"] > 0:
        mean += s["shock"]
        sd = math.sqrt(sd * sd + (0.5 * s["shock"]) ** 2)
    return mean, sd


def critical_ratio(p: PolicyInput, s: Stress = NEUTRAL) -> tuple[float, float, float]:
    """(CR, cost of a lost sale, cost of a leftover)."""
    cost = p.unit_cost * (1 + s["cost"])
    cu = p.price - cost + p.goodwill * s["penalty"]
    co = p.overage_rate * cost
    return cu / (cu + co), cu, co


def _arriving(units: float, s: Stress) -> float:
    """Units that actually arrive when the supplier ships short."""
    return units * (1 - s["shortfall"])


def position(p: PolicyInput, order: float, s: Stress = NEUTRAL) -> float:
    return p.on_hand + _arriving(p.on_order + order, s)


def stockout_risk(p: PolicyInput, order: float, s: Stress = NEUTRAL) -> float:
    mean, sd = demand_over(p, s)
    return 1 - cdf((position(p, order, s) - mean) / sd)


def solve(p: PolicyInput, s: Stress = NEUTRAL, keep: float | None = None) -> Result:
    mean, sd = demand_over(p, s)
    cr, _, _ = critical_ratio(p, s)
    target = js_round(mean + ppf(cr) * sd)
    need = (target - p.on_hand - _arriving(p.on_order, s)) / (1 - s["shortfall"])
    order = max(0, js_round(need))
    base = order if keep is None else keep
    return Result(
        order=order,
        target=target,
        mean=mean,
        sd=sd,
        critical_ratio=cr,
        risk_if_keep=stockout_risk(p, base, s),
        risk_at_order=stockout_risk(p, order, s),
        changed=abs(order - base) > 0.1 * max(base, 1),
        delta=int(order - base),
    )


def expected_cost(p: PolicyInput, order: float, s: Stress = NEUTRAL) -> float:
    """Expected cost of shortage plus leftovers (normal loss function)."""
    mean, sd = demand_over(p, s)
    _, cu, co = critical_ratio(p, s)
    y = position(p, order, s)
    short = sd * loss((y - mean) / sd)
    over = y - mean + short
    return cu * short + co * over


def contribution_for(p: PolicyInput, order: float, anchor_order: float, anchor_contribution: float) -> float:
    """Expected contribution for ``order``, anchored on the record's figure for the recommended order."""
    return anchor_contribution + expected_cost(p, anchor_order) - expected_cost(p, order)


def flip_point(p: PolicyInput, s: Stress, key: str, keep: float, lo: float, hi: float) -> float | None:
    """Smallest value of one stress (others fixed) at which the best order leaves the ±10% band around
    ``keep``. Uses the continuous target so the answer is not a rounding artefact. None if it never flips."""

    def changed(v: float) -> bool:
        t = {**s, key: v}
        mean, sd = demand_over(p, t)
        cr, _, _ = critical_ratio(p, t)
        target = mean + ppf(cr) * sd
        order = (target - p.on_hand - _arriving(p.on_order, t)) / (1 - t["shortfall"])
        return abs(order - keep) > 0.1 * keep

    if changed(lo):
        return lo
    if not changed(hi):
        return None
    for _ in range(40):
        mid = (lo + hi) / 2
        if changed(mid):
            hi = mid
        else:
            lo = mid
    return hi
