# Archivos modificados — AppHub 404 v2.4.4

Comparado con v2.3.0:

| Archivo | Cambio principal |
|---|---|
| `CHANGELOG.md` | Registro completo de v2.4.4. |
| `README.md` | Documentación actual, 86 apps, validador, seguridad y GitHub Pages. |
| `SECURITY.md` | Modelo de seguridad, UAC, backups y validador de solo lectura. |
| `assets/css/styles.css` | Rejilla de herramientas responsive para 5+ tarjetas y limpieza de comentario de versión. |
| `assets/js/app.js` | Filtro `externalOnly` al restaurar, UAC/BAT endurecido y saneado de etiquetas BAT. |
| `assets/js/apps-data.js` | Citrix sin versiones volátiles hardcodeadas y enlace canónico de Windows App. |
| `assets/js/config.js` | Versión 2.4.4. |
| `assets/js/system-tools.js` | Backup filtrado, UAC endurecido y generador del validador WinGet. |
| `examples/inventory-example.json` | Versión de ejemplo 2.4.4. |
| `index.html` | Versión visible y nueva herramienta “Validar catálogo WinGet”. |
| `package.json` | Versión 2.4.4. |
| `service-worker.js` | Caché versionada v2.4.4. |
| `tests/smoke.mjs` | Nuevas regresiones de backups, UAC y validador. |
| `tools/apphub-404-scan.ps1` | Versión 2.4.4 y relanzamiento UAC con argumentos explícitos. |
| `FINAL-AUDIT-REPORT.md` | Informe final de auditoría v2.4.4. |
| `QA-REPORT.md` | Evidencia de verificación y limitaciones. |
| `FILES-MODIFIED.md` | Este inventario de cambios. |

## Archivos no modificados funcionalmente

Se conservaron manifest, iconos, licencia, workflow de calidad y estructura general porque no presentaban un problema que justificara cambios.
