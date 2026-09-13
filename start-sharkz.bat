@echo off
setlocal
cd /d "%~dp0"

echo.
echo ======================================
echo       SHARKZ.IO MULTIPLAYER
echo ======================================
echo.

if not exist "%~dp0SharkzServer.exe" (
    echo ERROR: SharkzServer.exe was not found.
    echo Make sure you extracted the COMPLETE SharkzServer-Windows ZIP.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0index.html" (
    echo ERROR: index.html was not found.
    echo Make sure you extracted the COMPLETE SharkzServer-Windows ZIP.
    echo.
    pause
    exit /b 1
)

echo Starting Sharkz server...
start "Sharkz.io Server" /min "%~dp0SharkzServer.exe"

echo Waiting for the server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 30;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3000/' -TimeoutSec 1;if($r.StatusCode -eq 200){$ok=$true;break}}catch{};Start-Sleep -Milliseconds 500}; if(-not $ok){exit 1}"
if errorlevel 1 (
    echo.
    echo ERROR: SharkzServer.exe did not start on port 3000.
    echo.
    pause
    exit /b 1
)

echo Opening Sharkz.io...
start "" "http://127.0.0.1:3000/"

echo.
echo Sharkz.io is running!
echo Host: http://127.0.0.1:3000/
echo Keep the Sharkz server running while playing.
echo.
pause
endlocal
