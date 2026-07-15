@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "PID_FILE=%ROOT%.gulugulu.pid"

call :stop_saved_pid "%PID_FILE%" "Gulugulu"

echo Releasing Vite/Tauri ports if they are still in use...
for %%A in (1420) do (
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%%A" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /T /F >nul 2>nul
  )
)

echo Gulugulu stopped.
ping -n 3 127.0.0.1 >nul
exit /b 0

:stop_saved_pid
if exist "%~1" (
  set /p PID=<"%~1"
  if defined PID (
    echo Stopping %~2 process tree. PID: !PID!
    taskkill /PID !PID! /T /F >nul 2>nul
  )
  del "%~1" >nul 2>nul
) else (
  echo No saved %~2 PID found.
)
exit /b 0
