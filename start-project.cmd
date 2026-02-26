@echo off
setlocal

cd /d "%~dp0"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  echo Port 3000 is already in use. PID: %%P
  echo Open: http://localhost:3000
  exit /b 0
)

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting project...
echo Open: http://localhost:3000
call npm run dev
