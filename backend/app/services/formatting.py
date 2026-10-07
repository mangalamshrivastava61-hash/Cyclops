"""Text formatting shared by receipts, ledger entries and Ask answers.

The synthetic world has no time zone: ISO strings are read as wall-clock time.
Rounding follows JavaScript's Math.round (halves round up) so figures match the frontend.
"""

import math
from datetime import date, datetime

DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

REASON_LABELS = {
    "LOCAL_EVENT": "Local event",
    "SUPPLIER": "Supplier constraint",
    "PROMOTION": "Promotion",
    "SPACE": "Shelf space",
    "STRESS_TEST": "Stress test",
    "OTHER": "Other",
}


def js_round(x: float) -> int:
    """Math.round: halves round towards +∞ (Python's round() rounds halves to even)."""
    return math.floor(x + 0.5)


def _date(iso: str) -> date:
    return date.fromisoformat(iso[:10])


def day_label(iso: str) -> str:
    """'Thu 1 Oct'"""
    d = _date(iso)
    return f"{DOW[d.isoweekday() % 7]} {d.day} {MON[d.month - 1]}"


def short_date(iso: str) -> str:
    """'Oct 1'"""
    d = _date(iso)
    return f"{MON[d.month - 1]} {d.day}"


def clock(iso: str) -> str:
    """'09:42'"""
    return (iso.split("T") + ["00:00:00"])[1][:5]


def money(v: float) -> str:
    """'$11.1k' or '$320'"""
    return f"${v / 1000:.1f}k" if abs(v) >= 1000 else f"${js_round(v)}"


def signed_money(v: float) -> str:
    """'+$320', '−$20' (rounded to tens)"""
    rounded = abs(js_round(v / 10) * 10)
    return f"{'+' if v >= 0 else '−'}${rounded:,}"


def pct(v: float) -> str:
    """0.16 → '16%'"""
    return f"{js_round(v * 100)}%"


def reason_label(code: str) -> str:
    return REASON_LABELS.get(code, code[:1] + code[1:].lower().replace("_", " "))


def now_on_world_day(world_day: str) -> str:
    """Current wall-clock time, placed on the synthetic world's day."""
    return f"{world_day}T{datetime.now():%H:%M:%S}"


def lower_first(s: str) -> str:
    return s[:1].lower() + s[1:]


def join_and(items: list[str]) -> str:
    """['a', 'b', 'c'] → 'a, b and c'"""
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]
