import os
import matplotlib.pyplot as plt
from model import load_data, train_model, forecast_sales, forecast_inventory, stock_plan

HERE = os.path.dirname(os.path.abspath(__file__))


def plot(hist_dates, hist_values, fc_dates, fc_values, title, ylabel, filename):
    plt.figure(figsize=(10, 5))
    plt.plot(hist_dates, hist_values, label="Historical")
    plt.plot(fc_dates, fc_values, label="Forecast", linestyle="--", marker="o")
    plt.title(title)
    plt.xlabel("Date")
    plt.ylabel(ylabel)
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.savefig(os.path.join(HERE, filename))


def main():
    path = input("Enter CSV file path: ").strip().strip('"').strip("'")
    days_text = input("Enter number of days to forecast: ").strip()

    try:
        days = int(days_text)
        if days < 1:
            raise ValueError
    except ValueError:
        print("Error: number of days must be a whole number of 1 or more.")
        return

    try:
        df, has_inventory = load_data(path)
        model, mae, rmse = train_model(df)
    except ValueError as e:
        print(f"Error: {e}")
        return

    sales_fc = forecast_sales(model, df, days)

    if has_inventory:
        sales_fc["predicted_inventory"] = forecast_inventory(df, sales_fc)
    else:
        print("Inventory column not found. Sales forecasting will be performed,")
        print("but inventory forecasting cannot be generated.\n")

    # ---- Results ----
    print("\nSALES FORECAST")
    print("-" * 32)
    print(f"{'Date':<14}{'Predicted Sales':>16}")
    print("-" * 32)
    for _, r in sales_fc.iterrows():
        print(f"{r['date'].date()!s:<14}{r['predicted_sales']:>16.2f}")
    print("-" * 32)

    current = float(df["inventory"].iloc[-1]) if has_inventory else None
    total, safety, needed, order = stock_plan(sales_fc, rmse, current)

    print("\nSTOCK PLAN")
    print("-" * 40)
    print(f"Days forecasted:               {days}")
    print(f"Expected total sales:          {total:.2f}")
    print(f"Safety stock (95% service):    {safety:.2f}")
    print(f"RECOMMENDED STOCK NEEDED:      {needed:.2f}")
    if has_inventory:
        print(f"Current inventory (last row):  {current:.2f}")
        if order > 0:
            print(f"ORDER / REPLENISH QUANTITY:    {order:.2f}")
        else:
            print("Current inventory is enough. No order needed.")
    print("-" * 40)

    if has_inventory:
        print("\nINVENTORY FORECAST")
        print("No future replenishment data was provided. Inventory forecast")
        print("assumes zero future replenishment.")
        print("-" * 34)
        print(f"{'Date':<14}{'Predicted Inventory':>20}")
        print("-" * 34)
        for _, r in sales_fc.iterrows():
            print(f"{r['date'].date()!s:<14}{r['predicted_inventory']:>20.2f}")
        print("-" * 34)

    print("\nMODEL ACCURACY")
    print("-" * 32)
    print(f"MAE: {mae:.2f}")
    print(f"RMSE: {rmse:.2f}")

    # ---- Save CSV ----
    sales_fc.to_csv(os.path.join(HERE, "output.csv"), index=False)

    # ---- Graphs ----
    plot(df["date"], df["sales"], sales_fc["date"], sales_fc["predicted_sales"],
         "Historical Sales + Forecast Sales", "Sales", "sales_forecast.png")

    plt.show()


if __name__ == "__main__":
    main()
