# AppHub 404 v2.4.4 — Informe final de auditoría

Fecha de auditoría: **13 de agosto de 2026**

## 1. Resumen ejecutivo

AppHub 404 v2.3.0 partía de una base técnica sólida: PWA estática, sin backend ni dependencias runtime, catálogo estructurado, CSP restrictiva, scripts generados de forma local y pruebas automáticas propias. La auditoría no ha encontrado ningún bloqueo crítico para GitHub Pages.

Sí se localizaron tres riesgos de impacto alto antes de publicar una nueva versión: una copia de seguridad antigua podía reintroducir en la selección aplicaciones marcadas como descarga externa; la autoelevación generada tenía un tratamiento de rutas/argumentos mejorable; y el catálogo no disponía de una forma integrada de verificar desde Windows si sus identificadores WinGet seguían disponibles. También había deuda media en versiones hardcodeadas de Citrix y documentación desactualizada.

La versión corregida **v2.4.4** resuelve esos puntos, añade un validador de catálogo WinGet de solo lectura, endurece UAC/BAT, sanea mejor la restauración, elimina versiones Citrix volátiles de la interfaz y mejora la distribución responsive de las herramientas.

**Veredicto:** lista para publicar como release estable en GitHub Pages, con una puntuación global de **9,3/10**. No se eleva a 9,5 porque no ha sido posible ejecutar la matriz Windows real ni completar una regresión visual automatizada con navegador en este entorno.

## 2. Problemas críticos encontrados

**Ninguno.**

No se han encontrado problemas que bloqueen la carga de `index.html`, la publicación estática, el manifest, el service worker, las rutas locales o la ejecución del JavaScript a nivel sintáctico.

## 3. Problemas altos encontrados

### A. Restauración de selección demasiado permisiva

Una copia de seguridad creada en otra versión podía contener IDs de aplicaciones `externalOnly`. La restauración comprobaba que el ID existiera, pero no volvía a verificar que siguiera siendo instalable. Esto podía contaminar la selección con software que AppHub había decidido tratar solo como descarga oficial externa.

**Corregido:** tanto restauración como exportación/importación de backup filtran ahora `externalOnly` contra el catálogo actual.

### B. Autoelevación UAC con argumentos mejorables

Los scripts PowerShell construían una cadena única para relanzarse como administrador. Los BAT insertaban su ruta directamente dentro de un comando PowerShell. Funcionaba en rutas comunes, pero era menos robusto ante rutas con caracteres especiales.

**Corregido:** PowerShell utiliza una lista explícita de argumentos; BAT transmite la ruta mediante una variable de entorno antes de `RunAs`. Se mantiene UAC normal, sin credenciales y sin `ExecutionPolicy Bypass`.

### C. Deriva temporal del catálogo WinGet

Un catálogo estático puede quedarse desactualizado aunque la PWA siga funcionando. No existía una herramienta propia para validar los IDs desde el sistema de destino.

**Corregido:** nueva herramienta **Validar catálogo WinGet**, de solo lectura. Genera un `.ps1` que ejecuta `winget show` exacto contra todos los paquetes automatizables y produce un informe JSON local.

## 4. Problemas medios y bajos

### Medios

- Citrix Workspace Current y LTSR mostraban números de versión concretos susceptibles de caducar antes que la propia URL oficial.
- La documentación mantenía referencias de versión y recuentos antiguos.
- La rejilla de herramientas estaba pensada para cuatro tarjetas y la quinta quedaba visualmente desequilibrada.
- La URL de documentación de Windows App no era la ruta canónica actual.

### Bajos

- Comentarios internos conservaban una referencia a v2.3.0.
- Faltaba documentar claramente la nueva estrategia de validación del catálogo y los límites reales del entorno estático.

Todos estos puntos se han corregido.

## 5. Correcciones realizadas

- Versión centralizada en **2.4.4**.
- Restauración de selección filtrada contra `externalOnly`.
- Backup exportado/importado con la misma protección.
- UAC PowerShell relanzado mediante lista explícita de argumentos.
- BAT autoelevable endurecido para rutas especiales.
- Saneado adicional de nombres/requisitos incluidos en BAT frente a metacaracteres de `cmd.exe`.
- Nuevo generador `apphub-404-validar-catalogo.ps1`.
- Citrix Current/LTSR dejan de hardcodear versiones exactas en la UI.
- Windows App apunta a documentación oficial canónica.
- README, SECURITY, CHANGELOG, QA y documentación de entrega renovados.
- Tests smoke ampliados para cubrir estas regresiones.

## 6. Mejoras UX/UI aplicadas

- Quinta herramienta integrada sin romper la jerarquía visual.
- `tools-grid` pasa a una rejilla autoajustable en vez de una cuadrícula rígida de cuatro columnas.
- La nueva herramienta explica explícitamente que la validación es de solo lectura.
- Las fichas Citrix muestran `Current Release` / `LTSR` en lugar de aparentar que AppHub garantiza una versión fija eternamente.
- Se mantiene la identidad oscura/premium existente y no se rehace innecesariamente la interfaz.

## 7. Mejoras móviles aplicadas

- La rejilla de herramientas reparte correctamente 5 o más tarjetas mediante `auto-fit/minmax`.
- Se conservan los breakpoints existentes para dos columnas en tablet y una columna en móvil.
- Navegación superior desplazable, diálogos, toasts y acciones móviles se mantienen intactos.
- La auditoría estática no ha encontrado controles sin nombre, anclas internas rotas ni referencias locales ausentes.

