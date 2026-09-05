# Seguridad — AppHub 404 v2.7.2

## Modelo

AppHub 404 es una PWA estática. No tiene backend, autenticación, cookies de sesión, telemetría ni almacenamiento remoto. Las preferencias e inventarios importados se mantienen en el navegador.

## Superficie de riesgo principal

La principal superficie sensible no es la PWA en sí, sino los **scripts administrativos que genera** para ejecutarse después en Windows.

### Controles aplicados

- Los paquetes automatizables se identifican mediante IDs WinGet del catálogo; los elementos `externalOnly` nunca entran en scripts automáticos.
- Los comandos WinGet usan argumentos separados/entrecomillados y no construyen comandos a partir de texto libre del usuario.
- No se generan credenciales, tokens ni secretos.
- No se usa `--force` por defecto.
- No se usa `--allow-reboot`.
- No se usa `ExecutionPolicy Bypass` en v2.7.2.
- Desinstalación y restauración de drivers exigen confirmación explícita.
- Drivers 404 no elimina paquetes ni fuerza downgrades.
- El analizador de inventario no instala, actualiza ni desinstala software.

## UAC y privilegios

### BAT y UAC

En v2.7.2 los BAT generados:

1. comprueban elevación mediante `fltmc`;
2. si ya están elevados, continúan sin relanzarse;
3. si no lo están, conservan su ruta real mediante `%~f0`;
4. invocan Windows PowerShell desde `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`;
5. crean `ProcessStartInfo` con `UseShellExecute = $true` y verbo `runas` sobre el propio BAT;
6. si UAC se cancela o falla, muestran un error visible y mantienen como fallback el menú **Ejecutar como administrador**.

No se utiliza la antigua cadena `cmd /c`, ni copias temporales del BAT, ni `ExecutionPolicy Bypass`.

## PowerShell

Los PS1 administrativos comparten una guardia de elevación basada en:

- comprobación de `WindowsPrincipal`;
- identificación del ejecutable PowerShell actual mediante `Get-Process -Id $PID`;
- `System.Diagnostics.ProcessStartInfo`;
- `UseShellExecute = $true`;
- verbo `runas`.

No se construye una ruta `System32\WindowsPowerShell\v1.0\powershell.exe` dentro de templates JavaScript, evitando la corrupción de barras invertidas detectada en versiones anteriores.

## Causa raíz de escapes corregida desde 2.7.0

Las versiones previas contenían rutas Windows dentro de template strings JavaScript con barras simples. JavaScript interpreta secuencias de escape antes de producir el archivo descargado. En especial `\v` puede convertirse en un carácter de control vertical-tab y otras secuencias pueden perder la barra invertida.

La v2.7.2 mantiene estas correcciones:

- elimina esas rutas rígidas de los generadores UAC;
- escapa correctamente las rutas que sí deben aparecer como texto generado;
- ejecuta los generadores reales durante QA;
- rechaza scripts generados con caracteres de control inesperados.

## CSP y enlaces

La CSP mantiene `style-src 'self'` sin `unsafe-inline`. Los enlaces externos se aíslan con `noopener noreferrer` cuando se abren en nueva pestaña.

## Catálogo cambiante

Los IDs WinGet pueden cambiar después de publicar la PWA. AppHub incluye un validador local de solo lectura que ejecuta `winget show` por paquete y genera un informe JSON. Esta validación no instala ni modifica software.

## Límites

- La ejecución final depende de Windows, WinGet, políticas UAC/AppLocker/WDAC y de los instaladores de terceros.
- Un paquete WinGet válido puede fallar por red, proxy, arquitectura, política corporativa, licencia o cambios del editor.
- El backup de drivers exporta paquetes INF del Driver Store, no todas las utilidades OEM.
- Esta auditoría no sustituye pruebas en un equipo Windows administrado con las políticas reales de la organización.
