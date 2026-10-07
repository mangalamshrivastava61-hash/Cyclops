"""
Sales Demand Forecasting – ML Pipeline
=======================================
Predicts **next month's units sold** for each product using historical
monthly sales data.

Pipeline steps
--------------
1. Load & clean the dataset
2. Exploratory Data Analysis (EDA)  → saved as PNG charts
3. Feature engineering (lags, rolling stats, growth, seasonality, holidays)
4. Chronological train / test split
5. Train multiple ML models (Random Forest, XGBoost, LightGBM, Gradient Boosting)
6. Compare models on MAE, RMSE, R²
7. Select the best model
8. Predict next month's sales for every product
9. Save the trained model to disk

Usage
-----
    python sales_demand_forecast.py              # uses default 'sales_data.csv'
    python sales_demand_forecast.py data.csv     # custom path

Outputs (saved in the same directory)
------
    eda_monthly_sales_trend.png
    eda_category_sales.png
    eda_correlation_heatmap.png
    eda_seasonal_pattern.png
    model_comparison.png
    feature_importance.png
    next_month_predictions.csv
    best_sales_model.pkl
"""

import os
import sys
import warnings

import joblib
import matplotlib
matplotlib.use("Agg")                       # non-interactive backend
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from lightgbm import LGBMRegressor
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

HERE = os.path.dirname(os.path.abspath(__file__))

# ═══════════════════════════════════════════════════════════════════════════
# 1.  LOAD & CLEAN
# ═══════════════════════════════════════════════════════════════════════════

def load_and_clean(path: str) -> pd.DataFrame:
    """Read CSV, normalise column names, parse dates, handle missing values."""
    if not os.path.isfile(path):
        raise FileNotFoundError(f"File not found: {path}")

    df = pd.read_csv(path)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # ── Require at minimum: date, product_id, units_sold ────────────────
    required = {"date", "product_id", "units_sold"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df["date"] = pd.to_datetime(df["date"])
    df.sort_values(["product_id", "date"], inplace=True)
    df.reset_index(drop=True, inplace=True)

    # Fill optional columns with sensible defaults
    if "price" not in df.columns:
        df["price"] = 0.0
    if "discount_pct" not in df.columns:
        df["discount_pct"] = 0.0
    if "promotion" not in df.columns:
        df["promotion"] = 0
    if "category" not in df.columns:
        df["category"] = "Unknown"
    if "product_name" not in df.columns:
        df["product_name"] = df["product_id"]

    # Numeric coercion & NaN fill
    for col in ["units_sold", "price", "discount_pct", "promotion"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    df["promotion"] = df["promotion"].astype(int)

    # Year / month helpers
    df["year"]  = df["date"].dt.year
    df["month"] = df["date"].dt.month

    print(f"✓ Loaded {len(df)} rows  |  {df['product_id'].nunique()} products  |  "
          f"{df['date'].min().date()} → {df['date'].max().date()}")

    return df


# ═══════════════════════════════════════════════════════════════════════════
# 2.  EDA  (charts saved to disk)
# ═══════════════════════════════════════════════════════════════════════════

def run_eda(df: pd.DataFrame) -> None:
    """Generate and save four EDA charts."""
    print("\n── Exploratory Data Analysis ──")

    # 2a  Monthly sales trend per product ────────────────────────────────
    fig, ax = plt.subplots(figsize=(14, 6))
    for pid, grp in df.groupby("product_id"):
        name = grp["product_name"].iloc[0]
        ax.plot(grp["date"], grp["units_sold"], label=f"{pid} – {name}", linewidth=1.2)
    ax.set_title("Monthly Sales Trend by Product", fontsize=14)
    ax.set_xlabel("Date")
    ax.set_ylabel("Units Sold")
    ax.legend(fontsize=7, ncol=2, loc="upper left")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(HERE, "eda_monthly_sales_trend.png"), dpi=120)
    plt.close(fig)
    print("  saved → eda_monthly_sales_trend.png")

    # 2b  Category-wise total sales ──────────────────────────────────────
    cat_sales = df.groupby("category")["units_sold"].sum().sort_values(ascending=False)
    fig, ax = plt.subplots(figsize=(8, 5))
    cat_sales.plot.bar(ax=ax, color=sns.color_palette("viridis", len(cat_sales)))
    ax.set_title("Total Units Sold by Category", fontsize=14)
    ax.set_ylabel("Units Sold")
    ax.set_xlabel("Category")
    plt.xticks(rotation=30, ha="right")
    fig.tight_layout()
    fig.savefig(os.path.join(HERE, "eda_category_sales.png"), dpi=120)
    plt.close(fig)
    print("  saved → eda_category_sales.png")

    # 2c  Average seasonal pattern ───────────────────────────────────────
    seasonal = df.groupby("month")["units_sold"].mean()
    fig, ax = plt.subplots(figsize=(8, 5))
    seasonal.plot(kind="bar", ax=ax, color="#4c72b0")
    ax.set_title("Average Monthly Units Sold (Seasonality)", fontsize=14)
    ax.set_xlabel("Month")
    ax.set_ylabel("Avg Units Sold")
    ax.set_xticklabels(
        ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
        rotation=45, ha="right")
    fig.tight_layout()
    fig.savefig(os.path.join(HERE, "eda_seasonal_pattern.png"), dpi=120)
    plt.close(fig)
    print("  saved → eda_seasonal_pattern.png")

    # 2d  Correlation heatmap (numeric columns) ─────────────────────────
    num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(num_cols) >= 3:
        fig, ax = plt.subplots(figsize=(10, 8))
        corr = df[num_cols].corr()
        sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", ax=ax,
                    linewidths=0.5, square=True)
        ax.set_title("Feature Correlation Heatmap", fontsize=14)
        fig.tight_layout()
        fig.savefig(os.path.join(HERE, "eda_correlation_heatmap.png"), dpi=120)
        plt.close(fig)
        print("  saved → eda_correlation_heatmap.png")

    # Basic descriptive stats
    print("\n  Descriptive statistics (units_sold):")
    stats = df["units_sold"].describe()
    for k, v in stats.items():
        print(f"    {k:>10s}: {v:>10.2f}")


