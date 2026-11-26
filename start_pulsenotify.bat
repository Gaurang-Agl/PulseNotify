@echo off
title PulseNotify Full-Stack Suite
cd /d "%~dp0"

echo ========================================================
echo       Launching PulseNotify (Consolidated Mode)
echo ========================================================
echo.

if not exist ".\venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in .\venv\
    pause
    exit /b 1
)

".\venv\Scripts\python.exe" run_all.py

echo.
echo PulseNotify stopped.
pause
