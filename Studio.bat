@echo off
REM Launches OrbitPanel Studio (the visual editor) at http://localhost:5173
cd /d "%~dp0"

if not exist "node_modules" (
  echo First run - installing dependencies...
  call npm install
)

echo Opening Studio at http://localhost:5173 ...
start "" http://localhost:5173
call npm run -w @orbitpanel/studio dev

echo.
echo Studio stopped. Ensure Node.js is installed if it failed.
pause
