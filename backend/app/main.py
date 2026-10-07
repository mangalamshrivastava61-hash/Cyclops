"""FastAPI application factory.

Run:  uvicorn app.main:app --reload --port 8000      (interactive docs at /docs)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .config import Settings, get_settings
from .db import Base, make_engine, make_sessionmaker
from .routers import ask, catalog, decisions, ledger, meta, ml_forecast, simulation
from .seed import loader
from .services import forecast
from .services.errors import Conflict, NotFound
from .services.ml_forecast import MLForecastProvider

DESCRIPTION = """
Backend for **ORACLE**, the decision-intelligence frontend for Synthetic Store 03.

* Machine Learning: Uses `best_sales_model.pkl` trained with `GradientBoostingRegressor`.
* Orders are computed by a replenishment policy (`app/services/policy.py`).
* Planner actions (approve / modify / reject) are written to an append-only, hash-chained ledger.
"""


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = make_engine(settings.database_url)
    sessionmaker = make_sessionmaker(engine)

    # Register the ML model provider as the default forecast engine
    forecast.set_forecast_provider(MLForecastProvider())

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(engine)
        if settings.seed_on_startup:
            with sessionmaker() as db:
                loader.seed_if_empty(db)
        yield
        engine.dispose()

    app = FastAPI(title="ORACLE API", version=__version__, description=DESCRIPTION, lifespan=lifespan)
    app.state.sessionmaker = sessionmaker
    app.state.engine = engine

    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(NotFound)
    async def _not_found(_: Request, exc: NotFound) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(Conflict)
    async def _conflict(_: Request, exc: Conflict) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    for module in (meta, decisions, ledger, simulation, catalog, ask, ml_forecast):
        app.include_router(module.router)
    return app


app = create_app()
