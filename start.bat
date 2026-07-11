@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "APP_DIR=%ROOT%projects\gulugulu-app"
set "AVATAR_DIR=%ROOT%projects\services\avatar-gen"
set "PID_FILE=%ROOT%.gulugulu.pid"
set "AVATAR_PID_FILE=%ROOT%.gulugulu-avatar-gen.pid"

if not exist "%APP_DIR%\package.json" (
  echo Cannot find app package.json:
  echo %APP_DIR%\package.json
  pause
  exit /b 1
)

if not exist "%AVATAR_DIR%\package.json" (
  echo Cannot find avatar generator package.json:
  echo %AVATAR_DIR%\package.json
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

if not exist "%AVATAR_DIR%\node_modules" (
  echo Installing avatar generator npm dependencies...
  pushd "%AVATAR_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo npm install failed for avatar generator.
    pause
    exit /b 1
  )
  popd
)

call :ensure_process "%AVATAR_PID_FILE%" AVATAR_RUNNING
if "!AVATAR_RUNNING!"=="1" (
  set /p AVATAR_PID=<"%AVATAR_PID_FILE%"
  echo Avatar generator already appears to be running. PID: !AVATAR_PID!
) else (
  echo Starting Gulugulu avatar generator on http://127.0.0.1:4177 ...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$env:PORT = if ($env:PORT) { $env:PORT } else { '4178' }; $p = Start-Process -FilePath 'cmd.exe' -WorkingDirectory '%AVATAR_DIR%' -ArgumentList @('/k', 'npm run dev') -WindowStyle Normal -PassThru; Set-Content -LiteralPath '%AVATAR_PID_FILE%' -Value $p.Id -Encoding ASCII"
)

echo Waiting for avatar generator API and web UI...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$urls = @('http://127.0.0.1:4178/api/jobs', 'http://127.0.0.1:4177'); foreach ($url in $urls) { $ok = $false; for ($i = 0; $i -lt 60; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ok = $true; break } } catch { Start-Sleep -Milliseconds 500 } }; if (-not $ok) { Write-Host ('Avatar generator did not respond: ' + $url); exit 1 } }"
if errorlevel 1 (
  echo Avatar generator failed to start.
  echo Check the avatar generator window for details.
  pause
  exit /b 1
)

call :ensure_process "%PID_FILE%" APP_RUNNING
if "!APP_RUNNING!"=="1" (
  set /p APP_PID=<"%PID_FILE%"
  echo Gulugulu already appears to be running. PID: !APP_PID!
) else (
  echo Starting Gulugulu desktop app...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$env:AVATAR_GEN_URL = if ($env:AVATAR_GEN_URL) { $env:AVATAR_GEN_URL } else { 'http://127.0.0.1:4177' }; $p = Start-Process -FilePath 'cmd.exe' -WorkingDirectory '%APP_DIR%' -ArgumentList @('/k', 'npm run tauri:dev') -WindowStyle Normal -PassThru; Set-Content -LiteralPath '%PID_FILE%' -Value $p.Id -Encoding ASCII"
)

echo.
echo Gulugulu is running.
echo Avatar generator: http://127.0.0.1:4177
echo Use stop.bat to stop both services.
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
