import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.alert import router as alert_router

# Load env from monorepo root
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle events."""
    print("\n══════════════════════════════════════════")
    print(" AEGIS NODE — AI Microservice Online")
    print(f" Gemini API Key: {'✓ configured' if os.getenv('GEMINI_API_KEY') and os.getenv('GEMINI_API_KEY') != 'your_gemini_api_key_here' else '✗ NOT SET'}")
    print(" Endpoint: POST /generate-alert")
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
        },
    }
