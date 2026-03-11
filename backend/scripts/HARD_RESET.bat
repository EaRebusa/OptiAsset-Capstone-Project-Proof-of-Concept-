@echo off
TITLE OptiAsset Hard Reset Utility
COLOR 0C

ECHO ========================================================
ECHO      OPTIASSET HARD RESET UTILITY
ECHO ========================================================
ECHO.
ECHO [WARNING] This will DELETE the database and ALL data.
ECHO.
ECHO 1. Ensure the Uvicorn server is STOPPED.
ECHO 2. Press any key to continue...
ECHO.
PAUSE >nul

ECHO [INFO] Locating Virtual Environment...
:: Navigate to script directory to ensure relative paths work
cd /d "%~dp0"

:: Attempt to activate venv (Adjusting for ../../../.venv pattern seen in your logs)
IF EXIST "..\..\..\.venv\Scripts\activate.bat" (
    CALL "..\..\..\.venv\Scripts\activate.bat"
) ELSE (
    ECHO [WARNING] Could not auto-detect .venv. Assuming Python is in PATH.
)

ECHO [INFO] Launching Python Script...
python "Hard Reset Utility.py"

ECHO.
ECHO ========================================================
ECHO      PROCESS COMPLETED
ECHO ========================================================
PAUSE