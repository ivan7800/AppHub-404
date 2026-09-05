# AppHub 404 v2.4.4

AppHub 404 es una PWA estática y local-first para gestionar software de Windows mediante WinGet sin backend, cuentas ni telemetría. Permite explorar un catálogo curado, generar scripts de instalación/actualización/desinstalación, importar inventarios, comparar equipos, crear copias de seguridad y generar herramientas de diagnóstico y mantenimiento.

## Estado

- Versión: **2.4.4**
- Catálogo: **86 aplicaciones**
- Categorías: **13**
- Packs: **9**
- Publicación: GitHub Pages / servidor estático / apertura local de `index.html`
- Backend: no
- Dependencias runtime: no
- Telemetría: no

## Funciones principales

- Catálogo con búsqueda, filtros, favoritos y packs.
- Generación de instaladores PowerShell, BAT y JSON para `winget import`.
- Centro de actualización con análisis previo y `winget upgrade --all`.
- Elevación UAC para operaciones administrativas, sin `ExecutionPolicy Bypass`.
- Inventario del PC mediante `tools/apphub-404-scan.ps1`.
- Health check de WinGet, App Installer, PowerShell, Defender, .NET, WebView2, WSL, Hyper-V, reinicio pendiente y espacio libre.
- Comparación de inventarios de dos equipos.
- Backup/restauración local de selección, favoritos, tema e inventarios.
- Generación de tarea programada de mantenimiento y script para retirarla.
- Reparación controlada de WinGet.
- Generación de desinstalador para la selección.
- **Validador del catálogo WinGet de solo lectura**: comprueba cada ID instalable con `winget show` y produce un informe JSON con los paquetes no disponibles.
- Aplicaciones empresariales que no deben automatizarse mediante WinGet se marcan como **descarga externa** y nunca se incorporan a los scripts.

## Privacidad y seguridad

AppHub funciona en el navegador y guarda sus preferencias en `localStorage`. Los inventarios no se envían a ningún servidor.

Los scripts administrativos:

- solicitan elevación mediante UAC cuando es necesaria;
- no almacenan credenciales;
- no usan `ExecutionPolicy Bypass`;
- no usan `--force` por defecto;
- no permiten reinicios automáticos;
- mantienen confirmación explícita antes de desinstalar;
- respetan paquetes fijados salvo que el usuario lo solicite;
- distinguen aplicaciones WinGet de enlaces externos gestionados por el fabricante.

El analizador del PC es de solo lectura. Por defecto no exporta la lista completa del Registro; solo incluye su recuento. `-IncludeDiagnosticText` añade texto técnico adicional y debe usarse solo cuando se necesite diagnosticar.

## Uso rápido

### 1. Abrir AppHub

Puede abrirse directamente con `index.html`. Para probar la PWA y el service worker debe servirse por HTTP/HTTPS, por ejemplo:

```powershell
python -m http.server 8080
```

Después abra `http://localhost:8080`.

### 2. Instalar aplicaciones

Seleccione aplicaciones o un pack y genere un `.bat`, `.ps1` o JSON. Para el uso normal se recomienda **BAT**: haga doble clic y el propio archivo solicitará UAC. Use PowerShell si necesita revisar o adaptar el script; debe ejecutarlo con PowerShell, no abrirlo en un editor.

### 3. Analizar un PC

Ejecute:

```powershell
.\tools\apphub-404-scan.ps1
```

El script solicita UAC si es necesario y genera un JSON que puede importarse en **Mi PC**.

### 4. Validar que el catálogo sigue vigente

En **Herramientas del técnico → Validar catálogo WinGet**, genere `apphub-404-validar-catalogo.ps1` y ejecútelo en Windows. El script solo consulta metadatos con `winget show`; no instala, actualiza ni desinstala nada. Genera un informe JSON en el Escritorio.

## GitHub Pages

1. Cree un repositorio, por ejemplo `AppHub-404`.
2. Suba **el contenido de esta carpeta**, no la carpeta contenedora.
3. Compruebe que `index.html`, `.nojekyll`, `manifest.webmanifest` y `service-worker.js` están en la raíz.
4. En GitHub abra **Settings → Pages**.
5. Seleccione **Deploy from a branch**.
6. Rama: `main`.
7. Carpeta: `/(root)`.
8. Guarde y abra la URL publicada.
9. Haga una recarga completa tras la primera publicación y pruebe la instalación PWA/offline bajo HTTPS.

Todas las rutas runtime son relativas y están preparadas para una subruta de GitHub Pages.

## Desarrollo y QA

Requiere Node.js solo para las pruebas, no para ejecutar la aplicación:

```bash
npm test
```

La prueba estática cubre, entre otros puntos:

- versión centralizada;
- catálogo, categorías y packs;
- IDs duplicados y referencias rotas;
- CSP;
- manifest y service worker;
- saneado de inventarios y backups;
- exclusión de aplicaciones externas de scripts y restauraciones;
- generadores administrativos y elevación UAC;
- validador WinGet de solo lectura.

Consulte `QA-REPORT.md`, `SECURITY.md` y `FINAL-AUDIT-REPORT.md` antes de publicar.

## Limitaciones reales

Una PWA no puede ejecutar WinGet ni inspeccionar Windows directamente. AppHub genera scripts revisables que el usuario ejecuta localmente. La disponibilidad de un ID WinGet puede cambiar después de publicar la PWA; por eso v2.4.4 incorpora el validador local del catálogo.

La ejecución real de UAC, WinGet, PowerShell y el Programador de tareas debe validarse en Windows 10/11. El service worker solo funciona en contexto seguro (HTTPS o localhost), no desde `file://`.

## Licencia

Consulte `LICENSE`.
