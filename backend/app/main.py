from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import assets, specs, logs, reports, system # Added system import
import logging
import os

# Meticulous Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("OptiAsset")

app = FastAPI(
    title="OptiAsset API",
    description="Diagnostic Health Scoring System for IT Assets",
    version="0.1.0"
)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"CRITICAL SYSTEM ERROR: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal Server Error",
            "details": str(exc),
            "path": request.url.path
        },
    )

# Routing
app.include_router(assets.router, prefix="/api")
app.include_router(specs.router, prefix="/api")
app.include_router(logs.router, prefix="/api") 
app.include_router(reports.router, prefix="/api")
app.include_router(system.router, prefix="/api") # Added system router

@app.on_event("startup")
async def startup_event():
    """Verify that the 'Brains' are loaded on startup."""
    # Robust path checking relative to CWD or hardcoded if needed
    # But CWD is backend/ due to Docker/Start script usually
    model_exists = os.path.exists("data/model.pkl")
    scaler_exists = os.path.exists("data/scaler.pkl")

    if model_exists and scaler_exists:
        logger.info("🧠 OptiAsset 'Brains' (ML Model & Scaler) detected and loaded.")
    else:
        logger.warning("⚠️ OptiAsset is running without 'Brains'. Run train_model.py first.")

@app.get("/")
def root():
    return {
        "message": "OptiAsset Backend Online",
        "status": "Ready",
        "version": "0.1.0"
    }

if __name__ == "__main__":
    import uvicorn
    # Using 0.0.0.0 to allow network access if needed, port 8000 remains standard
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)