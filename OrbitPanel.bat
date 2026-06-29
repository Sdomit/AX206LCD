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

if not exist "apps\probehost\bin\Release\net9.0\ProbeHost.dll" (
  echo Building sensor host ^(.NET^)...
  call dotnet build apps\probehost -c Release
)

echo Starting OrbitPanel - right-click the tray icon to quit.
call npm run -w @orbitpanel/engine tray

echo.
echo OrbitPanel exited. If it failed, ensure Node.js and the .NET 9 SDK are installed.
pause