# ═══════════════════════════════════════════════════════════════════════════
# 3.  FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════════════════

# Holiday / festival months in India-centric calendar
HOLIDAY_MONTHS = {1, 3, 8, 10, 11, 12}

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Per-product lag, rolling, growth, and calendar features.

    Returns a copy with NaN rows (from lagging) dropped.
    """
    df = df.copy()

    # ── Lag features (previous N months' sales) ─────────────────────────
    for lag in range(1, 7):  # lag_1 … lag_6
        df[f"lag_{lag}"] = df.groupby("product_id")["units_sold"].shift(lag)

    # ── Rolling aggregates (on shifted series to avoid leakage) ─────────
    shifted = df.groupby("product_id")["units_sold"].shift(1)
    df["rolling_mean_3"]  = shifted.rolling(3).mean().values
    df["rolling_mean_6"]  = shifted.rolling(6).mean().values
    df["rolling_std_3"]   = shifted.rolling(3).std().values
    df["rolling_std_6"]   = shifted.rolling(6).std().values
    df["rolling_min_3"]   = shifted.rolling(3).min().values
    df["rolling_max_3"]   = shifted.rolling(3).max().values

    # ── Sales growth (month-over-month % change) ────────────────────────
    df["sales_growth"] = df.groupby("product_id")["units_sold"].pct_change()

    # ── Seasonality / calendar ──────────────────────────────────────────
    df["quarter"]       = df["date"].dt.quarter
    df["is_holiday"]    = df["month"].apply(lambda m: 1 if m in HOLIDAY_MONTHS else 0)
    df["month_sin"]     = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"]     = np.cos(2 * np.pi * df["month"] / 12)

    # ── Encode categoricals ─────────────────────────────────────────────
    le_product  = LabelEncoder()
    le_category = LabelEncoder()
    df["product_encoded"]  = le_product.fit_transform(df["product_id"])
    df["category_encoded"] = le_category.fit_transform(df["category"])

    # ── Drop rows with NaN from lagging (first 6 months per product) ───
    before = len(df)
    df.dropna(inplace=True)
    df.reset_index(drop=True, inplace=True)
    print(f"\n✓ Features created  |  {before - len(df)} rows dropped (lag warm-up)  |  "
          f"{len(df)} rows remaining")

    # Store encoders for later use
    df.attrs["le_product"]  = le_product
    df.attrs["le_category"] = le_category

    return df


# ═══════════════════════════════════════════════════════════════════════════
# 4.  TRAIN / TEST SPLIT  (chronological)
# ═══════════════════════════════════════════════════════════════════════════

FEATURE_COLS = [
    # Lags
    "lag_1", "lag_2", "lag_3", "lag_4", "lag_5", "lag_6",
    # Rolling stats
    "rolling_mean_3", "rolling_mean_6",
    "rolling_std_3",  "rolling_std_6",
    "rolling_min_3",  "rolling_max_3",
    # Growth
    "sales_growth",
    # Pricing / promo
    "price", "discount_pct", "promotion",
    # Calendar / seasonality
    "month", "quarter", "year",
    "is_holiday", "month_sin", "month_cos",
    # Product / category
    "product_encoded", "category_encoded",
]

TARGET = "units_sold"


def split_data(df: pd.DataFrame, test_months: int = 6):
    """
    Chronological split: the last *test_months* months form the test set.
    """
    cutoff_date = df["date"].max() - pd.DateOffset(months=test_months - 1)
    train = df[df["date"] < cutoff_date]
    test  = df[df["date"] >= cutoff_date]

    X_train = train[FEATURE_COLS]
    y_train = train[TARGET]
    X_test  = test[FEATURE_COLS]
    y_test  = test[TARGET]

    print(f"\n✓ Split  |  Train: {len(train)} rows (up to {train['date'].max().date()})  |  "
          f"Test: {len(test)} rows ({test['date'].min().date()} → {test['date'].max().date()})")

    return X_train, y_train, X_test, y_test, train, test


# ═══════════════════════════════════════════════════════════════════════════
# 5 & 6.  TRAIN MODELS + COMPARE
# ═══════════════════════════════════════════════════════════════════════════

def get_models() -> dict:
    """Return a dict of model_name → model instance."""
    return {
        "Random Forest": RandomForestRegressor(
            n_estimators=300, max_depth=12, min_samples_leaf=4,
            random_state=42, n_jobs=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=300, learning_rate=0.05, max_depth=6,
            subsample=0.8, colsample_bytree=0.8,
            random_state=42, verbosity=0,
        ),
        "LightGBM": LGBMRegressor(
            n_estimators=300, learning_rate=0.05, max_depth=8,
            min_child_samples=5, subsample=0.8,
            random_state=42, verbose=-1,
        ),
        "Gradient Boosting": GradientBoostingRegressor(
            n_estimators=300, learning_rate=0.05, max_depth=5,
            min_samples_leaf=5, random_state=42,
        ),
    }


def evaluate(y_true, y_pred):
    """Return MAE, RMSE, R²."""
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    return mae, rmse, r2


def train_and_compare(X_train, y_train, X_test, y_test):
    """Train all models, print comparison table, return results dict."""
    models = get_models()
    results = {}

    print("\n── Model Training & Evaluation ──\n")
    header = f"{'Model':<22s}  {'MAE':>10s}  {'RMSE':>10s}  {'R²':>10s}"
    print(header)
    print("─" * len(header))

    for name, model in models.items():
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        mae, rmse, r2 = evaluate(y_test, preds)
        results[name] = {"model": model, "mae": mae, "rmse": rmse, "r2": r2, "preds": preds}
        print(f"{name:<22s}  {mae:>10.2f}  {rmse:>10.2f}  {r2:>10.4f}")

    print("─" * len(header))
    return results


# ═══════════════════════════════════════════════════════════════════════════
# 7.  SELECT BEST MODEL
# ═══════════════════════════════════════════════════════════════════════════

def select_best(results: dict):
    """Pick the model with the lowest RMSE."""
    best_name = min(results, key=lambda k: results[k]["rmse"])
    best = results[best_name]
    print(f"\n★  Best model: {best_name}  "
          f"(MAE={best['mae']:.2f}  RMSE={best['rmse']:.2f}  R²={best['r2']:.4f})")
    return best_name, best["model"]


# ═══════════════════════════════════════════════════════════════════════════
# 8.  FORECAST DURATION PARSER + RECURSIVE MULTI-MONTH PREDICTION
# ═══════════════════════════════════════════════════════════════════════════

def parse_forecast_duration(user_input: str, last_date: pd.Timestamp) -> int:
    """
    Parse the user's chosen forecast horizon and return the number of months.

    Accepted formats
    ----------------
    - 'monthly'  / '1'          ->  1 month
    - 'yearly'   / '12'         ->  12 months
    - '<N>'      (integer)      ->  N months   (e.g. '3' -> 3 months)
    - 'YYYY-MM-DD' (date)       ->  months from last_date up to that date
    """
    text = user_input.strip().lower()

    if text in ("monthly", "month", "next month", "1 month"):
        return 1
    if text in ("yearly", "year", "next year", "1 year", "12 months"):
        return 12

    # Try as an integer number of months
    try:
        n = int(text)
        if n < 1:
            raise ValueError
        return n
    except ValueError:
        pass

    # Try as a target date (YYYY-MM-DD or YYYY-MM)
    for fmt in ("%Y-%m-%d", "%Y-%m", "%Y/%m/%d", "%Y/%m", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            target = pd.Timestamp(pd.to_datetime(text, format=fmt))
            months = (target.year - last_date.year) * 12 + (target.month - last_date.month)
            if months < 1:
                raise ValueError(
                    f"Target date {target.date()} is not after the last data date "
                    f"{last_date.date()}. Please enter a future date."
                )
            return months
        except (ValueError, TypeError):
            continue

    raise ValueError(
        f"Could not understand '{user_input}'.\n"
        "  Accepted inputs:\n"
        "    monthly             -> forecast 1 month ahead\n"
        "    yearly              -> forecast 12 months ahead\n"
        "    <N>                 -> forecast N months ahead  (e.g. 3)\n"
        "    YYYY-MM-DD          -> forecast up to that date (e.g. 2027-06-01)"
    )


def predict_future(model, df: pd.DataFrame, num_months: int) -> pd.DataFrame:
    """
    Recursively predict *num_months* into the future for every product.

    Each month's prediction is fed back as lag values for the next month,
    enabling multi-step forecasting.
    """
    all_predictions = []

    for pid, grp in df.groupby("product_id"):
        grp = grp.sort_values("date")
        history = list(grp["units_sold"].values)
        meta = {
            "product_id":       pid,
            "product_name":     grp["product_name"].iloc[-1],
            "category":         grp["category"].iloc[-1],
            "price":            grp["price"].iloc[-1],
            "discount_pct":     grp["discount_pct"].iloc[-1],
            "product_encoded":  grp["product_encoded"].iloc[-1],
            "category_encoded": grp["category_encoded"].iloc[-1],
        }
        last_date = grp["date"].max()

        for step in range(1, num_months + 1):
            fc_date  = last_date + pd.DateOffset(months=step)
            fc_month = fc_date.month
            fc_year  = fc_date.year
            fc_qtr   = (fc_month - 1) // 3 + 1

            h = history
            row = {
                **meta,
                "lag_1": h[-1] if len(h) >= 1 else 0,
                "lag_2": h[-2] if len(h) >= 2 else 0,
                "lag_3": h[-3] if len(h) >= 3 else 0,
                "lag_4": h[-4] if len(h) >= 4 else 0,
                "lag_5": h[-5] if len(h) >= 5 else 0,
                "lag_6": h[-6] if len(h) >= 6 else 0,
                "rolling_mean_3": np.mean(h[-3:]) if len(h) >= 3 else np.mean(h),
                "rolling_mean_6": np.mean(h[-6:]) if len(h) >= 6 else np.mean(h),
                "rolling_std_3":  np.std(h[-3:])  if len(h) >= 3 else 0,
                "rolling_std_6":  np.std(h[-6:])  if len(h) >= 6 else 0,
                "rolling_min_3":  np.min(h[-3:])  if len(h) >= 3 else np.min(h),
                "rolling_max_3":  np.max(h[-3:])  if len(h) >= 3 else np.max(h),
                "sales_growth": (h[-1] - h[-2]) / (h[-2] + 1e-9) if len(h) >= 2 else 0.0,
                "promotion": 0,
                "month":     fc_month,
                "quarter":   fc_qtr,
                "year":      fc_year,
                "is_holiday": 1 if fc_month in HOLIDAY_MONTHS else 0,
                "month_sin": np.sin(2 * np.pi * fc_month / 12),
                "month_cos": np.cos(2 * np.pi * fc_month / 12),
            }

            X_row = pd.DataFrame([row])[FEATURE_COLS]
            pred  = max(int(round(float(model.predict(X_row)[0]))), 0)
            history.append(pred)

            all_predictions.append({
                "forecast_date":        fc_date.strftime("%Y-%m-%d"),
                "product_id":           pid,
                "product_name":         meta["product_name"],
                "category":             meta["category"],
                "predicted_units_sold": pred,
            })

    return pd.DataFrame(all_predictions)


# ═══════════════════════════════════════════════════════════════════════════
#  VISUALISATION HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def plot_model_comparison(results: dict):
    """Bar chart comparing MAE, RMSE, R² across models."""
    names = list(results.keys())
    mae_vals  = [results[n]["mae"]  for n in names]
    rmse_vals = [results[n]["rmse"] for n in names]
    r2_vals   = [results[n]["r2"]   for n in names]

    fig, axes = plt.subplots(1, 3, figsize=(16, 5))

    colors = sns.color_palette("Set2", len(names))

    axes[0].barh(names, mae_vals, color=colors)
    axes[0].set_title("MAE (lower is better)")
    axes[0].set_xlabel("MAE")

    axes[1].barh(names, rmse_vals, color=colors)
    axes[1].set_title("RMSE (lower is better)")
    axes[1].set_xlabel("RMSE")

    axes[2].barh(names, r2_vals, color=colors)
    axes[2].set_title("R² Score (higher is better)")
    axes[2].set_xlabel("R²")

    fig.suptitle("Model Comparison", fontsize=15, y=1.02)
    fig.tight_layout()
    fig.savefig(os.path.join(HERE, "model_comparison.png"), dpi=120, bbox_inches="tight")
    plt.close(fig)
    print("  saved → model_comparison.png")


def plot_feature_importance(model, model_name: str):
    """Horizontal bar chart of the top-20 feature importances."""
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
        indices = np.argsort(importances)[::-1][:20]
        top_features = [FEATURE_COLS[i] for i in indices]
        top_values   = importances[indices]

        fig, ax = plt.subplots(figsize=(10, 7))
        ax.barh(top_features[::-1], top_values[::-1], color="#4c72b0")
        ax.set_title(f"Top Feature Importances – {model_name}", fontsize=14)
        ax.set_xlabel("Importance")
        fig.tight_layout()
        fig.savefig(os.path.join(HERE, "feature_importance.png"), dpi=120)
        plt.close(fig)
        print("  saved → feature_importance.png")


def plot_actual_vs_predicted(y_test, preds, model_name: str):
    """Scatter plot: actual vs predicted."""
    fig, ax = plt.subplots(figsize=(7, 7))
    ax.scatter(y_test, preds, alpha=0.5, edgecolors="k", linewidths=0.3)
    lims = [min(y_test.min(), preds.min()) * 0.9,
            max(y_test.max(), preds.max()) * 1.1]
    ax.plot(lims, lims, "r--", linewidth=1.5, label="Perfect prediction")
    ax.set_xlim(lims)
    ax.set_ylim(lims)
    ax.set_xlabel("Actual Units Sold")
    ax.set_ylabel("Predicted Units Sold")
    ax.set_title(f"Actual vs Predicted – {model_name}", fontsize=14)
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(HERE, "actual_vs_predicted.png"), dpi=120)
    plt.close(fig)
    print("  saved -> actual_vs_predicted.png")


def plot_forecast_timeline(preds: pd.DataFrame, df_hist: pd.DataFrame, num_months: int):
    """Line chart showing historical + forecasted sales for each product."""
    if num_months < 2:
        return

    preds_plot = preds.copy()
    preds_plot["forecast_date"] = pd.to_datetime(preds_plot["forecast_date"])

    fig, ax = plt.subplots(figsize=(14, 6))
    colors = sns.color_palette("tab10", df_hist["product_id"].nunique())

    for idx, (pid, grp) in enumerate(df_hist.groupby("product_id")):
        name = grp["product_name"].iloc[-1]
        recent = grp.sort_values("date").tail(12)
        ax.plot(recent["date"], recent["units_sold"],
                color=colors[idx % len(colors)], linewidth=1.2, label=f"{pid} - {name}")

        fc = preds_plot[preds_plot["product_id"] == pid].sort_values("forecast_date")
        ax.plot(fc["forecast_date"], fc["predicted_units_sold"],
                color=colors[idx % len(colors)], linewidth=1.5, linestyle="--", marker="o", markersize=4)

    last_hist = df_hist["date"].max()
    ax.axvline(x=last_hist, color="gray", linestyle=":", linewidth=1, label="Forecast starts")

    ax.set_title(f"Sales Forecast Timeline ({num_months} Month Horizon)", fontsize=14)
    ax.set_xlabel("Date")
    ax.set_ylabel("Units Sold")
    ax.legend(fontsize=7, ncol=2, loc="upper left")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(HERE, "forecast_timeline.png"), dpi=120)
    plt.close(fig)
    print("  saved -> forecast_timeline.png")


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════

def get_user_duration():
    """Get forecast duration from command-line argument or interactive prompt."""
    if len(sys.argv) > 2:
        return sys.argv[2]
    try:
        prompt_text = (
            "\nChoose forecast duration:\n"
            "  - 'monthly' (or 1)       : next month\n"
            "  - 'yearly'  (or 12)      : next 12 months\n"
            "  - '<N>'                  : N months ahead (e.g. 3, 6)\n"
            "  - 'YYYY-MM-DD'           : target future date (e.g. 2027-06-01)\n"
            "Enter duration [default: monthly]: "
        )
        val = input(prompt_text).strip()
        return val if val else "monthly"
    except (EOFError, KeyboardInterrupt):
        return "monthly"


def main():
    # Determine input path
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    else:
        csv_path = os.path.join(HERE, "sales_data.csv")

    # 1. Load & clean
    df = load_and_clean(csv_path)

    # 2. EDA
    run_eda(df)

    # 3. Feature engineering
    df_feat = engineer_features(df)

    # 4. Split
    X_train, y_train, X_test, y_test, train_df, test_df = split_data(df_feat)

    # 5 & 6. Train + Compare
    results = train_and_compare(X_train, y_train, X_test, y_test)

    # 7. Select best
    best_name, best_model = select_best(results)

    # ── Charts ──────────────────────────────────────────────────────────
    print("\n── Saving Evaluation Charts ──")
    plot_model_comparison(results)
    plot_feature_importance(best_model, best_name)
    plot_actual_vs_predicted(y_test, results[best_name]["preds"], best_name)

    # 8. User duration & Multi-period prediction
    last_date = df["date"].max()
    duration_input = get_user_duration()
    try:
        num_months = parse_forecast_duration(duration_input, last_date)
    except ValueError as err:
        print(f"\nWarning: {err}\nDefaulting to 1 month.")
        num_months = 1

    target_date = (last_date + pd.DateOffset(months=num_months)).strftime("%Y-%m-%d")
    print(f"\n--> Forecasting for {num_months} month{'s' if num_months > 1 else ''} (up to {target_date})")

    preds = predict_future(best_model, df_feat, num_months)

    print("\n── Sales Predictions ──\n")
    if num_months == 1:
        header = f"{'Product ID':<12s}  {'Product Name':<22s}  {'Category':<16s}  {'Predicted Units':>16s}"
        print(header)
        print("─" * len(header))
        for _, r in preds.iterrows():
            print(f"{r['product_id']:<12s}  {r['product_name']:<22s}  "
                  f"{r['category']:<16s}  {r['predicted_units_sold']:>16d}")
        print("─" * len(header))
        print(f"Forecast date: {preds['forecast_date'].iloc[0]}")
    else:
        # Multi-month display
        pivot = preds.pivot(index=["product_id", "product_name"], columns="forecast_date", values="predicted_units_sold")
        pivot["Total Demand"] = pivot.sum(axis=1)
        print(pivot.to_string())

        plot_forecast_timeline(preds, df, num_months)

    # Save predictions CSV
    pred_path = os.path.join(HERE, "forecast_predictions.csv")
    preds.to_csv(pred_path, index=False)
    print(f"\n✓ Predictions saved -> {pred_path}")

    # Also keep next_month_predictions.csv for backwards compatibility
    next_m_path = os.path.join(HERE, "next_month_predictions.csv")
    first_month_date = preds["forecast_date"].iloc[0]
    preds[preds["forecast_date"] == first_month_date].to_csv(next_m_path, index=False)

    # 9. Save trained model
    model_path = os.path.join(HERE, "best_sales_model.pkl")
    joblib.dump({
        "model":        best_model,
        "model_name":   best_name,
        "features":     FEATURE_COLS,
        "target":       TARGET,
        "last_date":    df["date"].max().isoformat(),
        "products":     df["product_id"].unique().tolist(),
    }, model_path)
    print(f"✓ Model saved -> {model_path}")

    print("\n✅ Done – Sales demand forecasting complete.")


if __name__ == "__main__":
    main()

