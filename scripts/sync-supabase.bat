@echo off
setlocal

cd /d "%~dp0.."

if not exist "logs" mkdir "logs"

set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

echo [%date% %time%] Iniciando sincronizacion con Supabase >> "logs\supabase-sync.log"
"%NODE_EXE%" scripts\sync-to-supabase.js >> "logs\supabase-sync.log" 2>&1
echo [%date% %time%] Finalizo con codigo %ERRORLEVEL% >> "logs\supabase-sync.log"

endlocal
