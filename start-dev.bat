@echo off
echo Starting C1X Attendance Intelligence System...
echo.

echo Starting Backend Server...
start "Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

timeout /t 3 /nobreak > nul

echo Starting Frontend Development Server...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
pause