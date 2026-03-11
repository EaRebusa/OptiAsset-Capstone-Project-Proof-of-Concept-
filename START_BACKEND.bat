@echo off
TITLE OptiAsset Backend Server
COLOR 0A

:: --- Configuration ---
:: Set the path to your virtual environment relative to this script
:: Based on your input: ..\.venv
SET VENV_PATH=..\.venv\Scripts\activate.bat

:: Change directory to the folder containing this script
cd /d "%~dp0"

ECHO ========================================================
ECHO      STARTING OPTIASSET BACKEND
ECHO ========================================================

:: 1. Activate Virtual Environment
IF EXIST "%VENV_PATH%" (
    ECHO [INFO] Activating Virtual Environment...
    CALL "%VENV_PATH%"
) ELSE (
    ECHO [WARNING] Virtual environment not found at: %VENV_PATH%
    ECHO [INFO] Attempting to run with global Python...
)

:: 2. Navigate to backend directory
IF EXIST "backend" (
    cd backend
) ELSE (
    ECHO [ERROR] 'backend' directory not found!
    PAUSE
    EXIT /B 1
)

:: 3. Run Uvicorn
ECHO [INFO] Launching Uvicorn Server...
ECHO [INFO] Server will be available at: http://127.0.0.1:8000
ECHO.
uvicorn app.main:app --reload

:: Keep window open if it crashes
PAUSE