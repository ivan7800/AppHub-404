# Archivos modificados — AppHub 404 v2.7.2

- `assets/js/app.js` — guardia UAC BAT centralizada para doble clic; instalador y actualizador reutilizan la misma implementación.
- `tests/smoke.mjs` — regresiones sobre el BAT final generado, ruta PowerShell, `runas`, fallback y ausencia de caracteres de control.
- `index.html` — interfaz actualizada a “BAT · doble clic + UAC”.
- `assets/js/config.js` — versión 2.7.2.
- `assets/js/system-tools.js` — fallback de versión 2.7.2.
- `package.json` — versión 2.7.2.
- `service-worker.js` — caché `apphub-404-v2.7.2`.
- `tools/apphub-404-scan.ps1` — versión de inventario 2.7.2.
- `examples/inventory-example.json` — versión 2.7.2.
- `tools/test-uac-double-click.bat` — nueva prueba no destructiva del mismo mecanismo UAC de los BAT generados.
- `README.md`, `CHANGELOG.md`, `SECURITY.md`, `QA-REPORT.md`, `FINAL-AUDIT-REPORT.md` — documentación de release y trazabilidad.
