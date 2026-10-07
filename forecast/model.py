import os
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

MIN_ROWS = 30
FEATURES = ["lag_1", "lag_7", "rolling_mean_7", "day_of_week", "month"]


def load_data(path):
    """Read and validate the user's real CSV. Raises ValueError on any problem."""
    if not os.path.isfile(path):
        raise ValueError(f"File not found: {path}")

    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    for col in ("date", "sales"):
        if col not in df.columns:
            raise ValueError(f"Required column '{col}' not found in CSV.")

    has_inventory = "inventory" in df.columns
    cols = ["date", "sales"] + (["inventory"] if has_inventory else [])
    df = df[cols]

    if df.isnull().any().any():
        raise ValueError("CSV contains missing values. Please fix your data.")

    try:
        df["date"] = pd.to_datetime(df["date"])
    except Exception:
        raise ValueError("Column 'date' contains invalid dates.")

    for col in cols[1:]:
        try:
            df[col] = pd.to_numeric(df[col])
        except Exception:
            raise ValueError(f"Column '{col}' contains non-numeric values.")

    if df["date"].duplicated().any():
        raise ValueError("CSV contains duplicate dates.")

    df = df.sort_values("date").reset_index(drop=True)

    if len(df) < MIN_ROWS:
        raise ValueError(
            f"Not enough data: {len(df)} rows found, at least {MIN_ROWS} required."
        )

    gaps = df["date"].diff().dropna()
    if (gaps != pd.Timedelta(days=1)).any():
        raise ValueError("Dates must be consecutive daily records (no gaps).")

    return df, has_inventory


def make_features(df):
    """Build features from real sales history."""
    out = pd.DataFrame({"date": df["date"], "sales": df["sales"]})
    out["lag_1"] = out["sales"].shift(1)
    out["lag_7"] = out["sales"].shift(7)
    out["rolling_mean_7"] = out["sales"].shift(1).rolling(7).mean()
    out["day_of_week"] = out["date"].dt.dayofweek
    out["month"] = out["date"].dt.month
    return out.dropna().reset_index(drop=True)


def new_model():
    return LGBMRegressor(
        n_estimators=200, learning_rate=0.05, min_child_samples=5, verbose=-1
    )


def train_model(df):
    """Time-based split for MAE/RMSE, then refit on all real data."""
    data = make_features(df)
    X, y = data[FEATURES], data["sales"]

    test_size = max(5, int(len(data) * 0.2))
    X_train, X_test = X.iloc[:-test_size], X.iloc[-test_size:]
    y_train, y_test = y.iloc[:-test_size], y.iloc[-test_size:]

    model = new_model().fit(X_train, y_train)
    pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, pred)
    rmse = np.sqrt(mean_squared_error(y_test, pred))

    final_model = new_model().fit(X, y)
    return final_model, mae, rmse


def forecast_sales(model, df, days):
    """Recursive day-by-day forecast using the model's own predictions."""
    history = list(df["sales"])
    dates = pd.date_range(df["date"].iloc[-1] + pd.Timedelta(days=1), periods=days)
    preds = []

    for d in dates:
        row = pd.DataFrame([{
            "lag_1": history[-1],
            "lag_7": history[-7],
            "rolling_mean_7": np.mean(history[-7:]),
            "day_of_week": d.dayofweek,
            "month": d.month,
        }])
        p = float(model.predict(row[FEATURES])[0])
        preds.append(p)
        history.append(p)

    return pd.DataFrame({"date": dates, "predicted_sales": preds})


def forecast_inventory(df, sales_forecast):
    """future_inventory = previous_inventory - predicted_sales (no replenishment)."""
    stock = float(df["inventory"].iloc[-1])
    values = []
    for s in sales_forecast["predicted_sales"]:
        stock = max(stock - s, 0.0)
        values.append(stock)
    return values


def stock_plan(sales_fc, rmse, current_stock=None):
    """How much stock is needed to cover the forecast period.

    needed stock = total predicted sales + safety stock
    safety stock = 1.65 * RMSE * sqrt(days)   (about 95% service level,
                   RMSE is the model's real error on your data)
    """
    days = len(sales_fc)
    total_sales = float(sales_fc["predicted_sales"].sum())
    safety = 1.65 * rmse * np.sqrt(days)
    needed = total_sales + safety
    order = None if current_stock is None else max(needed - current_stock, 0.0)
    return total_sales, safety, needed, order
