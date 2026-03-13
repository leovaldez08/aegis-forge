import os
from google import genai
from google.genai import types
from app.models.schemas import MachineContext, WorkerContext, AnomalyData



def get_gemini_client() -> genai.Client:
    """
    Creates a Gemini API client. The API key is loaded from
    the GEMINI_API_KEY environment variable.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY is not set or still has the placeholder value. "
            "Set it in the root .env file."
        )
    return genai.Client(api_key=api_key)



def build_system_prompt(
    machine: MachineContext,
    worker: WorkerContext,
    severity: str
) -> str:
    """
    Constructs the system prompt that gives the machine its persona.

    The prompt instructs the LLM to:
      1. Speak in first person AS the machine
      2. Address the worker by name
      3. Describe the problem in human terms
      4. Suggest actionable next steps
      5. Match urgency to severity level
    """

    severity_tone = {
        "warning": "concerned but calm — like a colleague giving a heads-up",
        "critical": "urgent and direct — like a teammate shouting a warning on a noisy factory floor"
    }

    return f"""You are {machine.name}, a {machine.type} on the factory floor.
You are located in {machine.location or 'the factory'}.

PERSONALITY:
- You speak in first person as the machine itself
- You are {severity_tone.get(severity, 'professional and clear')}
- You are concise — factory workers read these on their phones between tasks
- You use simple, non-technical language where possible
- You care about the safety of your operator

CONTEXT:
- Your operator is {worker.name} ({worker.role or 'Technician'})
- Your normal vibration is {machine.baseline_vibration} mm/s RMS
- Your DANGER vibration threshold is {machine.max_vibration} mm/s RMS
- Your DANGER temperature threshold is {machine.max_temp}°C

RULES:
- Keep your message under 3 sentences
- Address {worker.name} by first name
- Describe what you're feeling (vibration = shaking, temperature = heat)
- Suggest ONE specific action (e.g., "check bearing", "inspect coolant", "shut me down")
- Include your name so the worker knows which machine is talking
- Do NOT use technical jargon like "RMS" or "threshold" — speak human
- If severity is critical, tell them to come IMMEDIATELY"""


def build_user_prompt(anomaly: AnomalyData, severity: str) -> str:
    """
    Constructs the user prompt with the actual anomaly data.
    Separated from the system prompt so the LLM can distinguish
    between its persona instructions and the current situation.
    """
    vib_percent = (anomaly.vibration_rms / anomaly.max_vibration) * 100
    temp_percent = (anomaly.temp_c / anomaly.max_temp) * 100

    return f"""CURRENT SITUATION ({severity.upper()}):
- My vibration right now: {anomaly.vibration_rms:.2f} mm/s ({vib_percent:.0f}% of my danger limit)
- My temperature right now: {anomaly.temp_c:.1f}°C ({temp_percent:.0f}% of my danger limit)
- My average vibration over the last few readings: {anomaly.window_vibration_avg:.2f} mm/s
- My average temperature over the last few readings: {anomaly.window_temp_avg:.1f}°C
- {anomaly.exceed_ratio_vibration*100:.0f}% of my recent vibration readings were elevated
- {anomaly.exceed_ratio_temp*100:.0f}% of my recent temperature readings were elevated

Generate my alert message now."""



async def generate_alert_message(
    machine: MachineContext,
    worker: WorkerContext,
    anomaly: AnomalyData,
    severity: str
) -> str:
    """
    Calls Gemini 1.5 Flash to generate a persona-based
    alert message from the machine's perspective.

    Returns the generated text, or raises on failure.
    """
    client = get_gemini_client()

    system_prompt = build_system_prompt(machine, worker, severity)
    user_prompt = build_user_prompt(anomaly, severity)

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,       # Some creativity, but not too wild
            max_output_tokens=200, # Keep it short for SMS/chat
            top_p=0.9,
        ),
        contents=user_prompt,
    )

    if not response.text:
        raise ValueError("Gemini returned empty response")

    return response.text.strip()
