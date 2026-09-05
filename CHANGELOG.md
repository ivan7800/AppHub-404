## v2.4.7 — WinGet execution fix
- El BAT ya no bloquea la instalacion con `winget show`/`winget list | findstr` previos.
- Ejecuta `winget install` directamente y muestra codigo de salida y diagnostico visible.
- Activa delayed expansion para conservar correctamente ERRORLEVEL por paquete.
- Mantiene `--no-upgrade` cuando la opcion de actualizar instaladas esta desactivada.

# Changelog
## v2.4.7 - UAC generator parity fix

- Los BAT generados usan ahora exactamente la rutina UAC validada manualmente en Windows mediante `fltmc`, `goto :APPHUB_ELEVATED`, `APPHUB_SELF` y `Start-Process` sobre `%ComSpec%`.
- Eliminada la comprobación administrativa PowerShell y la copia temporal del BAT generado, que divergían del test UAC funcional.
- Añadida regresión para exigir paridad entre el BAT generado y `tools/test-uac-elevation.bat`.


## 2.4.7 — UAC generated-BAT path isolation fix

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
