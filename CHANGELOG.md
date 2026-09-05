# Changelog

## 2.7.2 — Cache self-healing

- Detecta el cambio de versión al iniciar y elimina cachés `apphub-404-*` antiguas.
- Recarga una sola vez tras un cambio de versión para evitar mezclar JS/HTML de releases distintas.
- El service worker fuerza actualización de los recursos críticos con estrategia network-first y `cache: no-store`.
- Al activar una nueva versión, elimina cachés AppHub anteriores y recarga las ventanas que seguían ejecutando la release vieja.
- Nuevo botón **Limpiar caché y recargar** que purga solo Cache Storage de AppHub, conserva preferencias/inventarios locales y actualiza el service worker.
- Se mantienen el funcionamiento offline y la caché actual tras completar la actualización.


## 2.7.2 — BAT doble clic + UAC

- Añadida autoelevación BAT al hacer doble clic mediante `ProcessStartInfo`, `UseShellExecute=true` y verbo `runas` sobre el propio BAT.
- La nueva rutina evita la cadena descartada BAT → PowerShell → `cmd /c` → BAT.
- Windows PowerShell se invoca desde `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`; los escapes del generador están cubiertos por tests sobre el BAT final.
- Si UAC se cancela o falla por política, el BAT conserva el fallback de clic derecho → Ejecutar como administrador.
- Añadido `tools/test-uac-double-click.bat`, no destructivo y sin WinGet.
- QA ampliado para ejecutar los generadores reales y exigir la rutina UAC en instalador y actualizador BAT.

## 2.7.0 — Corrección raíz de scripts Windows y release auditada

### Corregido
- Identificada la causa raíz de varios BAT/PS1 defectuosos: rutas Windows escritas dentro de template strings JavaScript con barras invertidas sin escapar. Secuencias como `\v` podían convertirse en caracteres de control y otras barras podían desaparecer al generar el archivo.
- Eliminadas las rutas rígidas de PowerShell de los generadores administrativos; los PS1 reutilizan ahora el ejecutable PowerShell real del proceso mediante `Get-Process -Id $PID`.
- Unificada la elevación UAC de instalador, actualizador, programador, retirada de tarea, reparación, desinstalador, analizador y Drivers 404 mediante `ProcessStartInfo` + verbo `runas`.
- El instalador PowerShell deja de bloquearse por `winget show`/`winget list` previos: ejecuta `winget install` directamente, captura stdout/stderr y registra el código de salida.
- Los BAT dejan de prometer autoelevación: comprueban privilegios con `fltmc` y, si no están elevados, indican de forma explícita `Ejecutar como administrador`. Se elimina el flujo BAT → PowerShell → cmd → BAT que falló repetidamente en Windows real.
- El actualizador BAT comprueba si `winget pin` existe antes de ejecutar `pin list`.
- Corregidas rutas generadas del programador (`AppHub404\Logs` y `AppHub404\Update-Apps.ps1`).
- Eliminados los tests UAC antiguos que validaban una estrategia descartada; añadido `tools/test-admin-context.bat`.

### QA
- Los smoke tests ejecutan ahora los generadores reales dentro de un sandbox JS y validan el contenido final producido.
- Añadida regresión contra caracteres de control inesperados en BAT/PS1 generados.
- Añadidas regresiones para impedir que vuelva la autoelevación BAT defectuosa, `ExecutionPolicy Bypass`, rutas Windows mutiladas y prechecks WinGet bloqueantes.
- Catálogo conservado: 93 aplicaciones, 13 categorías y 12 packs.

### Compatibilidad
- Los flags `winget install --no-upgrade`, `--disable-interactivity`, `--accept-package-agreements`, `winget upgrade --all`, `--include-unknown` y `--include-pinned` se mantienen alineados con la documentación actual de Microsoft.

## 2.6.3 - Updater PS1 + PWA cache fix

