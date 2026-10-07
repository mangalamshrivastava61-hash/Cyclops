"""Router for ML Sales Demand Forecast endpoints with file upload and processing."""

from typing import Any, Dict, List
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from ..services.ml_forecast import ml_manager

router = APIRouter(prefix="/api/ml-forecast", tags=["ml-forecast"])


class PredictionItem(BaseModel):
    product_id: str
    product_name: str
    category: str
    forecast_date: str
    predicted_units_sold: int
    price: float


class ModelInfoResponse(BaseModel):
    status: str
    model_name: str | None = None
    model_file: str | None = None
    data_file: str | None = None
    target: str | None = None
    features_count: int | None = None
    features: List[str] | None = None
    last_date: str | None = None
    products_count: int | None = None


class ForecastPredictResponse(BaseModel):
    horizon_months: int
    data_source: str
    predictions: List[PredictionItem]
    products: List[str]


class HistoryItem(BaseModel):
    date: str
    sku: str
    product_name: str
    category: str = "General"
    demand: int
    inventory: int = 0
    price: float
    promotion: bool = False
    stockout: bool = False


class HistoryResponse(BaseModel):
    data_source: str
    total: int
    records: List[HistoryItem]


@router.get("/info", response_model=ModelInfoResponse)
def get_model_info():
    """Returns metadata about the active ML model."""
    info = ml_manager.get_info()
    return info


@router.get("/history", response_model=HistoryResponse)
def get_history(
    limit: int = Query(default=500, ge=1, le=2000),
    sku: str | None = None,
):
    """Returns historical sales observations from the currently active or uploaded sales dataset."""
    return ml_manager.get_sales_history(limit=limit, sku=sku)


@router.get("/predict", response_model=ForecastPredictResponse)
def predict_demand(months: int = Query(default=1, ge=1, le=12, description="Number of future months to forecast")):
    """Generates demand forecasts using the currently loaded dataset."""
    if not ml_manager.is_ready:
        raise HTTPException(status_code=503, detail="ML Model is not loaded or missing dependencies.")
    try:
        preds = ml_manager.predict_future(num_months=months)
        unique_prods = list({p["product_name"] for p in preds})
        return {
            "horizon_months": months,
            "data_source": ml_manager.current_data_file,
            "predictions": preds,
            "products": unique_prods,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@router.post("/upload-and-predict", response_model=ForecastPredictResponse)
async def upload_and_predict(
    file: UploadFile = File(...),
    months: int = Query(default=1, ge=1, le=12),
):
    """Upload a new sales CSV dataset or model (.pkl), process it through the ML model, and return predictions."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    filename_lower = file.filename.lower()
    content = await file.read()

    try:
        if filename_lower.endswith(".csv"):
            import io
            df = pd.read_csv(io.BytesIO(content))
            ml_manager.set_sales_df(df, filename=file.filename)
            preds = ml_manager.predict_future(num_months=months)
            unique_prods = list({p["product_name"] for p in preds})
            return {
                "horizon_months": months,
                "data_source": file.filename,
                "predictions": preds,
                "products": unique_prods,
            }

        elif filename_lower.endswith((".xlsx", ".xls")):
            import io
            df = pd.read_excel(io.BytesIO(content))
            ml_manager.set_sales_df(df, filename=file.filename)
            preds = ml_manager.predict_future(num_months=months)
            unique_prods = list({p["product_name"] for p in preds})
            return {
                "horizon_months": months,
                "data_source": file.filename,
                "predictions": preds,
                "products": unique_prods,
            }

        elif filename_lower.endswith((".pkl", ".joblib")):
            ml_manager.load_custom_model(content, filename=file.filename)
            preds = ml_manager.predict_future(num_months=months)
            unique_prods = list({p["product_name"] for p in preds})
            return {
                "horizon_months": months,
                "data_source": f"Model: {file.filename} with {ml_manager.current_data_file}",
                "predictions": preds,
                "products": unique_prods,
            }

        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload a .csv file (sales history) or .pkl / .joblib (model artifact).",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file '{file.filename}': {str(e)}")
