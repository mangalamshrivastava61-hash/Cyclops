"""ML Sales Demand Forecast Provider and Runner.

Loads `best_sales_model.pkl` and `sales_data.csv` to provide:
1. Multi-product sales demand predictions (monthly / multi-period).
2. Processing custom uploaded CSV sales datasets or new trained models.
3. Integration with ORACLE's ForecastProvider interface.
"""

from __future__ import annotations

import io
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from .. import models, repository, schemas

ML_DIR = Path(__file__).parent.parent / "ml_models"
MODEL_PATH = ML_DIR / "best_sales_model.pkl"
DATA_PATH = ML_DIR / "sales_data.csv"

HOLIDAY_MONTHS = {1, 3, 8, 10, 11, 12}


class MLModelManager:
    def __init__(self):
        self.model_data: Optional[Dict[str, Any]] = None
        self.raw_df: Optional[pd.DataFrame] = None
        self.current_model_file: str = "best_sales_model.pkl"
        self.current_data_file: str = "sales_data.csv"
        self._load()

    def _load(self):
        if MODEL_PATH.exists():
            try:
                self.model_data = joblib.load(MODEL_PATH)
            except Exception as e:
                print(f"[MLModelManager] Error loading {MODEL_PATH}: {e}")

        if DATA_PATH.exists():
            try:
                df = pd.read_csv(DATA_PATH)
                self.set_sales_df(df, filename="sales_data.csv")
            except Exception as e:
                print(f"[MLModelManager] Error loading {DATA_PATH}: {e}")

    def set_sales_df(self, df: pd.DataFrame, filename: str = "uploaded_sales_data.csv"):
        """Clean and set the raw sales dataframe."""
        df = df.copy()
        df.columns = [c.strip().lower() for c in df.columns]

        # Handle column naming variations
        rename_map = {}
        for col in df.columns:
            clow = col.lower().strip()
            if clow in ["units", "sales", "quantity", "qty", "demand", "volume", "units_sold", "unit_sales", "qty_sold"]:
                if "units_sold" not in rename_map.values():
                    rename_map[col] = "units_sold"
            elif clow in ["date", "order_date", "day", "period", "ds", "transaction_date", "sales_date", "time", "timestamp"]:
                if "date" not in rename_map.values():
                    rename_map[col] = "date"
            elif clow in ["product", "product_name", "item", "item_name", "description", "title"]:
                if "product_name" not in rename_map.values():
                    rename_map[col] = "product_name"
            elif clow in ["sku", "product_id", "item_id", "code", "barcode", "upc"]:
                if "product_id" not in rename_map.values():
                    rename_map[col] = "product_id"
            elif clow in ["inventory", "stock", "stock_on_hand", "on_hand", "inventory_level", "current_stock", "qty_on_hand"]:
                if "inventory" not in rename_map.values():
                    rename_map[col] = "inventory"

        df.rename(columns=rename_map, inplace=True)

        if "product_id" not in df.columns:
            if "product_name" in df.columns:
                df["product_id"] = "P" + df["product_name"].astype("category").cat.codes.astype(str)
            else:
                df["product_id"] = "P001"

        if "product_name" not in df.columns:
            df["product_name"] = df["product_id"]

        if "category" not in df.columns:
            df["category"] = "General"

        if "price" not in df.columns:
            df["price"] = 50.0

        if "discount_pct" not in df.columns:
            df["discount_pct"] = 0.0

        if "promotion" not in df.columns:
            df["promotion"] = 0

        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce")
            df = df.dropna(subset=["date"])
        else:
            # Generate sequential daily dates
            end_date = pd.Timestamp.now().normalize()
            df["date"] = [end_date - pd.Timedelta(days=len(df) - 1 - i) for i in range(len(df))]

        df["month"] = df["date"].dt.month
        df["year"] = df["date"].dt.year
        df["units_sold"] = pd.to_numeric(df["units_sold"], errors="coerce").fillna(0)

        self.raw_df = df
        self.current_data_file = filename

    def load_custom_model(self, model_bytes: bytes, filename: str):
        """Loads a user uploaded .pkl or .joblib model."""
        data = joblib.load(io.BytesIO(model_bytes))
        if isinstance(data, dict) and "model" in data:
            self.model_data = data
        else:
            # Wrapped directly as a scikit-learn or lightgbm estimator
            self.model_data = {
                "model": data,
                "model_name": type(data).__name__,
                "features": self.model_data.get("features", []) if self.model_data else [],
                "target": "units_sold",
                "last_date": self.raw_df["date"].max().isoformat() if self.raw_df is not None else None,
                "products": self.raw_df["product_id"].unique().tolist() if self.raw_df is not None else [],
            }
        self.current_model_file = filename

    @property
    def is_ready(self) -> bool:
        return self.model_data is not None and self.raw_df is not None

    def get_info(self) -> Dict[str, Any]:
        if not self.is_ready:
            return {"status": "not_loaded", "message": "Model or sales data file not found."}
        return {
            "status": "ready",
            "model_name": self.model_data.get("model_name", "GradientBoostingRegressor"),
            "model_file": self.current_model_file,
            "data_file": self.current_data_file,
            "target": self.model_data.get("target", "units_sold"),
            "features_count": len(self.model_data.get("features", [])),
            "features": self.model_data.get("features", []),
            "last_date": self.model_data.get("last_date") or (self.raw_df["date"].max().isoformat() if self.raw_df is not None else ""),
            "products_count": self.raw_df["product_id"].nunique() if self.raw_df is not None else len(self.model_data.get("products", [])),
        }

    def get_sales_history(self, limit: int = 500, sku: Optional[str] = None) -> Dict[str, Any]:
        """Returns historical sales observations from the currently loaded or uploaded dataset."""
        if self.raw_df is None or self.raw_df.empty:
            return {"data_source": self.current_data_file, "total": 0, "records": []}

        df = self.raw_df.copy()
        if sku and sku.lower() != "all":
            df = df[df["product_id"].astype(str).str.lower() == str(sku).lower()]

        if "date" in df.columns:
            df = df.sort_values(by="date", ascending=False)

        total = len(df)
        records = []
        for _, row in df.head(limit).iterrows():
            d = row.get("date")
            if hasattr(d, "strftime"):
                date_str = d.strftime("%Y-%m-%d")
            else:
                date_str = str(d)[:10] if pd.notna(d) else ""

            prod_id = str(row.get("product_id", ""))
            prod_name = str(row.get("product_name", prod_id))
            units = int(row.get("units_sold", 0)) if pd.notna(row.get("units_sold")) else 0
            price = float(row.get("price", 0.0)) if pd.notna(row.get("price")) else 0.0
            promo = bool(row.get("promotion", 0)) if pd.notna(row.get("promotion")) else False
            inv = int(row.get("inventory", int(units * 1.2))) if "inventory" in row and pd.notna(row.get("inventory")) else int(units * 1.2)
            stockout = bool(row.get("stockout", False)) or (units == 0)

            records.append({
                "date": date_str,
                "sku": prod_id,
                "product_name": prod_name,
                "category": str(row.get("category", "General")),
                "demand": units,
                "inventory": inv,
                "price": price,
                "promotion": promo,
                "stockout": stockout,
            })

        return {
            "data_source": self.current_data_file,
            "total": total,
            "records": records,
        }

    def predict_future(self, num_months: int = 1, custom_df: Optional[pd.DataFrame] = None) -> List[Dict[str, Any]]:
        """Predict demand for all products for `num_months` ahead using the given or loaded dataset."""
        if not self.is_ready and custom_df is None:
            raise RuntimeError("ML model or dataset not loaded.")

        model = self.model_data["model"]
        feature_cols = self.model_data.get("features", [])

        df = custom_df.copy() if custom_df is not None else self.raw_df.copy()

        # Generate lag features
        for lag in range(1, 7):
            df[f"lag_{lag}"] = df.groupby("product_id")["units_sold"].shift(lag)

        shifted = df.groupby("product_id")["units_sold"].shift(1)
        df["rolling_mean_3"] = shifted.rolling(3).mean().values
        df["rolling_mean_6"] = shifted.rolling(6).mean().values
        df["rolling_std_3"] = shifted.rolling(3).std().values
        df["rolling_std_6"] = shifted.rolling(6).std().values
        df["rolling_min_3"] = shifted.rolling(3).min().values
        df["rolling_max_3"] = shifted.rolling(3).max().values
        df["sales_growth"] = df.groupby("product_id")["units_sold"].pct_change().fillna(0)
        df["quarter"] = df["date"].dt.quarter
        df["is_holiday"] = df["month"].apply(lambda m: 1 if m in HOLIDAY_MONTHS else 0)
        df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
        df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

        # Encoders
        prod_map = {pid: idx for idx, pid in enumerate(df["product_id"].unique())}
        cat_map = {cat: idx for idx, cat in enumerate(df["category"].unique())}
        df["product_encoded"] = df["product_id"].map(prod_map)
        df["category_encoded"] = df["category"].map(cat_map)

        df.dropna(inplace=True)
        df.reset_index(drop=True, inplace=True)

        working_df = df.copy()
        last_date = working_df["date"].max()
        all_preds = []

        products = working_df[["product_id", "product_name", "category"]].drop_duplicates()

        for step in range(1, num_months + 1):
            next_date = last_date + pd.DateOffset(months=step)
            next_month = next_date.month
            next_quarter = next_date.quarter
            next_year = next_date.year
            is_hol = 1 if next_month in HOLIDAY_MONTHS else 0

            step_rows = []
            for _, prod in products.iterrows():
                pid = prod["product_id"]
                p_hist = working_df[working_df["product_id"] == pid].sort_values("date")
                recent_sales = p_hist["units_sold"].values
                last_row = p_hist.iloc[-1]

                row = {
                    "product_id": pid,
                    "product_name": prod["product_name"],
                    "category": prod["category"],
                    "date": next_date,
                    "lag_1": recent_sales[-1] if len(recent_sales) >= 1 else 0,
                    "lag_2": recent_sales[-2] if len(recent_sales) >= 2 else 0,
                    "lag_3": recent_sales[-3] if len(recent_sales) >= 3 else 0,
                    "lag_4": recent_sales[-4] if len(recent_sales) >= 4 else 0,
                    "lag_5": recent_sales[-5] if len(recent_sales) >= 5 else 0,
                    "lag_6": recent_sales[-6] if len(recent_sales) >= 6 else 0,
                    "rolling_mean_3": np.mean(recent_sales[-3:]) if len(recent_sales) >= 3 else recent_sales[-1],
                    "rolling_mean_6": np.mean(recent_sales[-6:]) if len(recent_sales) >= 6 else recent_sales[-1],
                    "rolling_std_3": np.std(recent_sales[-3:], ddof=1) if len(recent_sales) >= 3 else 0,
                    "rolling_std_6": np.std(recent_sales[-6:], ddof=1) if len(recent_sales) >= 6 else 0,
                    "rolling_min_3": np.min(recent_sales[-3:]) if len(recent_sales) >= 3 else recent_sales[-1],
                    "rolling_max_3": np.max(recent_sales[-3:]) if len(recent_sales) >= 3 else recent_sales[-1],
                    "sales_growth": ((recent_sales[-1] - recent_sales[-2]) / max(recent_sales[-2], 1)) if len(recent_sales) >= 2 else 0,
                    "price": last_row.get("price", 50.0),
                    "discount_pct": 0.0,
                    "promotion": 0,
                    "month": next_month,
                    "quarter": next_quarter,
                    "year": next_year,
                    "is_holiday": is_hol,
                    "month_sin": np.sin(2 * np.pi * next_month / 12),
                    "month_cos": np.cos(2 * np.pi * next_month / 12),
                    "product_encoded": prod_map.get(pid, 0),
                    "category_encoded": cat_map.get(prod["category"], 0),
                }
                step_rows.append(row)

            step_df = pd.DataFrame(step_rows)
            # Match feature columns
            if feature_cols:
                for col in feature_cols:
                    if col not in step_df.columns:
                        step_df[col] = 0.0
                X_future = step_df[feature_cols].copy().fillna(0)
            else:
                X_future = step_df.select_dtypes(include=[np.number]).fillna(0)

            preds_raw = model.predict(X_future)
            step_df["predicted_units_sold"] = np.clip(np.round(preds_raw).astype(int), 0, None)
            step_df["forecast_date"] = next_date.strftime("%Y-%m-%d")

            for _, r in step_df.iterrows():
                all_preds.append({
                    "product_id": r["product_id"],
                    "product_name": r["product_name"],
                    "category": r["category"],
                    "forecast_date": r["forecast_date"],
                    "predicted_units_sold": int(r["predicted_units_sold"]),
                    "price": float(r["price"]),
                })

            # Append predictions as historical rows for subsequent month horizon steps
            append_rows = []
            for _, r in step_df.iterrows():
                append_rows.append({
                    "date": next_date,
                    "product_id": r["product_id"],
                    "product_name": r["product_name"],
                    "category": r["category"],
                    "units_sold": r["predicted_units_sold"],
                    "price": r["price"],
                    "discount_pct": 0.0,
                    "promotion": 0,
                })
            working_df = pd.concat([working_df, pd.DataFrame(append_rows)], ignore_index=True)

        return all_preds


