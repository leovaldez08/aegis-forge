import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.alert import router as alert_router
from app.routes.anomaly import router as anomaly_router

# Load env from monorepo root
def load_root_env():
    # Try multiple search depths to find .env starting from this file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    potential_root = current_dir
    for _ in range(5):  # Search up to 5 levels up
        env_path = os.path.join(potential_root, ".env")
        if os.path.exists(env_path):
            load_dotenv(env_path)
            # Also try to set it for the process explicitly if load_dotenv is fussy
            with open(env_path, 'r') as f:
                for line in f:
                    if '=' in line and not line.startswith('#'):
                        k, v = line.strip().split('=', 1)
                        os.environ[k] = v
            return True
        potential_root = os.path.dirname(potential_root)
    return False

load_root_env()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle events."""
    print("\n══════════════════════════════════════════")
    print(" AEGIS NODE — AI Microservice Online")
    print(" Endpoint: POST /generate-alert")
    print(" Endpoint: POST /detect-anomaly (Isolation Forest)")
    print("══════════════════════════════════════════\n")
    yield
    print("\n🛑 [AI] Shutting down AI microservice...")

app = FastAPI(
    title="Aegis Node AI Service",
    description="Agentic AI persona engine — gives industrial machines a human voice",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permissive for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(alert_router)
app.include_router(anomaly_router)

@app.get("/health")
async def health():
    return {
        "status": "operational",
        "service": "aegis-ai-service",
        "model": "gemini-2.0-flash",
    }

@app.get("/")
async def root():
    return {
        "name": "Aegis Node AI Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "generate_alert": "POST /generate-alert",
            "detect_anomaly": "POST /detect-anomaly"
        },
    }
