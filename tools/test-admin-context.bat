@echo off
setlocal EnableExtensions
title AppHub 404 - Comprobacion de administrador
fltmc >nul 2>&1
if errorlevel 1 (
  echo NO ADMIN - Este proceso no esta elevado.
  echo Usa clic derecho sobre el BAT y elige Ejecutar como administrador.
  pause
  exit /b 1
)
echo ADMIN OK - La consola esta elevada.
pause
exit /b 0
