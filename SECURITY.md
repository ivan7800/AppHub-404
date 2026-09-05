# Seguridad — AppHub 404 v2.4.4

## Modelo de seguridad

AppHub 404 es una aplicación estática. No dispone de backend, cuentas, API propia, telemetría ni subida automática de datos. La interfaz no puede ejecutar comandos del sistema; únicamente genera archivos que deben ser revisados y ejecutados localmente por el usuario.

## Principios aplicados

- Content Security Policy sin `unsafe-inline` para scripts.
- Sin dependencias runtime externas ni CDN.
- Enlaces externos en HTTPS y abiertos con `noopener noreferrer`.
- Datos locales saneados antes de renderizarse.
- Límites de tamaño y cardinalidad para inventarios y backups.
- Aplicaciones marcadas como `externalOnly` excluidas de instalación, desinstalación, packs automáticos y restauración de selección.
- Service worker limitado al mismo origen y sin fallback HTML para recursos no HTML.
- Ninguna credencial se incluye en scripts.

## Elevación UAC

Los scripts que administran Windows comprueban si tienen privilegios de administrador. Cuando es necesario se relanzan con `Start-Process -Verb RunAs` usando el mismo ejecutable de PowerShell y argumentos explícitos.

No se usa:

- `ExecutionPolicy Bypass`;
- almacenamiento de contraseñas;
- elevación silenciosa;
- mecanismos para saltarse UAC;
- `--force` como comportamiento predeterminado;
- reinicio automático.

Si el usuario cancela UAC, la operación administrativa no continúa.

Los BAT pasan su propia ruta mediante una variable de entorno antes de solicitar `RunAs`, evitando insertar directamente rutas potencialmente problemáticas dentro del comando PowerShell.

## WinGet

Los IDs de paquetes son datos operativos que pueden cambiar. AppHub v2.4.4 incorpora un **validador de catálogo de solo lectura** que ejecuta `winget show --id <ID> -e --source <origen>` y genera un informe JSON. No instala ni modifica software.

Las descargas corporativas que no cuentan con un mecanismo WinGet fiable se presentan como enlaces oficiales externos y no entran en scripts automáticos.

## Inventarios

El importador limita y sanea los datos antes de almacenarlos. Se rechazan estructuras inesperadas o sobredimensionadas. Las copias restauradas vuelven a filtrarse contra el catálogo actual y no pueden reactivar aplicaciones `externalOnly` como instalables.

El analizador PowerShell es de solo lectura. Por defecto no exporta nombres de todas las aplicaciones del Registro; solo su recuento. La opción `-IncludeDiagnosticText` incorpora información adicional y debe utilizarse conscientemente.

## Riesgos que AppHub no puede eliminar

- Un manifiesto WinGet puede cambiar o desaparecer después de publicar AppHub.
- Un instalador de terceros puede tener su propio comportamiento o solicitar privilegios adicionales.
- Políticas corporativas pueden bloquear WinGet, Microsoft Store, PowerShell, scripts o UAC.
- Software malicioso previamente presente en el equipo puede alterar herramientas del sistema.

## Recomendaciones de despliegue

1. Pruebe primero en un equipo o VM no crítico.
2. Valide el catálogo desde un Windows real antes de una publicación importante.
3. Revise los scripts generados antes de ejecutarlos.
4. Mantenga Windows, App Installer y Microsoft Defender actualizados.
5. En empresa, respete Intune, AppLocker/WDAC, GPO y las políticas de software autorizadas.
