# AppHub 404 v2.7.2 — Informe de cambio UAC BAT

## Objetivo

Permitir que los BAT generados por AppHub soliciten elevación UAC al hacer doble clic, manteniendo como fallback el flujo manual que ya funciona: **clic derecho → Ejecutar como administrador**.

## Nivel

**Nivel 4 — permisos/elevación administrativa**, con BUG HUNTER, SECURITY, QA, QA adversarial y RELEASE.

## Criterios de aceptación

- Un BAT no elevado detecta el contexto y solicita UAC.
- El relanzamiento usa el propio BAT, no `cmd /c` ni una copia temporal.
- La ruta del BAT no se concatena dentro de una cadena PowerShell vulnerable a quoting.
- La ruta de Windows PowerShell generada no contiene escapes JavaScript corruptos.
- Si UAC se cancela/falla, el BAT no queda bloqueado ni cierra silenciosamente: muestra fallback manual.
- Si el BAT ya está elevado, no vuelve a solicitar UAC.
- Instalador y actualizador comparten una única implementación.
- Los tests inspeccionan el **BAT final generado**.

## Implementación

Se añadió `batchAdminGuard()` en `assets/js/app.js`.

Flujo:

1. `fltmc` detecta privilegios.
2. Si ya es administrador → `:APPHUB_ELEVATED`.
3. Si no → guarda `%~f0` en `APPHUB_SELF`.
4. Invoca `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`.
5. PowerShell crea `ProcessStartInfo` con:
   - `FileName = $env:APPHUB_SELF`
   - `UseShellExecute = $true`
   - `Verb = 'runas'`
6. Windows Shell solicita UAC y relanza el propio BAT.
7. Si el usuario cancela o una política bloquea la acción → `:APPHUB_UAC_FAILED` y fallback manual.

No se utiliza la cadena anterior PowerShell → `cmd /c` → BAT.

## Revisión adversarial

Comprobado:

- rutas con espacios: la ruta se transmite mediante variable de entorno, no se interpola en `-Command`;
- caracteres de control: test automático sobre la salida del generador;
- `\v1.0`: escapes dobles en el template JavaScript y comprobación del BAT final;
- UAC cancelado: salida no cero + mensaje visible;
- ejecución ya elevada: salto directo, sin relanzamiento;
- compatibilidad con el fallback manual existente.

## Matriz de verificación

| Comprobación | Estado | Evidencia |
|---|---|---|
| Sintaxis JS | ✅ Verificado | `node --check` |
| Smoke/regresión | ✅ Verificado | `npm test` |
| BAT instalador generado | ✅ Verificado | generador real ejecutado en Node |
| BAT actualizador generado | ✅ Verificado | generador real ejecutado en Node |
| Ruta PowerShell final correcta | ✅ Verificado | test sobre salida generada |
| Sin caracteres de control | ✅ Verificado | test automático |
| Fallback UAC | ✅ Verificado estáticamente | etiquetas y códigos de salida |
| UAC físico al doble clic | ⏳ No ejecutado | requiere Windows |
| WinGet físico tras UAC | ⏳ No ejecutado | requiere Windows |

## Estado

**RELEASE CANDIDATE / PUBLICABLE CON LIMITACIONES** hasta completar la prueba física de UAC en Windows.

## RELEASE GATE: PASS CON LIMITACIONES

**Motivo:** no quedan bloqueantes conocidos en la generación o arquitectura del BAT y la nueva implementación usa ShellExecute/`runas`, pero el consentimiento UAC no puede ejecutarse físicamente en este entorno.

**Bloqueantes:** ninguno conocido en código.

**No verificado:** doble clic → UAC → relanzamiento en Windows 10/11 y ejecución real de WinGet tras elevar.

## Addendum v2.7.2 — Cache self-healing

Se añadió autocuración de caché para evitar mezclar assets de releases distintas. El arranque registra la versión local, elimina únicamente cachés AppHub antiguas y recarga una sola vez cuando detecta cambio. El service worker aplica network-first + `no-store` a recursos críticos y, cuando reemplaza una caché anterior, toma control y recarga las ventanas abiertas. Se añadió limpieza manual de caché AppHub sin borrar preferencias de `localStorage`.

**Estado específico:** verificado estáticamente y mediante regresión automatizada; actualización física de una PWA instalada desde v2.7.1 queda NO VERIFICADA en este entorno.
