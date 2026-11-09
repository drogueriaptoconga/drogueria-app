@echo off
setlocal
title Actualizar Drogueria App

cd /d "%~dp0.."

echo ============================================
echo  ACTUALIZAR DROGUERIA APP DESDE GIT
echo ============================================
echo.
echo Se revisaran los cambios publicados en GitHub.
echo Si hay cambios de backend, el servidor se reiniciara
echo y la sesion actual se cerrara.
echo.
echo NO ejecutar esto en medio de una venta.
echo.
choice /C SN /M "Continuar con la actualizacion? (S/N)"
if errorlevel 2 goto cancel
if errorlevel 1 goto run

:cancel
echo.
echo Actualizacion cancelada.
pause
exit /b 0

:run
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

"%NODE_EXE%" scripts\auto-deploy.js

echo.
echo ============================================
echo  PROCESO TERMINADO
echo ============================================
echo Revisa el mensaje de arriba.
pause
endlocal
