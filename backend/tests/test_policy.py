"""The policy must reproduce the numbers the decision records and the frontend show."""

import pytest

from app.services import policy
from app.services.normal import cdf, ppf

P = policy.PolicyInput(mean=212, horizon=12, sd=37.2, goodwill=15.7, overage_rate=0.1626, daily_beyond=17.5, price=140, unit_cost=84, on_hand=82, on_order=40)


def test_normal_helpers_are_inverse():
    for p in (0.05, 0.5, 0.84, 0.99):
        assert cdf(ppf(p)) == pytest.approx(p, abs=1e-6)


def test_order_127_target_249_risk_16():
    r = policy.solve(P, keep=127)
    assert (r.order, r.target) == (127, 249)
    assert round(policy.stockout_risk(P, 127) * 100) == 16


def test_lead_time_plus_two_days_moves_the_order_to_165():
    r = policy.solve(P, policy.stress(leadTime=2), keep=127)
    assert r.order == 165 and r.changed
    assert round(r.risk_if_keep * 100) == 48


@pytest.mark.parametrize(("key", "value", "order"), [("demand", 0.25, 189), ("leadTime", 3, 184), ("cost", 0.15, 120), ("penalty", 2, 131), ("shortfall", 0.2, 169)])
def test_single_stresses(key, value, order):
    assert policy.solve(P, policy.stress(**{key: value}), keep=127).order == order


def test_flip_point_is_5_7_days():
    flip = policy.flip_point(P, policy.NEUTRAL, "leadTime", 127, 0, 6)
    assert 5 + flip == pytest.approx(5.67, abs=0.01)


def test_unknown_stress_is_rejected():
    with pytest.raises(ValueError):
        policy.stress(weather=1)


def test_policy_reproduces_every_seeded_order(client):
    for summary in client.get("/api/decisions").json():
        if summary["action"] != "order":
            continue
        b = client.get(f"/api/decisions/{summary['id']}").json()
        p = policy.PolicyInput(**{k: b["policy"][c] for k, c in [("mean", "mean"), ("horizon", "horizon"), ("sd", "sd"), ("goodwill", "goodwill"), ("overage_rate", "overageRate"), ("daily_beyond", "dailyBeyond"), ("price", "price"), ("unit_cost", "unitCost"), ("on_hand", "onHand"), ("on_order", "onOrder")]})
        assert policy.solve(p).order == b["decision"]["recommendedOrder"], summary["id"]
