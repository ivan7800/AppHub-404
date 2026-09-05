# AppHub 404 v2.7.2

AppHub 404 es una PWA estática y local-first para gestionar software de Windows mediante WinGet sin backend, cuentas ni telemetría. Permite explorar un catálogo curado, generar scripts de instalación/actualización/desinstalación, importar inventarios, comparar equipos, crear copias de seguridad y generar herramientas de diagnóstico y mantenimiento.

## Estado

- Versión: **2.7.2**
- Catálogo: **93 aplicaciones**
- Categorías: **13**
- Packs: **12**
- Publicación: GitHub Pages / servidor estático / apertura local de `index.html`
- Backend: no
- Dependencias runtime: no
- Telemetría: no

## Novedades v2.7.2

- Corregida la causa raíz de varios scripts defectuosos: rutas Windows dentro de template strings JavaScript podían perder barras invertidas o convertir `\v` en un carácter de control al descargar el BAT/PS1.
- Los PS1 administrativos usan una única rutina UAC basada en `ProcessStartInfo` + `runas` y reutilizan el ejecutable PowerShell real del proceso.
- Los BAT vuelven a admitir **doble clic + UAC**, pero con una implementación distinta: comprueban elevación con `fltmc` y, si hace falta, usan `ProcessStartInfo` + `UseShellExecute` + verbo `runas` sobre el propio BAT. No usan `cmd /c` ni una ruta PowerShell construida incorrectamente.
- El instalador PowerShell ejecuta `winget install` directamente, captura stdout/stderr y ya no usa `winget show/list` como bloqueo previo.
- El actualizador BAT comprueba compatibilidad de `winget pin` antes de mostrar paquetes fijados.
- Los tests ejecutan los generadores reales y comprueban que el contenido final no tenga caracteres de control ni rutas mutiladas.
- Drivers 404, programador, reparación, desinstalador y analizador usan la misma política de elevación PowerShell.

## Funciones principales

- Catálogo con búsqueda, filtros, favoritos y packs.
- Generación de instaladores PowerShell, BAT y JSON para `winget import`.
- Centro de actualización con análisis previo y `winget upgrade --all`.
- Inventario del PC mediante `tools/apphub-404-scan.ps1`.
- Health check de WinGet, App Installer, PowerShell, Defender, .NET, WebView2, WSL, Hyper-V, reinicio pendiente y espacio libre.
- Comparación de inventarios de dos equipos.
- Backup/restauración local de selección, favoritos, tema e inventarios.
- Generación de tarea programada de mantenimiento y script para retirarla.
- Reparación controlada de WinGet.
- Generación de desinstalador para la selección.
- Validador del catálogo WinGet de solo lectura.
- **Drivers 404**: backup, inventario y restauración de controladores mediante PnPUtil/DISM.
- Aplicaciones empresariales no automatizables se marcan como descarga externa y nunca entran en scripts WinGet.

## Privacidad y seguridad

AppHub funciona en el navegador y guarda preferencias en `localStorage`. Los inventarios no se envían a ningún servidor.

Los scripts administrativos:

- no almacenan credenciales;
- no usan `ExecutionPolicy Bypass`;
- no usan `--force` por defecto;
- no permiten reinicios automáticos;
- mantienen confirmación explícita antes de desinstalar/restaurar drivers;
- respetan paquetes fijados salvo que el usuario lo solicite;
- distinguen aplicaciones WinGet de enlaces externos gestionados por el fabricante.

### Elevación en v2.7.2

- **BAT:** se comprueba si el proceso ya está elevado. Si no lo está, el propio BAT solicita UAC con ShellExecute/`runas` y se relanza elevado. Si el usuario cancela UAC o una política corporativa impide el relanzamiento, queda disponible el fallback **clic derecho → Ejecutar como administrador**.
- **PowerShell:** los PS1 administrativos intentan solicitar UAC mediante `ProcessStartInfo` con verbo `runas`. Si una política corporativa bloquea esa acción, abra Windows Terminal/PowerShell como administrador y ejecute el PS1 desde esa consola.

## Uso rápido

### 1. Abrir AppHub

Puede abrir `index.html` directamente. Para probar PWA y service worker sírvase por HTTP/HTTPS, por ejemplo:

```powershell
python -m http.server 8080
```

Abra `http://localhost:8080`.

### 2. Instalar aplicaciones

