@echo off
setlocal

cd /d "%~dp0.."

if not exist "logs" mkdir "logs"

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo [%date% %time%] Iniciando auto-deploy >> "logs\auto-deploy.log"
"%NODE_EXE%" scripts\auto-deploy.js >> "logs\auto-deploy.log" 2>&1
echo [%date% %time%] Finalizo con codigo %ERRORLEVEL% >> "logs\auto-deploy.log"

endlocal
