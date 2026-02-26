@echo off
setlocal

cd /d "%~dp0"

set KILLED=0
for %%A in (3000 3001) do (
  for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%%A" ^| findstr "LISTENING"') do (
    echo Stopping PID %%P on port %%A...
    taskkill /PID %%P /F >nul 2>&1
    set KILLED=1
  )
)

if "%KILLED%"=="0" (
  echo No running process found on ports 3000/3001.
) else (
  echo Project stopped.
)
