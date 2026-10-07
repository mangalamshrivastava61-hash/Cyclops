"""Forecast provider: the ML slot.

Everything downstream (the policy, decision pages, Break My Plan, Ask) reads forecasts through
``get_forecast_provider()``. Today the provider returns the synthetic forecast stored in the
database; no model runs. To plug in ML, implement ``ForecastProvider`` (for example a class that
calls an Azure ML endpoint or a model trained in a Fabric notebook) and register it at startup
with ``set_forecast_provider(...)``. Nothing else has to change.
"""

from typing import Protocol

from sqlalchemy.orm import Session

from .. import models, repository, schemas
from .errors import NotFound


class ForecastProvider(Protocol):
    name: str

    def forecast_for(self, db: Session, decision: models.Decision) -> schemas.Forecast:
        """Demand forecast over the protection period for the decision's SKU (P10/P50/P90, daily curve,
        sales history and the parameters the policy needs)."""
        ...


class StoredForecastProvider:
    """No ML: serve the forecast record stored with the synthetic seed."""

    name = "stored (synthetic seed, no ML)"

    def forecast_for(self, db: Session, decision: models.Decision) -> schemas.Forecast:
        forecast = repository.get_forecast(db, decision.forecast_id)
        if forecast is None:
            raise NotFound(f"No forecast {decision.forecast_id} for decision #{decision.id}.")
        return forecast


_provider: ForecastProvider = StoredForecastProvider()


def get_forecast_provider() -> ForecastProvider:
    return _provider


def set_forecast_provider(provider: ForecastProvider) -> None:
    global _provider
    _provider = provider
