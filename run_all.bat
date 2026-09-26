@echo off
title AIMBULENCE Launcher
echo ============================================================
echo   AIMBULENCE - AI Emergency Hospital Runbook Executor
echo ============================================================
echo.

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "AIMBULENCE Backend" cmd /k ".\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo [2/2] Starting Next.js Frontend on http://localhost:3000 ...
start "AIMBULENCE Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================================
echo Services starting in separate console windows!
echo - Frontend Dashboard: http://localhost:3000
echo - Backend API:        http://localhost:8000
echo - Swagger Docs:       http://localhost:8000/docs
echo ============================================================
