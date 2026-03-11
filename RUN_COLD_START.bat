@echo off
TITLE OptiAsset Cold Start (Reset Demo)
COLOR 0C

:: --- Configuration ---
cd /d "%~dp0"

ECHO ========================================================
ECHO      OPTIASSET COLD START PROTOCOL
ECHO ========================================================
ECHO.
ECHO [WARNING] This will WIPE all asset data from the database.
ECHO           Use this to reset the system for a fresh demo.
ECHO.
PAUSE

:: 1. Virtual Environment Auto-Detection
SET VENV_FOUND=0
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
    ECHO [INFO] Activating Virtual Environment...
    CALL "%VENV_PATH%"
) ELSE (
    ECHO [WARNING] No Virtual Environment detected. Attempting global Python...
)

:: 2. Set Python Path so imports work correctly
SET PYTHONPATH=%PYTHONPATH%;%CD%\backend

:: 3. Run the Python Script
ECHO [INFO] Executing Cold Start Logic...
python "backend/scripts/Cold Start.py"

ECHO.
ECHO ========================================================
ECHO      OPERATION COMPLETE
ECHO ========================================================
PAUSE