- Corrige el generador `apphub-404-update-all.ps1` con autoelevación UAC robusta mediante `-EncodedCommand`.
- Evita que `winget pin list` provoque errores en versiones de WinGet sin soporte de `pin`.
- Mantiene los fallos de punto de restauración y actualización de fuentes como no bloqueantes.
- Cambia los assets críticos de la PWA a estrategia network-first para evitar generar scripts desde JavaScript obsoleto en caché.
- Añade regresiones de versión/caché y mantiene el catálogo en 93 apps, 13 categorías y 12 packs.


## 2.6.3 - Drivers 404 UAC self-elevation fix

- Backup, inventario y restauración de drivers ya no se limitan a mostrar un aviso si no tienen privilegios.
- Los tres scripts PowerShell solicitan UAC automáticamente mediante `ProcessStartInfo` + verbo `runas`.
- Eliminada la instrucción incorrecta «Ejecutar con PowerShell como administrador».
- Se conserva la comprobación explícita de rol administrador tras el relanzamiento.

## 2.6.3 - Drivers 404

- Añadido módulo **Drivers 404** en Herramientas del técnico.
- Generador de backup de drivers con PnPUtil y fallback DISM.
- Generador de inventario de drivers de terceros.
- Generador de restauración por INF con PnPUtil, confirmación explícita y log.
- Verificación del backup mediante conteo de INF e informe README-BACKUP.txt.
- Documentada la limitación: no exporta utilidades OEM ni instaladores EXE ajenos al Driver Store.
- Caché PWA y tests actualizados a v2.6.3.

## v2.6.3 — Catálogo profesional y packs de despliegue
- Añadidos WinMerge, Visual Studio 2022 Community, Visual Studio 2022 Build Tools, Eclipse Temurin JDK 21, DB Browser for SQLite y mRemoteNG.
- Añadido Malwarebytes AdwCleaner como herramienta portátil externa con enlaces oficiales; no se genera un comando WinGet inexistente.
- Nuevos packs: Nuevo PC corporativo, Técnico CAU / Helpdesk y Desarrollador Windows.
- Catálogo ampliado a 93 aplicaciones y 12 packs, manteniendo exclusión de elementos `externalOnly` de scripts automáticos.
- Tests ampliados para validar los nuevos IDs, packs y la integración segura de AdwCleaner.

## v2.6.3 — WinGet execution fix
- El BAT ya no bloquea la instalacion con `winget show`/`winget list | findstr` previos.
- Ejecuta `winget install` directamente y muestra codigo de salida y diagnostico visible.
- Activa delayed expansion para conservar correctamente ERRORLEVEL por paquete.
- Mantiene `--no-upgrade` cuando la opcion de actualizar instaladas esta desactivada.

## v2.6.3 - UAC generator parity fix

- Los BAT generados usan ahora exactamente la rutina UAC validada manualmente en Windows mediante `fltmc`, `goto :APPHUB_ELEVATED`, `APPHUB_SELF` y `Start-Process` sobre `%ComSpec%`.
- Eliminada la comprobación administrativa PowerShell y la copia temporal del BAT generado, que divergían del test UAC funcional.
- Añadida regresión para exigir paridad entre el BAT generado y `tools/test-uac-elevation.bat`.


## 2.6.3 — UAC generated-BAT path isolation fix

- Los BAT generados ya no se relanzan directamente desde la ruta de descarga.
- Antes de solicitar UAC se copian a `%TEMP%\AppHub404\elevated-run.bat` y se eleva esa copia controlada.
- Esto evita fallos dependientes del nombre/ruta del archivo descargado (espacios, paréntesis, OneDrive u otros caracteres).
- Añadido `tools/test-generated-bat-elevation.bat` para reproducir exactamente el nuevo flujo sin ejecutar WinGet.


## 2.4.4 — UAC BAT quoting hotfix

