@echo off
setlocal

rem Change these values to preview another character.
set "PORT=3000"
set "CHARACTER=guluduck"
set "PREVIEW_PATH=/animations/%CHARACTER%/preview.html"

rem If you prefer to paste a complete URL, edit this line directly.
set "PREVIEW_URL=http://127.0.0.1:%PORT%%PREVIEW_PATH%"

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "ROOT_DIR=%%~fI"
set "APP_DIR=%ROOT_DIR%\projects\gulugulu-app"

if not exist "%APP_DIR%\package.json" (
  echo Cannot find Gulugulu app at:
  echo   %APP_DIR%
  echo.
  pause
  exit /b 1
)

if not exist "%APP_DIR%\node_modules" (
  echo Missing node_modules. Run npm install first in:
  echo   %APP_DIR%
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$conn = Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue; if ($conn) { exit 0 } else { exit 1 }"

if errorlevel 1 (
  echo Starting animation preview server on port %PORT%...
  start "Gulugulu Animation Preview Server" /D "%APP_DIR%" /min cmd /k npm run dev -- --host 127.0.0.1 --port %PORT% --strictPort false

  echo Waiting for preview server...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$url = '%PREVIEW_URL%'; for ($i = 0; $i -lt 30; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 1; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } } catch { Start-Sleep -Milliseconds 500 } }; exit 1"

  if errorlevel 1 (
    echo Preview server did not respond:
    echo   %PREVIEW_URL%
    echo.
    pause
    exit /b 1
  )
) else (
  echo Preview server is already running on port %PORT%.
)

echo Opening:
echo   %PREVIEW_URL%
start "" "%PREVIEW_URL%"

endlocal
