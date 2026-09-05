@echo off
setlocal EnableExtensions DisableDelayedExpansion
title AppHub 404 - Test UAC doble clic
fltmc >nul 2>&1
if not errorlevel 1 goto :APPHUB_ELEVATED

echo Solicitando permisos de administrador mediante UAC...
set "APPHUB_SELF=%~f0"
set "APPHUB_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%APPHUB_PS%" goto :APPHUB_UAC_FAILED
"%APPHUB_PS%" -NoLogo -NoProfile -Command "$Psi = New-Object System.Diagnostics.ProcessStartInfo; $Psi.FileName = $env:APPHUB_SELF; $Psi.UseShellExecute = $true; $Psi.Verb = 'runas'; $Psi.WorkingDirectory = [IO.Path]::GetDirectoryName($env:APPHUB_SELF); try { $Elevated = [Diagnostics.Process]::Start($Psi); if ($null -eq $Elevated) { exit 1 } } catch { Write-Error $_.Exception.Message; exit 1 }"
if errorlevel 1 goto :APPHUB_UAC_FAILED
exit /b 0

:APPHUB_UAC_FAILED
echo ERROR: No se pudo obtener elevacion UAC o se cancelo la solicitud.
echo Alternativa: clic derecho sobre el BAT y elige Ejecutar como administrador.
pause
exit /b 1

:APPHUB_ELEVATED
echo.
echo ========================================
echo UAC OK - APPHUB 404 ESTA ELEVADO
whoami
echo ========================================
echo.
pause
exit /b 0
