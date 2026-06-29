@echo off
REM ============================================================
REM  OrbitPanel launcher - drives the USB LCD dashboard.
REM  Double-click to run. Right-click > "Run as administrator"
REM  if you want CPU temperature (needs elevation).
REM ============================================================
cd /d "%~dp0"

REM Self-elevate so CPU temperature works (LibreHardwareMonitor's ring0 driver needs admin).
REM If UAC is declined, keep running without CPU temp rather than failing.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator for CPU temperature...
  powershell -NoProfile -Command "try { Start-Process -FilePath '%~f0' -Verb RunAs } catch { exit 1 }"
  if errorlevel 1 (echo Elevation declined - continuing without CPU temperature.) else (exit /b)
)

REM Claude usage bar: 5h billable-token cap, calibrated so the panel matches Claude /usage
REM (calibrated at 22.7M billable = 27%). Codex auto-detects its own % — no setting needed.
REM Re-calibrate anytime: cap = current_billable_tokens / (claude_usage_percent / 100).
set "CLAUDE_5H_TOKEN_LIMIT=84000000"

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
