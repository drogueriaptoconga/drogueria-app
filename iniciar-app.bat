@echo off
ECHO Iniciando la aplicacion de drogueria...
ECHO.

:: Verificar y cerrar cualquier proceso de Node.js existente.
ECHO Verificando si hay servidores de la aplicacion en funcionamiento...
taskkill /IM node.exe /F > nul 2>&1
ECHO.

:: Iniciar el servidor del backend en una nueva ventana.
ECHO Iniciando el servidor del backend...
start "Servidor Backend" cmd /k "npm start"
ECHO Servidor del backend iniciado en http://localhost:3001
ECHO.

:: Navegar a la carpeta del frontend e iniciar el servidor en otra nueva ventana.
ECHO Iniciando el servidor del frontend...
cd "fronted"
start "Aplicacion Frontend" cmd /k "npm start"
cd..

ECHO La aplicacion esta en funcionamiento.
ECHO NO CIERRES las dos ventanas de terminal que se abrieron.
ECHO Si se cierra alguna por error, simplemente abre este archivo de nuevo.
