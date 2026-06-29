@echo off
REM ============================================================
REM  OrbitPanel launcher - drives the USB LCD dashboard.
REM  Double-click to run. Right-click > "Run as administrator"
REM  if you want CPU temperature (needs elevation).
REM ============================================================
cd /d "%~dp0"

REM Optional: show the Claude 5-hour usage bar by setting your plan's token cap.
REM Uncomment and set your number:
REM set "CLAUDE_5H_TOKEN_LIMIT=88000000"

if not exist "node_modules" (
  echo First run - installing dependencies...
  call npm install
)

REM Electron drives the control window; if it's missing (partial/--production install)
REM there is no UI. Reinstall so the window can open.
if not exist "node_modules\electron" (
  echo Electron not found - installing dependencies so the control window can open...
  call npm install
)

if not exist "apps\probehost\bin\Release\net9.0\ProbeHost.dll" (
  echo Building sensor host ^(.NET^)...
  call dotnet build apps\probehost -c Release
)

echo Starting OrbitPanel - the control window should open; a tray icon also appears.
call npm run -w @orbitpanel/engine tray

echo.
echo OrbitPanel exited. If no window appeared, scroll up for [ui]/[startup] lines or an
echo electron error, and ensure Node.js (and the .NET 9 SDK for sensors) are installed.
pause