- Corregida la autoelevación BAT en Windows: se elimina la doble pareja de comillas alrededor de `%~f0` al relanzar mediante `cmd.exe /d /c`.
- El argumento elevado pasa ahora como `/d /c "<ruta-del-bat>"`, evitando el error «El nombre de archivo, el nombre de directorio o la sintaxis de la etiqueta del volumen no son correctos».
- Añadida regresión para impedir que vuelva a generarse `""<ruta>""`.

## 2.4.4 — 2026-09-05

### Corregido
- Corregida la autoelevación UAC de los scripts BAT generados.
- El BAT ya no intenta elevar directamente el archivo `.bat` con `Start-Process`. Ahora eleva `%ComSpec%` (`cmd.exe`) y relanza el BAT original mediante `/d /c`, evitando el error de sintaxis de nombre de archivo/directorio/volumen observado en Windows.
- La ruta del BAT se transmite mediante `APPHUB_SELF` y se entrecomilla dentro de PowerShell con `[char]34`, soportando rutas con espacios sin interpolación insegura.
- El error real de elevación se muestra en consola si `Start-Process` falla.

### QA
- Añadida regresión que exige elevación vía `$env:ComSpec` y prohíbe `Start-Process -FilePath $env:APPHUB_SELF`.

## 2.4.1 — 2026-09-05

- Corregido el relanzamiento UAC de scripts PowerShell: usa Windows PowerShell por ruta fija y valida el proceso elevado.
- Corregido el relanzamiento UAC de BAT: muestra error si la elevación falla o se cancela, en vez de cerrar silenciosamente.
- BAT pasa a ser el formato recomendado y predeterminado para instalación y actualización por su ejecución directa con doble clic.
- Mensajes de interfaz aclarados para diferenciar abrir un `.ps1` de ejecutarlo realmente.
- Pruebas de regresión ampliadas para verificar el nuevo flujo de elevación.

## 2.4.0 — 2026-08-13

### Seguridad y robustez
- Filtrado de aplicaciones `externalOnly` también al restaurar y exportar backups, evitando que una copia antigua pueda reintroducirlas como instalables.
- Autoelevación PowerShell endurecida con lista de argumentos explícita y sin `ExecutionPolicy Bypass`.
- Autoelevación BAT endurecida pasando la ruta del propio script mediante variable de entorno.
- Saneado adicional de textos usados como etiquetas dentro de BAT para neutralizar metacaracteres de `cmd.exe`.

### Catálogo
- Citrix Workspace Current y LTSR dejan de mostrar versiones exactas hardcodeadas susceptibles de quedar obsoletas; la página oficial pasa a ser la referencia de versión.
- Enlace de documentación de Windows App actualizado a la ruta oficial canónica.
- Nuevo **Validador del catálogo WinGet** de solo lectura que comprueba los IDs instalables y genera un informe JSON local.

### UX/UI
- Rejilla de Herramientas del técnico adaptativa para distribuir correctamente cinco o más herramientas en escritorio, tablet y móvil.
- Textos del nuevo validador orientados a explicar con claridad que no realiza cambios en el equipo.

### QA y documentación
- Batería automática actualizada a v2.4.0 con verificaciones del validador, backups y exclusión `externalOnly`.
- README, SECURITY, QA, informe de auditoría y listado de archivos modificados actualizados.

## 2.3.0
- Ampliación empresarial, aplicaciones de trabajo remoto y descargas oficiales gestionadas.
- Autoelevación UAC añadida a scripts administrativos.
- Protección frente a instalación conjunta de Citrix Current y LTSR.

## 2.2.0
- Incorporación de Citrix Workspace Current y LTSR con enlaces oficiales de descarga offline.
- Nueva categoría y pack de empresa/trabajo remoto.

## 2.1.0
- Auditoría de seguridad, inventarios, backups, service worker, accesibilidad y scripts.

## 2.0.0
- Centro Mi PC, health check, comparación de equipos, backup/restauración y herramientas del técnico.
