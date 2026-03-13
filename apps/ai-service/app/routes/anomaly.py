import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from sklearn.ensemble import IsolationForest

router = APIRouter()

class MachineStats(BaseModel):
    baseline_vibration: float
    max_vibration: float
    max_temp: float

class TelemetryPoint(BaseModel):
    vibration_rms: float
    temp_c: float

class AnomalyDetectRequest(BaseModel):
    machine: MachineStats
    window: List[TelemetryPoint]

class AnomalyDetectResponse(BaseModel):
    is_anomaly: bool
    score: float
    severity: str

@router.post("/detect-anomaly", response_model=AnomalyDetectResponse)
async def detect_anomaly(req: AnomalyDetectRequest):
    """
    Stateless ML anomaly detection.
    Generates a synthetic dataset of 'normal' behavior based on the machine's stated baseline.
    Fits an Isolation Forest, then predicts whether the recent window contains anomalies.
    """
    try:
        if len(req.window) == 0:
            return AnomalyDetectResponse(is_anomaly=False, score=1.0, severity="healthy")

        # 1. Generate Synthetic Normal Data 
        # (Based on standard machine operations: temp ~40C, vib around baseline +- 10%)
        np.random.seed(42)  # For deterministic behavior in demo
        num_synthetic = 100
        
        # Synthetic vibrations: centered around baseline, strict variance
        normal_vibs = np.random.normal(req.machine.baseline_vibration, req.machine.baseline_vibration * 0.1, num_synthetic)
        # Synthetic temps: centered around 40C, modest variance
        normal_temps = np.random.normal(40.0, 5.0, num_synthetic)
        
        X_train = np.column_stack((normal_vibs, normal_temps))

        # 2. Extract the actual window data
        actual_vibs = [p.vibration_rms for p in req.window]
        actual_temps = [p.temp_c for p in req.window]
        X_test = np.column_stack((actual_vibs, actual_temps))

        # 3. Fit the Isolation Forest
        # contamination=0.05 implies we expect 5% true anomalies in typical long-term data
        clf = IsolationForest(contamination=0.05, random_state=42)
        clf.fit(X_train)

        # 4. Predict the window
        # pred = 1 (normal), -1 (anomaly)
        preds = clf.predict(X_test)
        # Scores: lower (negative) is more anomalous
        scores = clf.score_samples(X_test)

        # We evaluate the latest reading (most recent) to trigger the actual alert
        latest_pred = preds[-1]
        latest_score = scores[-1]

        # 5. Deterministic fallback for ultimate safety limits (Cyber-Physical System best practice)
        # ML is great for subtle trends, but if the machine is literally on fire, we bypass ML.
        latest_point = req.window[-1]
        hard_critical = (latest_point.vibration_rms >= req.machine.max_vibration) or \
                        (latest_point.temp_c >= req.machine.max_temp)

        is_anomaly = (latest_pred == -1) or hard_critical
        
        severity = "healthy"
        if hard_critical:
            severity = "critical"
        elif is_anomaly:
            severity = "warning"

        return AnomalyDetectResponse(
            is_anomaly=bool(is_anomaly),
            score=float(latest_score),
            severity=severity
        )

    except Exception as e:
        print(f"❌ [ML] Isolation Forest Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
