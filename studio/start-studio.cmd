@echo off
rem Runs the local Studio server. Safe to call repeatedly: if something is
rem already listening on the studio port it just exits.
rem Launched by the "StickmanStudio" scheduled task every minute, so the server
rem heals itself if it is ever killed (closing a terminal, reboot, crash).
setlocal
cd /d "%~dp0.."
if not exist "out" mkdir "out"

rem Do not pop a browser window on every automatic restart.
set STUDIO_NO_OPEN=1

netstat -ano | findstr ":4321" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 exit /b 0

:loop
echo [studio-daemon] starting %DATE% %TIME% >> "out\studio.log"
node studio/server.mjs >> "out\studio.log" 2>> "out\studio.err.log"
echo [studio-daemon] node exited %ERRORLEVEL% at %DATE% %TIME%, retry in 3s >> "out\studio.log"
ping -n 4 127.0.0.1 >nul
goto loop
