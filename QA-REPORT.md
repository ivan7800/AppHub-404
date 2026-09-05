# QA Report — AppHub 404 v2.4.7

Fecha: 2026-08-13

## Resultado ejecutivo

**PASS estático / candidato estable para GitHub Pages.**

No se han detectado bloqueos críticos en estructura, sintaxis, rutas locales, manifest, service worker o tests propios. Las operaciones reales de WinGet/PowerShell siguen requiriendo Windows para una validación end-to-end.

## Pruebas ejecutadas

### Tests del proyecto

```text
npm test
OK v2.4.7: 86 apps, 13 categorías, 9 packs; CSP, PWA, inventario, backups, validación de catálogo y scripts auditados.
```

### JavaScript

`node --check` superado para:

- `assets/js/app.js`
- `assets/js/apps-data.js`
- `assets/js/config.js`
- `assets/js/system-tools.js`
- `service-worker.js`

### JSON/PWA

Parseo correcto de:

- `package.json`
- `manifest.webmanifest`
- `examples/inventory-example.json`

Iconos comprobados:

- `icon-192.png`: 192×192
- `icon-512.png`: 512×512
- `icon-maskable-512.png`: 512×512

### CSS

`assets/css/styles.css` parseado con `tinycss2` sin errores de sintaxis.

### HTML y accesibilidad estática

- 35 botones analizados.
- 9 enlaces analizados.
- 34 controles de formulario analizados.
- 0 controles sin nombre accesible según análisis estático.
- 0 anclas internas rotas.
- 0 rutas locales HTML ausentes.

### Compatibilidad de archivos

- 25 archivos en el árbol auditado antes de generar documentación de entrega externa.
- Ningún nombre con caracteres incompatibles comunes de Windows/GitHub.
- Archivo runtime mayor: `assets/js/system-tools.js`, ~40 KB.
- Sin dependencias runtime externas.

### Servidor estático local

Respuesta HTTP 200 confirmada para:

- `index.html`
- `manifest.webmanifest`
- `service-worker.js`
- `assets/css/styles.css`
- `assets/js/app.js`
- `assets/js/apps-data.js`
- `assets/js/system-tools.js`
- `tools/apphub-404-scan.ps1`
- `examples/inventory-example.json`
- `assets/icons/icon-192.png`

## Regresiones específicas v2.4.7

Comprobadas por tests/código:

- backups no restauran aplicaciones `externalOnly` a la selección;
- exportación/importación de backup aplica la misma regla;
- UAC PowerShell usa argumentos explícitos;
- BAT usa `APPHUB_SELF` para relanzarse;
- etiquetas BAT se saneam frente a metacaracteres de `cmd.exe`;
- validador de catálogo existe y usa esquema `apphub-404-catalog-validation-v1`;
- validador no instala, actualiza ni desinstala;
- service worker usa caché v2.4.7;
- versión centralizada v2.4.7.

## Pruebas no completadas

### Windows real

Este entorno no dispone de `pwsh`, Windows PowerShell ni WinGet. No se han ejecutado:

- instalación real;
- actualización real;
- desinstalación real;
- UAC real;
- creación/eliminación real de tareas;
- reparación real de App Installer/WinGet;
- importación/exportación real contra WinGet.

### Navegador gráfico automatizado

Chromium existe en el entorno, pero el intento headless no completó por fallo GPU/DBus del contenedor. Por tanto no se afirma una prueba visual automatizada end-to-end de v2.4.7.

## Matriz recomendada antes de 10/10

| Plataforma | Prueba |
|---|---|
| Windows 11 + PowerShell 7 | instalación, update, uninstall, scanner, validator |
| Windows 11 + PowerShell 5.1 | scanner y scripts compatibles |
| Windows 10 compatible con WinGet | flujo completo |
| Edge/Chrome/Firefox | catálogo, diálogos, descargas, backup |
| iPhone/iPad/Android | responsive, navegación, diálogos |
| GitHub Pages HTTPS | PWA install/offline/update SW |
| NVDA/Narrator/VoiceOver | navegación y anuncios dinámicos |

## Veredicto QA

**9,1/10.** La capa estática y de generación queda bien cubierta; la nota está limitada por la ausencia de ejecución real de la capa Windows y de E2E visual fiable en este entorno.

## Prueba UAC aislada v2.4.7

Se incluye `tools/test-uac-elevation.bat`. No instala software ni ejecuta WinGet. Sirve exclusivamente para comprobar el flujo: BAT sin elevar -> PowerShell -> `Start-Process -Verb RunAs` sobre `%ComSpec%` -> `cmd /d /c call "ruta-del-bat"` -> BAT elevado.
