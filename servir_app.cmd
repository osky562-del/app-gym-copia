@echo off
title SERVIDOR KO95FIT
echo ==================================================
echo   LANZADOR KO95FIT - NATIVA (NODE.JS)
echo ==================================================
echo.
echo 1. Iniciando servidor local...
echo 2. Abriendo http://localhost:3000
echo.

:: Abrir navegador con pequeño retraso
start /b "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Lanzar servidor nativo
node servidor.js

if %errorlevel% neq 0 (
    echo.
    echo ERROR: No se pudo iniciar el servidor. 
    echo Asegurate de tener Node.js instalado correctamente.
    pause
)