1. Seleccione aplicaciones o un pack.
2. Genere **BAT** (predeterminado) o PowerShell.
3. Para BAT: haga **doble clic** y acepte UAC. Si una política lo impide, use clic derecho → **Ejecutar como administrador**.
4. Para PS1: ejecútelo con PowerShell; el script intentará solicitar UAC si es necesario.
5. Revise los códigos de salida y logs mostrados por el script.

El instalador usa `winget install --id ... -e --source ... --accept-package-agreements --accept-source-agreements --disable-interactivity`. Si no se permite actualizar una instalación existente, añade `--no-upgrade`.

### 3. Actualizar aplicaciones

Genere el actualizador BAT/PS1 desde AppHub. El actualizador usa `winget upgrade --all` y solo añade `--include-unknown` o `--include-pinned` si se seleccionan esas opciones.

### 4. Analizar un PC

```powershell
.\tools\apphub-404-scan.ps1
```

El analizador es de solo lectura respecto a instalación/desinstalación y genera un JSON importable en **Mi PC**.

### 5. Validar el catálogo

En **Herramientas del técnico → Validar catálogo WinGet**, genere el validador y ejecútelo en Windows. Solo consulta metadatos mediante `winget show` y genera un informe JSON.

### 6. Comprobar contexto administrador

`tools/test-admin-context.bat` solo indica si la consola actual está elevada. `tools/test-uac-double-click.bat` reproduce la nueva autoelevación sin usar WinGet ni modificar el equipo.

## Drivers 404

- **Backup:** `pnputil /export-driver *` y fallback `DISM /Online /Export-Driver`.
- **Inventario:** `pnputil /enum-drivers`.
- **Restauración:** `pnputil /add-driver <inf> /install`, tras confirmación `RESTAURAR`.

El backup conserva paquetes INF del Driver Store. No garantiza incluir aplicaciones, paneles o instaladores OEM del fabricante.

## GitHub Pages

1. Cree o use el repositorio `AppHub-404`.
2. Suba **el contenido de esta carpeta** a la raíz.
3. Compruebe `index.html`, `.nojekyll`, `manifest.webmanifest` y `service-worker.js`.
4. En **Settings → Pages**, despliegue desde `main` y `/(root)`.
5. Tras actualizar de versión, haga una recarga completa una vez y compruebe que la UI muestra **v2.7.2**.

Las rutas runtime son relativas y aptas para una subruta de GitHub Pages.

## Desarrollo y QA

Node.js solo es necesario para pruebas:

```bash
npm test
```

La batería v2.7.2 comprueba, entre otros puntos:

- sintaxis JavaScript;
- versión centralizada;
- catálogo, categorías, packs e IDs;
- CSP, manifest y service worker;
- exclusión de `externalOnly`;
- ejecución real de los generadores JS dentro de un sandbox de pruebas;
- ausencia de caracteres de control inesperados en BAT/PS1 generados;
- ausencia del mecanismo BAT UAC descartado;
- UAC PowerShell unificado;
- rutas del programador generadas correctamente;
- Drivers 404 y validador del catálogo.

Consulte `QA-REPORT.md`, `SECURITY.md` y `FINAL-AUDIT-REPORT.md` antes de publicar.

## Limitaciones reales

Una PWA no puede ejecutar WinGet ni inspeccionar Windows directamente. AppHub genera archivos que se ejecutan localmente.

En este paquete se han verificado estáticamente los scripts generados y se han ejecutado las pruebas JavaScript, pero el entorno de auditoría no dispone de Windows + WinGet para ejecutar todos los PS1/BAT generados. La validación física final de UAC, WinGet, Programador de tareas y PnPUtil/DISM debe realizarse en Windows 10/11.

El service worker solo funciona en contexto seguro (HTTPS o localhost), no desde `file://`.

## Licencia

Consulte `LICENSE`.

## Caché self-healing

AppHub 404 v2.7.2 protege las actualizaciones de la PWA frente a archivos de versiones anteriores. Al detectar un cambio de versión elimina únicamente las cachés cuyo nombre empieza por `apphub-404-`, conserva la caché de la versión actual y realiza una sola recarga para evitar mezclar HTML/JS de releases distintas. El service worker usa red primero para HTML, configuración, JavaScript y CSS críticos.

El botón **Limpiar caché y recargar** elimina manualmente las cachés de AppHub y solicita una actualización del service worker. No ejecuta `localStorage.clear()`: selecciones, favoritos, tema y demás preferencias locales no se borran por esta acción. Para evitar perder el soporte offline, el vaciado manual requiere conexión de red.

