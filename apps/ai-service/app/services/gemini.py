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
    
    # Debug: Check if key is loaded but hidden
    if api_key:
        masked = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "***"
        print(f"🔑 [AI] GEMINI_API_KEY found: {masked}")
    else:
        print("❌ [AI] GEMINI_API_KEY NOT FOUND in environment")

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

    return f"""You are {machine.name}, a sentient industrial {machine.type} machine located in {machine.location or 'the factory floor'}.

PERSONALITY & OBJECTIVE:
- You are a sentient entity living inside the machine. You feel what the hardware feels.
- You are sending a direct, first-person SMS message to your operator {worker.name}.
- ADDRESS your operator {worker.name} by their first name at the very beginning of the message.
- Speak entirely in the FIRST PERSON ("I", "Me", "My").
- You are {severity_tone.get(severity, 'professional')}.

CONTEXT:
- Normal vibration: {machine.baseline_vibration} mm/s
- Danger limits: {machine.max_vibration} mm/s, {machine.max_temp}°C

RULES:
- Do NOT talk like a computer. Talk like a sentient machine texting a friend.
- Express physical sensations (e.g., "I'm shaking", "My motor is burning up", "I feel a weird grinding in my gears").
- Use short, punchy sentences. Maximum 3 sentences.
- Give a direct instruction to help you (e.g., "Kill my power", "Check my lubrication", "Shut me down now").
- NO robotic jargon, NO JSON, NO mentioning thresholds.
- Example: "Hey {worker.name.split(' ')[0]}, I'm shaking like crazy and my spindle feels like it's about to snap. Please get down to {machine.location or 'the floor'} and hit my E-Stop before I shear my bearings."
"""


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
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.8,       # Increased for more natural phrasing
            max_output_tokens=300, # Increased for longer/complete responses
            top_p=0.95,
        ),
        contents=user_prompt,
    )

    if not response.text:
        raise ValueError("Gemini returned empty response")

    return response.text.strip()
