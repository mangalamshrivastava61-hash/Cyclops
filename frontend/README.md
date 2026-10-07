# ORACLE — decision interface (frontend)

A working frontend for ORACLE, a replenishment decision system for retail planners.
Direction C: *quiet interface, loud decisions.* Gold marks decisions, actions and authority only.

> **Simulated data.** Every number is synthetic (Synthetic Store 03, Footwear, week 39 of 2026).
> There is no backend; a mock service layer stands in for one.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Checks:

```bash
npm run typecheck    # next typegen + tsc --noEmit
npm run lint         # eslint (Next + React Compiler rules)
npm run verify:model # prints the policy numbers the UI relies on (127, 165, 5.7 days, …)
```

Requires Node 20+.

## Pages

| Route | Page |
| --- | --- |
| `/` | Landing: the object and its four states |
| `/control` | Control Center: this week's dominant decision, forecast and stock chart |
| `/decision/[id]` | SKU decision: approve, modify, reject, authority note (`18513`, `18509`, `18511`, `18507`, `18510`) |
| `/time-machine` | Sealed replay R-2291, revealed one day at a time (`?play=1` autoplays) |
| `/break-my-plan/[id]` | Stress the plan; the order, the flip point and the 3D object react |
| `/evidence/[id]` | Evidence grades and why authority changed (`18513`, `18507`, `18510`) |
| `/circuit` | Decision circuit: Clear / Review / Bench selector |
| `/authority/[sku]` | Earned authority ladder L0–L4 and 26-week history (`1842`) |
| `/ledger` | Append-only decision ledger with receipts (`?entry=ID` deep link) |
| `/ask` | Ask ORACLE: answers only from records, with sources (`?q=` to ask) |

Planner actions (approve, modify, reject, circuit simulation, probe preview, notes) persist in
`localStorage` and propagate everywhere: the Control Center, the ledger, authority and Ask all read
the same state. **Index → Reset the simulation** returns to the seed.

## Architecture

```
src/
  types/            Domain types (Decision, Forecast, EvidenceReport, LedgerEntry, …)
  data/             Seed records — the only place numbers are written down
  lib/services/
    repository.ts   The only module that imports src/data (synchronous reads)
    api.ts          Async facade: the boundary a real backend replaces
  lib/model/        Replenishment policy (newsvendor over the protection period) and normal math
  lib/store/        zustand store for planner actions + the appended ledger (persisted)
  lib/ask/engine.ts Grounded Q&A: intent → records → cited answer; no record, no answer
  lib/stress.ts     Break My Plan analysis and flip curve
  lib/receipt.ts    Ledger receipts rebuilt from records
  components/
    oracle-object/  The one 3D object (React Three Fiber) in its states: forecast, stress,
                    circuit (dial), authority (stack), plus the product box and Time Machine rail
    charts/         Hand-drawn SVG charts sized to the design grid
    chrome/ ui/     Header, folio, page shell, primitives
    <page>/         One folder per page
```

### Swapping in a backend

Pages read through `lib/services/repository.ts` (and its async twin `api.ts`). Replace those
functions with fetches to your API and keep the return types from `src/types`. Planner actions go
through the store in `lib/store/oracle-store.ts` (`approve`, `modify`, `reject`, `setCircuit`,
`logNote`); each returns the ledger entry it appends — point those at your write endpoints.

### The model

`lib/model/policy.ts` solves the order the way the records describe it: target position =
P50 + z(critical ratio) · σ over the 12-day protection period (5-day lead + weekly review);
order = target − on hand − on order, rounded to the case pack. Break My Plan re-solves it under
stress (demand, lead time, cost, stockout penalty, bias, shock, supplier shortfall) and finds the
lead time at which the decision flips by bisection.

### 3D

One ORACLE object (black base = P10, gold plate = the decision line, two ivory slabs = P50/P90)
takes every state as a pose, damped so motion explains change. Canvases mount only when scrolled
into view, render on demand (not every frame), pause off-screen, respect reduced motion, and fall
back to pre-rendered stills in `public/renders/` when WebGL is unavailable. Labels over the 3D
scene are ordinary DOM elements pinned to scene points (`data-anchor`), so they stay accessible.

## Responsive and accessible

Composed at 1440, then checked at 1280, 1024 and 390. Every page has one `h1`, a `main` landmark,
named controls, a visible focus ring, keyboard support (the circuit selector is a radio group with
arrow keys, sliders are native ranges, ⌘/Ctrl+K opens Ask ORACLE, Escape closes the index), and
`prefers-reduced-motion` stops the float and page transitions.

## Notes

- Charts are custom SVG rather than a chart library, to match the design's hairline drawing exactly.
- Numbers are computed by the model where the design rounded differently: "Cost +15%" gives 120
  (design: 119) and target 249 covers 84% of outcomes (design: 83%).
- The landing footer says "Designed for Microsoft Fabric" rather than "Built on": this frontend
  runs on mock data, not on Fabric.
- `three` is pinned to 0.182 — later releases log a deprecation warning from React Three Fiber.
- Fonts (Geist, Geist Mono, Instrument Serif) are bundled locally under `src/app/fonts`.
