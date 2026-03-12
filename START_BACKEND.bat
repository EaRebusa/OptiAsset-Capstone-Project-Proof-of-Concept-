@echo off
TITLE OptiAsset Backend Server
COLOR 0A

:: --- Configuration ---
cd /d "%~dp0"

ECHO ========================================================
ECHO      STARTING OPTIASSET BACKEND
ECHO ========================================================

:: 1. Virtual Environment Auto-Detection
SET VENV_FOUND=0

:: Check common locations relative to this script
IF EXIST "backend\venv\Scripts\activate.bat" (
    SET VENV_PATH=backend\venv\Scripts\activate.bat
    SET VENV_FOUND=1
) ELSE IF EXIST "backend\.venv\Scripts\activate.bat" (
    SET VENV_PATH=backend\.venv\Scripts\activate.bat
    SET VENV_FOUND=1
) ELSE IF EXIST ".venv\Scripts\activate.bat" (
    SET VENV_PATH=.venv\Scripts\activate.bat
    SET VENV_FOUND=1
) ELSE IF EXIST "venv\Scripts\activate.bat" (
    SET VENV_PATH=venv\Scripts\activate.bat
    SET VENV_FOUND=1
)

IF %VENV_FOUND%==1 (
    ECHO [INFO] Found Virtual Environment: %VENV_PATH%
    CALL "%VENV_PATH%"
) ELSE (
    ECHO [WARNING] No Virtual Environment detected in standard locations.
    ECHO [INFO] Attempting to run with global Python...
)

:: 2. Dependency Check & Installation (Optional but Safer)
:: Checks if FastAPI is installed. If not, installs requirements.
python -c "import fastapi" 2>NUL
IF %ERRORLEVEL% NEQ 0 (
    ECHO [WARNING] Core dependencies missing. Installing...
    pip install -r backend/requirements.txt
)

:: 3. Navigate to backend directory
IF EXIST "backend" (
    cd backend
) ELSE (
    ECHO [ERROR] 'backend' directory not found!
    PAUSE
    EXIT /B 1
)

:: 4. Run Uvicorn
ECHO [INFO] Launching Uvicorn Server...
ECHO [INFO] Server will be available at: http://127.0.0.1:8000
ECHO.
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

:: Keep window open if it crashes
IF %ERRORLEVEL% NEQ 0 (
    ECHO.
    ECHO [ERROR] Server crashed or stopped unexpectedly.
    PAUSE
)