## 8. Mejoras de seguridad aplicadas

- CSP existente mantenida sin `unsafe-inline`/`unsafe-eval` para scripts.
- Sin dependencias runtime ni CDN.
- Ninguna credencial embebida.
- UAC normal mediante `RunAs`; no se intenta evitarlo.
- Sin `ExecutionPolicy Bypass`.
- Aplicaciones externas excluidas también al restaurar backups antiguos.
- Validador WinGet estrictamente de lectura.
- Saneado adicional de texto antes de insertarlo en BAT.
- Service worker mantiene aislamiento por mismo origen y caché versionada v2.4.4.

## 9. Mejoras de rendimiento aplicadas

No se detectó un problema de rendimiento estructural. La aplicación sigue siendo muy ligera y sin frameworks/runtime externos. No se añadieron dependencias para resolver problemas que pueden solucionarse con JavaScript/CSS nativos.

La nueva función de validación se genera como script bajo demanda y no añade trabajo de red ni CPU a la PWA durante el uso normal.

## 10. Verificación final

Superado:

- `npm test`.
- `node --check` para JavaScript y service worker.
- parseo JSON de `package.json`, manifest e inventario de ejemplo.
- parseo CSS con `tinycss2` sin errores.
- iconos PWA 192×192, 512×512 y maskable 512×512.
- 0 anclas internas rotas.
- 0 recursos locales HTML ausentes.
- 0 botones/enlaces sin nombre accesible en auditoría estática.
- 0 inputs/selects/textareas sin etiqueta accesible en auditoría estática.
- nombres de archivos compatibles con GitHub/Windows.
- recursos críticos servidos por HTTP con estado 200.
- 86 aplicaciones, 13 categorías y 9 packs en los tests.
- catálogo sin IDs duplicados y packs sin referencias inexistentes, según la batería del proyecto.
- exclusión de software `externalOnly` de scripts y backups restaurados.
- caché PWA actualizada a v2.4.4.

No se ha podido ejecutar PowerShell/WinGet porque este entorno no es Windows. Chromium headless está disponible, pero la prueba gráfica automatizada no completó por un fallo del proceso GPU/DBus del entorno; no se contabiliza como validación visual real.

## 11. Riesgos pendientes

- Ejecutar de extremo a extremo en Windows 10 y Windows 11 reales.
- Probar Windows PowerShell 5.1 y PowerShell 7.
- Probar equipos con UAC estándar y usuario sin privilegios administrativos.
- Validar `winget`, `msstore`, pins, versiones desconocidas y políticas corporativas.
- Ejecutar el nuevo validador contra los 86 registros del catálogo antes de cada release importante.
- Prueba PWA real bajo HTTPS y offline tras primera carga.
- Matriz visual Chrome/Edge/Firefox + iPhone/iPad/Android.
- Navegación real con NVDA/Narrator/VoiceOver.

## 12. Qué faltaría para un 10/10 real

1. CI sobre runner Windows que ejecute el validador WinGet y alerte de IDs retirados.
2. E2E real con Playwright en Chrome/Edge/Firefox, incluyendo vista móvil.
3. Pruebas de scripts en VM Windows limpia y snapshot/rollback.
4. Firma de scripts/releases o una estrategia de distribución firmada si se orienta a empresa.
5. Auditoría manual con lector de pantalla y pruebas de contraste/zoom al 200–400 %.
6. Validación de PWA instalada desde GitHub Pages real.
7. Si se quiere monetizar o gestionar flotas: backend opcional, control de versiones, política de catálogo y administración centralizada, sin perder el modo local-first.

## 13. Puntuación por categorías

| Categoría | Nota |
|---|---:|
| CTO / arquitectura | **9,2/10** |
| UX/UI | **9,3/10** |
| QA / estabilidad | **9,1/10** |
| Seguridad | **9,5/10** |
| Rendimiento | **9,8/10** |
| Accesibilidad | **9,2/10** |
| GitHub Pages | **9,8/10** |
| Valor como producto | **9,5/10** |
| Potencial comercial | **8,9/10** |

## 14. Puntuación global final

# **9,3/10**

La aplicación merece una valoración alta por arquitectura estática limpia, utilidad real, buena seguridad por defecto, funcionamiento local-first, generación de scripts revisables y una propuesta diferenciada. No alcanza 9,5 global porque faltan evidencias de ejecución real en Windows, regresión visual automatizada fiable y pruebas de accesibilidad con tecnologías asistivas.

## Corrección específica v2.4.4 — generación de scripts y UAC

Se localizaron dos debilidades funcionales en v2.4.0: el formato PowerShell se presentaba como recomendado aunque Windows puede asociar `.ps1` a edición en lugar de ejecución, y los BAT terminaban silenciosamente si el relanzamiento UAC fallaba o era cancelado.

En v2.4.4 se aplicó:

- BAT como formato predeterminado para instalación y actualización.
- relanzamiento UAC mediante Windows PowerShell por ruta fija del sistema;
- comprobación del proceso elevado con `-PassThru`;
- mensaje de error visible si no se consigue elevación;
- autoelevación PowerShell endurecida para rutas con espacios;
- pruebas de regresión que comprueban estas garantías estáticas.

**Limitación de evidencia:** este entorno no es Windows, por lo que no se afirma que el cuadro UAC ni WinGet se hayan ejecutado aquí. La estructura y la generación de scripts sí se han verificado automáticamente; la prueba final del UAC debe hacerse en Windows 10/11.
