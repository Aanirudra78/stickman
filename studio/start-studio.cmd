@echo off
rem Keeps the local Studio server running outside of any terminal session.
rem Started by the "StickmanStudio" scheduled task, so it survives closing shells.
rem Loop: if node ever crashes or is killed, restart it after 5 seconds.
cd /d "%~dp0.."
if not exist "out" mkdir "out"
:loop
echo. >> "out\studio.log"
echo [start-studio] starting %DATE% %TIME% >> "out\studio.log"
node studio/server.mjs >> "out\studio.log" 2>> "out\studio.err.log"
echo [start-studio] node exited with %ERRORLEVEL% at %DATE% %TIME%, restarting in 5s >> "out\studio.log"
timeout /t 5 /nobreak >nul
goto loop
