@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "APP_DIR=%ROOT%projects\gulugulu-app"
set "PID_FILE=%ROOT%.gulugulu.pid"

if not exist "%APP_DIR%\package.json" (
  echo Cannot find app package.json:
  echo %APP_DIR%\package.json
  pause
  exit /b 1
)

if not exist "%APP_DIR%\node_modules" (
  echo Installing Gulugulu app npm dependencies...
  pushd "%APP_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo npm install failed for Gulugulu app.
    pause
    exit /b 1
  )
  popd
)

call :ensure_process "%PID_FILE%" APP_RUNNING
if "!APP_RUNNING!"=="1" (
  set /p APP_PID=<"%PID_FILE%"
  echo Gulugulu already appears to be running. PID: !APP_PID!
) else (
  echo Starting Gulugulu desktop app...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p = Start-Process -FilePath 'cmd.exe' -WorkingDirectory '%APP_DIR%' -ArgumentList @('/k', 'npm run tauri:dev') -WindowStyle Normal -PassThru; Set-Content -LiteralPath '%PID_FILE%' -Value $p.Id -Encoding ASCII"
)

echo.
echo Gulugulu is running.
echo Use stop.bat to stop it.
ping -n 3 127.0.0.1 >nul
exit /b 0

:ensure_process
set "%~2=0"
if exist "%~1" (
  set /p CHECK_PID=<"%~1"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "if ($env:CHECK_PID -match '^\d+$' -and (Get-Process -Id ([int]$env:CHECK_PID) -ErrorAction SilentlyContinue)) { exit 0 } else { exit 1 }"
  if not errorlevel 1 (
    set "%~2=1"
  ) else (
    del "%~1" >nul 2>nul
  )
)
exit /b 0
