# /generate-alert Route
#
# POST /generate-alert
#   Receives machine context + anomaly data from the
#   Node.js backend, generates an AI persona message,
#   and returns it for logging and notification.

import traceback
from fastapi import APIRouter, HTTPException
from app.models.schemas import AlertRequest, AlertResponse
from app.services.gemini import generate_alert_message

router = APIRouter()


@router.post("/generate-alert", response_model=AlertResponse)
async def generate_alert(request: AlertRequest):
    """
    Generates an AI-powered, persona-based alert message.

    The machine speaks in first person to the assigned worker,
    describing its current condition and suggesting action.

    Falls back to a structured error if Gemini is unreachable.
    """
    try:
        # Call the Gemini persona engine
        message = await generate_alert_message(
            machine=request.machine,
            worker=request.worker,
            anomaly=request.anomaly,
            severity=request.severity,
        )

        print(f"🧠 [AI] Generated alert for {request.machine.name}:")
        print(f"   \"{message[:80]}...\"" if len(message) > 80 else f"   \"{message}\"")

        return AlertResponse(
            message=message,
            severity=request.severity,
            machine_name=request.machine.name,
            success=True,
        )

    except ValueError as e:
        # Config errors (missing API key, etc.)
        print(f"❌ [AI] Configuration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    except Exception as e:
        # Gemini API errors, network issues, etc.
        print(f"❌ [AI] Generation failed: {e}")
        traceback.print_exc()
        raise HTTPException(
            status_code=503,
            detail=f"AI service temporarily unavailable: {str(e)}"
        )
