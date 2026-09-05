@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

fltmc >nul 2>&1
if %errorlevel%==0 goto :elevated

echo Solicitando permisos de administrador mediante UAC...
set "APPHUB_SELF=%~f0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $q=[char]34; $arg='/d /c call ' + $q + $env:APPHUB_SELF + $q; $p=Start-Process -FilePath $env:ComSpec -Verb RunAs -ArgumentList $arg -PassThru; if($p){exit 0}else{exit 1} } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo ERROR: No se pudo obtener elevacion.
  pause
  exit /b 1
)
exit /b 0

:elevated
echo.
echo ========================================
echo   UAC OK - CONSOLA ELEVADA
 echo ========================================
echo.
whoami
net session >nul 2>&1 && echo Privilegios administrativos confirmados. || echo AVISO: no se pudo confirmar con net session.
echo.
pause
exit /b 0
