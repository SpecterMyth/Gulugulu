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

if exist "%PID_FILE%" (
  set /p OLD_PID=<"%PID_FILE%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "if ($env:OLD_PID -match '^\d+$' -and (Get-Process -Id ([int]$env:OLD_PID) -ErrorAction SilentlyContinue)) { exit 0 } else { exit 1 }"
  if not errorlevel 1 (
    echo Gulugulu already appears to be running. PID: !OLD_PID!
    echo Use stop.bat first if you want to restart it.
    pause
    exit /b 0
  )
  del "%PID_FILE%" >nul 2>nul
)

if not exist "%APP_DIR%\node_modules" (
  echo Installing npm dependencies...
  pushd "%APP_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo npm install failed.
    pause
    exit /b 1
  )
  popd
)

echo Starting Gulugulu...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Start-Process -FilePath 'cmd.exe' -WorkingDirectory '%APP_DIR%' -ArgumentList @('/k', 'npm run tauri:dev') -WindowStyle Normal -PassThru; Set-Content -LiteralPath '%PID_FILE%' -Value $p.Id -Encoding ASCII"

echo Gulugulu started.
echo Use stop.bat to stop it.
ping -n 3 127.0.0.1 >nul
