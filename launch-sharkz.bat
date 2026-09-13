@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "URL=http://127.0.0.1:3000/"

echo.
echo ======================================
echo        SHARKZ.IO - STARTING
 echo ======================================
echo.

if exist "SharkzServer.exe" goto EXE

where node >nul 2>&1
if errorlevel 1 goto NONODE

if not exist "node_modules\ws\index.js" (
  echo Installing required server package...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto INSTALLFAIL
)

echo Starting Sharkz server...
start "Sharkz.io Server" /min cmd /c "cd /d "%~dp0" && node server.js"
goto OPEN

:EXE
echo Starting SharkzServer.exe...
start "Sharkz.io Server" /min "SharkzServer.exe"
goto OPEN

:OPEN
ping 127.0.0.1 -n 3 >nul

echo Opening Sharkz.io in Chrome...
start "" chrome.exe "%URL%"
if errorlevel 1 start "" "%URL%"

echo.
echo Sharkz.io is running at %URL%
echo Keep this launcher/server running while playing.
echo.
pause
exit /b 0

:NONODE
echo Node.js was not found, and SharkzServer.exe is missing.
echo Please download the complete Sharkz.io package containing SharkzServer.exe,
echo or install Node.js and run this launcher again.
pause
exit /b 1

:INSTALLFAIL
echo npm could not install the server dependency.
echo Check your internet connection and run this launcher again.
pause
exit /b 1
