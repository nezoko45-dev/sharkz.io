@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run Sharkz.io.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\ws (
  echo Installing Sharkz.io server package...
  call npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)
start "Sharkz.io Server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "Sharkz.io" "http://localhost:3000/"
endlocal
