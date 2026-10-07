# 🔮 ORACLE — Retail Decision Intelligence System

> **Seeing Next Month, Not Just Last Month**

ORACLE is an evidence-gated retail decision system designed to help retail planners make safer, data-backed inventory decisions for the next 30 days.

Instead of providing a single demand forecast, ORACLE combines **probabilistic forecasting, replenishment optimization, evidence, stress testing, and governance** to turn predictions into actionable inventory decisions.

---

## 🚀 Overview

Retail planners need to decide how much stock to order every week, but real-world retail demand is affected by:

- 📈 Changing customer demand
- 📦 Inventory levels
- 🚚 Supplier lead times
- 💰 Product prices
- 🏷️ Promotions
- ⚠️ Stockouts
- 🌪️ Supply shocks
- 📊 Uncertainty in forecasts

Traditional forecasting systems mainly answer:

> **"How much demand should we expect?"**

ORACLE goes further and asks:

> **"What should we do, why should we do it, what could go wrong, and how confident are we?"**

The system follows the decision cycle:

**Predict → Decide → Test → Measure → Govern**

---

## 🎯 Problem Statement

### Seeing Next Month, Not Just Last Month

Retail planners often make hundreds of SKU-level decisions every week.

However:

- Demand is uncertain.
- Stockouts can hide the true demand for a product.
- Lead times affect replenishment decisions.
- Promotions and pricing can change demand.
- A single forecast value does not represent uncertainty.
- Forecasting alone does not determine the safest business action.

ORACLE addresses this gap by connecting **prediction directly to decision-making**.

---

## 💡 Our Solution

ORACLE is an evidence-gated retail decision system that provides:

### 1. Probabilistic Demand Forecasting

Instead of producing only one forecast value, ORACLE generates:

- **P10** — Lower-demand scenario
- **P50** — Expected/central scenario
- **P90** — Higher-demand scenario

This allows planners to understand the range of possible demand.

---

### 2. Replenishment Optimization

The system uses factors such as:

- Inventory
- Lead time
- Cost
- Demand forecast
- Stockout risk

to generate an optimized replenishment recommendation.

---

### 3. Decision Ledger

Every decision and its outcome can be recorded in an auditable **Decision Ledger**.

This provides a history of:

- What decision was made
- Why it was made
- What evidence supported it
- What happened afterward

---

### 4. Break My Plan

ORACLE includes a stress-testing capability called **Break My Plan**.

It challenges the recommended plan by testing different conditions and identifying **flip points** where a decision may no longer be optimal.

---

### 5. Circuit Breaker

The system includes a governance mechanism that reduces decision authority when the available evidence becomes weak or unreliable.

This helps prevent the system from making overly confident decisions when conditions deteriorate.

---

### 6. Earned Autonomy

ORACLE is designed around controlled autonomy.

The system can gain or lose decision authority depending on the quality and reliability of its evidence.

---

## 🔄 ORACLE Decision Pipeline

```text
Sales
  +
Stock
  +
Prices
  +
Orders
  +
Promotions
       │
       ▼
Data Quality & Observability
       │
       ▼
P10 / P50 / P90 Forecast
       │
       ▼
Replenishment Optimizer
       │
       ▼
Order Recommendation
       │
       ├── Evidence
       └── Risk
              │
              ▼
       Decision Ledger
              │
              ▼
        Governance
