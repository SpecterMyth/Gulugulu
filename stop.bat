@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "PID_FILE=%ROOT%.gulugulu.pid"

if exist "%PID_FILE%" (
  set /p PID=<"%PID_FILE%"
  if defined PID (
    echo Stopping Gulugulu process tree. PID: !PID!
    taskkill /PID !PID! /T /F >nul 2>nul
  )
  del "%PID_FILE%" >nul 2>nul
) else (
  echo No saved Gulugulu PID found.
)

echo Releasing Vite dev port 1420 if it is still in use...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING"') do (
  taskkill /PID %%P /T /F >nul 2>nul
)

echo Gulugulu stopped.
ping -n 3 127.0.0.1 >nul
