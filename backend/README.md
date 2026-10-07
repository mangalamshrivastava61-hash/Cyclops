# ORACLE API (backend)

FastAPI service behind the ORACLE frontend. It owns the records (products, forecasts, decisions,
evidence, authority, the decision circuit, replays), the planner's actions and the append-only
ledger, and answers Ask ORACLE questions from those records. **No machine learning runs here yet.**

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000              # docs: http://localhost:8000/docs
pytest                                                 # 25 tests
```

The first start creates `oracle.db` (SQLite) and seeds it from `app/seed/data/*.json`.
Settings come from `ORACLE_*` environment variables or a `.env` file (see `.env.example`):
`ORACLE_DATABASE_URL`, `ORACLE_CORS_ORIGINS`, `ORACLE_SEED_ON_STARTUP`.

## Layout

```
app/
  main.py            App factory: CORS, routers, 404/409 error mapping, seeding on startup
  config.py          Settings (pydantic-settings)
  db.py              SQLAlchemy engine and per-request session
  models.py          Tables (scalar columns + JSON for nested, read-mostly structures)
  schemas.py         The API contract (camelCase on the wire = frontend/src/types)
  repository.py      Reads and writes, returning schemas
  routers/           meta · decisions · ledger · simulation · catalog (records) · ask
  services/
    forecast.py      ForecastProvider — the ML slot (today: StoredForecastProvider)
    policy.py        Replenishment policy (newsvendor) + stress, flip point, expected cost
    decisions.py     Decision bundles; approve / modify / reject with business rules
    ledger.py        Hash-chained append, verification, notes
    presentation.py  How ledger entries read now: live status chips, meta lines, receipts
    authority.py     Effective authority: earned level, probe preview, circuit cap
    ask.py           Grounded Q&A: intent rules over records, inline citations
    scenarios.py     Break My Plan presets and the what-if endpoint
    state.py         Shared app state and simulation switches
  seed/              loader.py + data/*.json (the synthetic Store 03 world)
tests/               test_policy.py, test_api.py
```

## Rules the API enforces

* A decision is acted on once (approve, modify or reject); a second action is `409` until reset.
* Benched SKUs can't be approved, modified or rejected: the fallback rule orders.
* Markdown advice can only be acknowledged.
* A modification needs a reason code and a quantity other than ORACLE's own.
* Every action writes the action and its ledger entry in one transaction; each entry's hash covers
  its content and the previous hash (`GET /api/ledger/verify`).

## Adding the ML model

Implement `ForecastProvider` in `app/services/forecast.py`:

```python
class ModelForecastProvider:
    name = "demand model v1"

    def forecast_for(self, db, decision) -> schemas.Forecast:
        ...  # call your model; return P10/P50/P90 over the protection period, the daily curve,
             # sales history and the policy parameters (sd, goodwill, overage rate)
```

and register it at startup (`set_forecast_provider(ModelForecastProvider())` in `create_app`).
Decision pages, the policy, Break My Plan, receipts and Ask all read forecasts through the provider.

To use a server database instead of SQLite, set `ORACLE_DATABASE_URL` to any SQLAlchemy URL and
install its driver.