# Global singleton instance
ml_manager = MLModelManager()


class MLForecastProvider:
    """ForecastProvider that hooks the trained ML model into ORACLE."""

    name = "Trained ML Model (GradientBoostingRegressor / best_sales_model.pkl)"

    def forecast_for(self, db: Session, decision: models.Decision) -> schemas.Forecast:
        stored_fc = repository.get_forecast(db, decision.forecast_id)
        if stored_fc is None:
            raise RuntimeError(f"No base forecast {decision.forecast_id} for decision #{decision.id}.")

        if not ml_manager.is_ready:
            return stored_fc

        try:
            preds = ml_manager.predict_future(num_months=1)
            sku_idx = abs(hash(decision.sku)) % len(preds) if preds else 0
            pred_item = preds[sku_idx]
            monthly_predicted = float(pred_item["predicted_units_sold"])

            horizon = stored_fc.horizon_days
            days_in_month = 30.0
            horizon_units = (monthly_predicted / days_in_month) * horizon

            p50 = round(horizon_units, 1)
            p10 = round(p50 * 0.78, 1)
            p90 = round(p50 * 1.25, 1)

            ratio = p50 / max(stored_fc.p50, 1.0)
            updated_daily = [
                schemas.ForecastDay(
                    date=day.date,
                    mean=round(day.mean * ratio, 2),
                    p10=round(day.p10 * ratio, 2),
                    p90=round(day.p90 * ratio, 2),
                )
                for day in stored_fc.daily
            ]

            return schemas.Forecast(
                id=stored_fc.id,
                sku=stored_fc.sku,
                issued_at=stored_fc.issued_at,
                horizon_days=stored_fc.horizon_days,
                p10=p10,
                p50=p50,
                p90=p90,
                daily=updated_daily,
                history=stored_fc.history,
                demand_trend=round(float(stored_fc.demand_trend * ratio), 2),
                cover_days_now=stored_fc.cover_days_now,
                cover_days_end=stored_fc.cover_days_end,
                policy=stored_fc.policy,
            )
        except Exception as e:
            print(f"[MLForecastProvider] Fallback to stored forecast due to: {e}")
            return stored_fc
