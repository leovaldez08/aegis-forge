from pydantic import BaseModel, Field


class MachineContext(BaseModel):
    """Machine data passed from the Node.js backend."""
    name: str = Field(..., description="Machine identifier, e.g. 'CNC_Lathe_01'")
    type: str = Field(..., description="Machine type, e.g. 'CNC Lathe'")
    location: str | None = Field(None, description="Factory zone location")
    baseline_vibration: float = Field(..., description="Normal operating vibration (mm/s RMS)")
    max_vibration: float = Field(..., description="Critical vibration threshold")
    max_temp: float = Field(..., description="Critical temperature threshold (°C)")


class WorkerContext(BaseModel):
    """Assigned worker info for personalized alerts."""
    name: str = Field(..., description="Worker's name")
    role: str | None = Field("Technician", description="Worker's role/title")


class AnomalyData(BaseModel):
    """Telemetry snapshot that triggered the alert."""
    vibration_rms: float = Field(..., description="Current vibration reading")
    temp_c: float = Field(..., description="Current temperature reading")
    max_vibration: float = Field(..., description="Machine's max vibration threshold")
    max_temp: float = Field(..., description="Machine's max temp threshold")
    baseline_vibration: float = Field(..., description="Machine's baseline vibration")
    window_vibration_avg: float = Field(..., description="Avg vibration over sliding window")
    window_temp_avg: float = Field(..., description="Avg temperature over sliding window")
    exceed_ratio_vibration: float = Field(..., description="% of window exceeding warning level")
    exceed_ratio_temp: float = Field(..., description="% of window exceeding warning level")


class AlertRequest(BaseModel):
    """Full request payload for alert generation."""
    machine: MachineContext
    worker: WorkerContext
    anomaly: AnomalyData
    severity: str = Field(..., description="'warning' or 'critical'")


class AlertResponse(BaseModel):
    """Response from the AI service."""
    message: str = Field(..., description="AI-generated persona alert message")
    severity: str = Field(..., description="Echoed severity level")
    machine_name: str = Field(..., description="Machine that generated the alert")
    success: bool = Field(True, description="Whether AI generation succeeded")
