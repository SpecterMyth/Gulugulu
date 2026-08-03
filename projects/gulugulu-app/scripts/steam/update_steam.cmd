@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update_steam.ps1" %*
set "GULUGULU_EXIT=%ERRORLEVEL%"
if not "%GULUGULU_EXIT%"=="0" (
  echo.
  echo Steam update failed with exit code %GULUGULU_EXIT%.
  pause
)
exit /b %GULUGULU_EXIT%
