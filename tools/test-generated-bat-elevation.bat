@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -Command "$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); if($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){exit 0}else{exit 1}" >nul 2>&1
if errorlevel 1 (
  echo Solicitando permisos de administrador mediante UAC...
  set "APPHUB_ELEVATE_DIR=%TEMP%\AppHub404"
  set "APPHUB_ELEVATE_BAT=%TEMP%\AppHub404\elevated-run.bat"
  if not exist "%TEMP%\AppHub404" mkdir "%TEMP%\AppHub404" >nul 2>&1
  copy /Y "%~f0" "%TEMP%\AppHub404\elevated-run.bat" >nul
  if errorlevel 1 (
    echo ERROR: No se pudo preparar la copia temporal para elevacion.
    pause
    exit /b 1
  )
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $q=[char]34; $arg='/d /c call ' + $q + $env:APPHUB_ELEVATE_BAT + $q; $p=Start-Process -FilePath $env:ComSpec -Verb RunAs -ArgumentList $arg -PassThru; if($p){exit 0}else{exit 1} } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
  if errorlevel 1 (
    echo ERROR: No se pudo obtener elevacion.
    pause
    exit /b 1
  )
  exit /b 0
)

echo.
echo ========================================
echo   APPHUB BAT GENERADO - UAC OK
echo ========================================
echo.
whoami
net session >nul 2>&1 && echo Privilegios administrativos confirmados. || echo AVISO: no se pudo confirmar con net session.
echo.
pause
exit /b 0
