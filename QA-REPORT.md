# QA Report — AppHub 404 v2.7.2

## Resultado automático

Comando:

```text
npm test
```

Resultado:

```text
OK v2.7.2: 93 apps, 13 categorías, 12 packs; CSP, PWA, inventario, backups, validación de catálogo y scripts auditados.
```

## Cambio validado — BAT doble clic + UAC

Los tests ejecutan los generadores reales `generateBatch()` y `generateUpdaterBatch()` y validan el BAT final producido.

Se exige:

- `fltmc` para detectar si el BAT ya está elevado;
- `APPHUB_SELF=%~f0` para conservar la ruta real del propio BAT;
- Windows PowerShell desde `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`;
- `System.Diagnostics.ProcessStartInfo`;
- `UseShellExecute = $true`;
- verbo `runas` aplicado al propio BAT;
- fallback visible si UAC se cancela o falla;
- ausencia de la antigua cadena `Start-Process ... $env:ComSpec` / `cmd /c`;
- ausencia de `ExecutionPolicy Bypass`;
- ausencia de caracteres de control inesperados en el BAT generado.

El instalador BAT activa `DelayedExpansion` únicamente después de terminar la fase de autoelevación, para no alterar la ruta del propio script durante el relanzamiento.

## Prueba no destructiva incluida

`tools/test-uac-double-click.bat` contiene el mismo mecanismo de elevación, no usa WinGet y no modifica el sistema. Tras aceptar UAC debe mostrar:

```text
UAC OK - APPHUB 404 ESTA ELEVADO
```

## Regresiones generales

| Prueba | Estado |
|---|---|
| `node --check app.js` | ✅ |
| `node --check system-tools.js` | ✅ |
| `node --check smoke.mjs` | ✅ |
| generadores BAT/PS1 ejecutados en VM Node | ✅ |
| scripts generados sin caracteres de control | ✅ |
| catálogo 93 / categorías 13 / packs 12 | ✅ |
| CSP/PWA/rutas relativas | ✅ |
| secretos | ✅ sin hallazgos |
| UAC físico Windows por doble clic | ⏳ no ejecutado en este entorno |
| WinGet físico Windows | ⏳ no ejecutado en este entorno |

## Casos Windows de aceptación

1. Doble clic en `tools/test-uac-double-click.bat` → UAC → `UAC OK`.
2. Generar BAT con 7-Zip → doble clic → UAC → instalación/estado WinGet.
3. Repetir desde una ruta con espacios y paréntesis.
4. Cancelar UAC → mensaje de error visible y fallback manual.
5. Ejecutar el mismo BAT con clic derecho → debe continuar sin un segundo UAC.
6. Actualizador BAT → doble clic → UAC → `winget upgrade`.

## Estado QA

**PASS CON LIMITACIONES**: generación, regresión y estructura verificadas; UAC/WinGet físicos requieren Windows 10/11.

## v2.7.2 — Cache self-healing

- ✅ Versión sincronizada en package/config/UI/service worker.
- ✅ `healCacheOnStartup()` se ejecuta al iniciar.
- ✅ La purga automática se limita a claves `apphub-404-*` y conserva la caché actual.
- ✅ El service worker elimina cachés AppHub antiguas al activar una release nueva.
- ✅ Los recursos críticos usan network-first con `cache: 'no-store'`.
- ✅ Una activación que sustituye una caché anterior recarga clientes abiertos para evitar JS viejo.
- ✅ Existe botón `Limpiar caché y recargar`.
- ✅ La limpieza manual no usa `localStorage.clear()` y exige red antes de borrar la caché actual.
- ✅ `npm test` y `node --check` superados tras los cambios.
- ⏳ Actualización real desde una PWA v2.7.1 instalada en navegador/dispositivo: no ejecutada en este entorno.
