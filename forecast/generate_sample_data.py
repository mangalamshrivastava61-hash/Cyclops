"""
Generate a realistic multi-product monthly sales dataset.

Creates 'sales_data.csv' with columns:
  date, product_id, product_name, category, units_sold, price, discount_pct,
  promotion

Run once to create sample data, then feed 'sales_data.csv' into
sales_demand_forecast.py.
"""

import os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
np.random.seed(42)

# ── Products ────────────────────────────────────────────────────────────────
products = [
    {"product_id": "P001", "product_name": "Wireless Earbuds",   "category": "Electronics",    "base_sales": 320, "price": 49.99},
    {"product_id": "P002", "product_name": "Phone Case",         "category": "Accessories",    "base_sales": 550, "price": 14.99},
    {"product_id": "P003", "product_name": "Laptop Stand",       "category": "Electronics",    "base_sales": 180, "price": 39.99},
    {"product_id": "P004", "product_name": "Running Shoes",      "category": "Footwear",       "base_sales": 270, "price": 89.99},
    {"product_id": "P005", "product_name": "Yoga Mat",           "category": "Fitness",        "base_sales": 200, "price": 29.99},
    {"product_id": "P006", "product_name": "Water Bottle",       "category": "Fitness",        "base_sales": 410, "price": 19.99},
    {"product_id": "P007", "product_name": "Backpack",           "category": "Accessories",    "base_sales": 230, "price": 59.99},
    {"product_id": "P008", "product_name": "Desk Lamp",          "category": "Home & Office",  "base_sales": 150, "price": 34.99},
    {"product_id": "P009", "product_name": "Bluetooth Speaker",  "category": "Electronics",    "base_sales": 290, "price": 69.99},
    {"product_id": "P010", "product_name": "Sunglasses",         "category": "Accessories",    "base_sales": 340, "price": 24.99},
]

# ── Time range: Jan 2022 – Sep 2026  (57 months) ───────────────────────────
dates = pd.date_range("2022-01-01", "2026-09-01", freq="MS")

# ── Seasonal multipliers (month 1–12) ──────────────────────────────────────
# Peaks in Nov-Dec (holiday), dip in Jan-Feb, moderate summer bump
seasonal = {
    1: 0.80, 2: 0.78, 3: 0.90, 4: 0.95, 5: 1.00, 6: 1.05,
    7: 1.08, 8: 1.02, 9: 0.95, 10: 1.00, 11: 1.25, 12: 1.40,
}

# ── Holiday / festival month flags ─────────────────────────────────────────
# Major shopping events: Jan (New Year sale), Mar (Holi), Aug (Independence Day),
# Oct (Diwali), Nov (Black Friday), Dec (Christmas)
holiday_months = {1, 3, 8, 10, 11, 12}

rows = []
for prod in products:
    trend_slope = np.random.uniform(0.002, 0.006)       # gradual growth
    for i, d in enumerate(dates):
        month = d.month

        # Trend
        trend = 1.0 + trend_slope * i

        # Seasonality
        season_mult = seasonal[month]

        # Promotion: ~25 % of months, more likely near holidays
        promo = int(np.random.random() < (0.40 if month in holiday_months else 0.15))

        # Discount: 0-5 % normally, 10-30 % during promos
        if promo:
            discount = round(np.random.uniform(10, 30), 1)
        else:
            discount = round(np.random.choice([0, 0, 0, 5, 5, 3]), 1)

        # Discount boost on sales
        discount_mult = 1.0 + discount / 100.0 * 1.5    # 1 % discount → ~1.5 % lift

        # Holiday flag
        is_holiday = int(month in holiday_months)

        # Compute units sold
        base = prod["base_sales"]
        units = base * trend * season_mult * discount_mult
        units *= np.random.uniform(0.88, 1.12)            # noise
        units = max(int(round(units)), 0)

        rows.append({
            "date":         d.strftime("%Y-%m-%d"),
            "product_id":   prod["product_id"],
            "product_name": prod["product_name"],
            "category":     prod["category"],
            "units_sold":   units,
            "price":        prod["price"],
            "discount_pct": discount,
            "promotion":    promo,
        })

df = pd.DataFrame(rows)
out_path = os.path.join(HERE, "sales_data.csv")
df.to_csv(out_path, index=False)
print(f"✓ Generated {len(df)} rows  →  {out_path}")
print(f"  Products : {df['product_id'].nunique()}")
print(f"  Months   : {df['date'].nunique()}")
print(f"  Date range: {df['date'].min()} to {df['date'].max()}")
