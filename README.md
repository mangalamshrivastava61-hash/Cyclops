# ORACLE

Decision intelligence for a retail planner: forecast the next weeks, recommend the order, show the
evidence behind it, and let a person approve, change or reject it.

```
oracle-app/
  frontend/   Next.js 16 · React 19 · Three.js — the ten ORACLE pages
  backend/    FastAPI · SQLAlchemy · SQLite — records, decisions, ledger, grounded answers
```

> **Simulated data, no ML yet.** Every record is synthetic (Synthetic Store 03, Footwear, week 39).
> The backend serves stored forecasts through a provider interface; the ML model plugs in there later
> (see [Where ML plugs in](#where-ml-plugs-in)).

## Run it

You need **Python 3.11+** and **Node 20+**. Use two terminals.

**1 · Backend** (http://localhost:8000, interactive docs at http://localhost:8000/docs)

```bash
cd backend
python -m venv .venv
# macOS / Linux:  source .venv/bin/activate
# Windows:        .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The first start creates `backend/oracle.db` and loads the synthetic records.

**2 · Frontend** (http://localhost:3000)

```bash
cd frontend
npm install
npm run dev
```

The frontend calls the API at `http://localhost:8000` (change it with `ORACLE_API_URL`, see
`frontend/.env.example`). If the API is down, the app shows a page telling you to start it.

## How the two connect

```
browser ──▶ Next.js (frontend) ──▶ FastAPI (backend) ──▶ SQLite
              │  server components fetch ORACLE_API_URL directly
              └─ browser calls same-origin /api/*, which Next rewrites to the backend (no CORS needed)
```

* **Reads.** Every page is rendered on request from the API (`frontend/src/lib/api/client.ts`).
  The root layout loads the shared state once (`GET /api/state`): the world, what the planner did
  with each decision, the simulation switches and effective authority.
* **Writes.** Approve, modify, reject, notes and simulation switches are API calls. The backend
  validates them (e.g. a decision can only be acted on once; benched SKUs can't be approved), writes
  the action and a hash-chained ledger entry in one transaction, and returns both. The frontend
  updates its store from the response and refreshes server-rendered data.
* **Reset.** *Index → Reset the simulation* calls `POST /api/simulation/reset`, which reloads the
  synthetic world.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/health` | Status, database, forecast provider, record counts |
| GET | `/api/state` | Shared state every page starts from |
| GET | `/api/world` | The synthetic calendar, store and planner |
| GET | `/api/decisions` | This week's decisions with their current status |
| GET | `/api/decisions/{id}` | Decision + product + forecast + evidence + authority + policy inputs |
| POST | `/api/decisions/{id}/approve` | Approve (or acknowledge advice) |
| POST | `/api/decisions/{id}/modify` | `{ quantity, reason, note }` |
| POST | `/api/decisions/{id}/reject` | `{ reason }` — the fallback rule orders instead |
| POST | `/api/decisions/{id}/scenario` | Re-solve the order under stress `{ stress: { leadTime: 2 } }` |
| GET | `/api/ledger` · `/api/ledger/{id}` | Entries with live status chips and receipts |
| GET | `/api/ledger/verify` | Check the hash chain |
| POST | `/api/ledger/notes` | Append a note (supplier check, proposed experiment) |
| GET / PUT | `/api/simulation` | Simulated circuit state, probe preview |
| POST | `/api/simulation/reset` | Restore the synthetic world |
| GET | `/api/evidence/{decisionId}` | Evidence grades |
| GET | `/api/authority/levels` · `/api/authority/{sku}` · `/api/authority/{sku}/effective` | Earned authority |
| GET | `/api/circuit` | Decision circuit signals and states |
| GET | `/api/products` · `/api/forecasts/{id}` · `/api/replays/{id}` · `/api/scenarios/presets` | Other records |
| POST | `/api/ask` | `{ question }` → an answer that cites the records it used |

Field names are camelCase on the wire and match `frontend/src/types/index.ts`.

## Where ML plugs in

Nothing in the backend is machine learning today:

| Piece | Today | Later |
| --- | --- | --- |
| **Forecast** — `backend/app/services/forecast.py` | `StoredForecastProvider` returns the stored synthetic forecast | Implement `ForecastProvider.forecast_for()` with your model (e.g. an Azure ML endpoint or a model trained in a Fabric notebook) and register it with `set_forecast_provider()` |
| **Order** — `backend/app/services/policy.py` | Deterministic newsvendor policy (target − on hand − on order) | Unchanged: it consumes whatever forecast the provider returns |
| **Ask ORACLE** — `backend/app/services/ask.py` | Rule-based intents over records, with citations | Swap in a retrieval-backed language model with the same request/response shape |

Because every page reads forecasts through the provider, switching to a real model changes no
endpoint and no frontend code.

## Checks

```bash
cd backend  && pytest                  # 25 API and policy tests
cd frontend && npm run typecheck && npm run lint && npm run verify:model && npm run build
```

`verify:model` confirms the frontend's copy of the policy (used for instant what-if sliders) gives
the same numbers as the backend: 127 units, target 249, 16% risk, 165 at +2 days lead time, flip at 5.7 days.
