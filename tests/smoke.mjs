import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const required = [
  '.nojekyll', 'index.html', 'manifest.webmanifest', 'service-worker.js', 'README.md', 'CHANGELOG.md',
  'QA-REPORT.md', 'SECURITY.md', 'assets/css/styles.css', 'assets/js/config.js', 'assets/js/apps-data.js',
  'assets/js/app.js', 'assets/js/system-tools.js', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png', 'tools/apphub-404-scan.ps1', 'examples/inventory-example.json'
];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Falta ${file}`);

for (const file of ['assets/js/config.js', 'assets/js/app.js', 'assets/js/system-tools.js', 'service-worker.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, '2.4.7', 'Versión package incorrecta');

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.name, 'AppHub 404');
assert.equal(manifest.id, './');
assert.equal(manifest.start_url, './');
assert.equal(manifest.scope, './');
assert.equal(manifest.lang, 'es-ES');
assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 3, 'Faltan accesos directos PWA');
for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), `Icono PWA roto: ${icon.src}`);

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(read('assets/js/config.js'), sandbox);
vm.runInContext(read('assets/js/apps-data.js'), sandbox);
assert.equal(sandbox.window.APPHUB_CONFIG.version, pkg.version, 'Config y package no coinciden');
const data = sandbox.window.APPHUB_DATA;
assert.ok(data.apps.length >= 86, 'Catálogo demasiado pequeño');
assert.ok(data.categories.length >= 13, 'Faltan categorías');
assert.ok(data.packs.length >= 9, 'Faltan packs');
assert.equal(new Set(data.apps.map(app => app.id)).size, data.apps.length, 'Hay IDs duplicados');
const ids = new Set(data.apps.map(app => app.id));
const categoryIds = new Set(data.categories.map(category => category.id));
for (const pack of data.packs) for (const id of pack.apps) assert.ok(ids.has(id), `Pack ${pack.id} referencia ${id} inexistente`);
for (const app of data.apps) {
  assert.match(app.id, /^[A-Za-z0-9][A-Za-z0-9._+\-]+$/, `ID sospechoso: ${app.id}`);
  assert.ok(app.name && app.desc && app.category, `Datos incompletos: ${app.id}`);
  assert.ok(categoryIds.has(app.category), `Categoría inexistente: ${app.id} → ${app.category}`);
  assert.ok(!app.source || ['winget', 'msstore'].includes(app.source), `Origen no permitido: ${app.id}`);
  if (app.links) for (const link of app.links) { assert.match(link.url, /^https:\/\//, `Enlace externo no HTTPS: ${app.id}`); assert.ok(link.label, `Enlace sin etiqueta: ${app.id}`); }
}
const citrix = data.apps.find(app => app.id === 'Citrix.Workspace');
assert.ok(citrix && citrix.links?.some(link => /windows-latest/.test(link.url)), 'Citrix Workspace debe enlazar al Offline Installer oficial');
const citrixLtsr = data.apps.find(app => app.id === 'Citrix.Workspace.LTSR');
assert.ok(citrixLtsr && citrixLtsr.links?.some(link => /LTSR-Latest/.test(link.url)), 'Citrix LTSR debe enlazar al Offline Installer oficial');
assert.ok(data.packs.some(pack => pack.id === 'remote-work' && pack.apps.includes('Citrix.Workspace')), 'Falta pack Empresa y trabajo remoto');
const remotePack = data.packs.find(pack => pack.id === 'remote-work');
assert.ok(!remotePack.apps.includes('Citrix.Workspace.LTSR'), 'El pack no debe instalar Citrix Current y LTSR juntos');
for (const id of ['Microsoft.WindowsApp','Microsoft.Teams','Cisco.CiscoWebexMeetings','AnyDeskSoftwareGmbH.AnyDesk','VMware.HorizonClient']) {
  assert.ok(ids.has(id), `Falta aplicación empresarial WinGet: ${id}`);
  assert.ok(remotePack.apps.includes(id), `El pack Empresa y trabajo remoto no incluye ${id}`);
}
for (const id of ['Cisco.SecureClient.External','Fortinet.FortiClientVPN.External','PaloAlto.GlobalProtect.External']) {
  const app = data.apps.find(item => item.id === id);
  assert.ok(app?.externalOnly, `La aplicación ${id} debe ser solo descarga oficial`);
  assert.ok(app.links?.some(link => /^https:\/\//.test(link.url)), `Falta enlace oficial HTTPS para ${id}`);
  assert.ok(!remotePack.apps.includes(id), `Una descarga externa no debe entrar en scripts: ${id}`);
}
const dellOptimizer = data.apps.find(app => app.id === 'XP9B49CJ91XF01');
assert.ok(dellOptimizer && dellOptimizer.source === 'msstore', 'Dell Optimizer debe existir y usar msstore');

const html = read('index.html');
const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, 'Hay IDs HTML duplicados');
assert.ok(html.includes('id="mainContent"'), 'Falta destino del enlace de salto');
assert.ok(html.includes('href="#mainContent"'), 'Falta enlace de salto accesible');
assert.ok(html.includes("style-src 'self'"), 'La CSP debe bloquear estilos inline');
assert.ok(!html.includes("'unsafe-inline'"), 'La CSP conserva unsafe-inline');
assert.ok(html.includes('assets/js/config.js'), 'No se carga config.js');
assert.ok(html.includes('assets/js/system-tools.js'), 'No se carga system-tools.js');
assert.ok(html.includes('id="appVersionLabel">v2.4.7'), 'Versión visible no actualizada');
assert.ok((html.match(/<th scope="col">/g) || []).length >= 7, 'Las tablas carecen de scope suficiente');
for (const id of [
  'appsGrid', 'packsGrid', 'builderDialog', 'scriptPreview', 'downloadScript', 'openUpdater', 'updaterDialog',
  'updaterPreview', 'downloadUpdater', 'systemDashboard', 'inventoryFileInput', 'inventorySelect', 'healthList',
  'updatesTableBody', 'inventoryTableBody', 'compareA', 'compareB', 'schedulerDialog', 'schedulerPreview',
  'repairDialog', 'repairPreview', 'downloadSchedulerRemoval', 'downloadUninstaller', 'downloadCatalogValidator', 'connectionStatus'
]) assert.ok(html.includes(`id="${id}"`), `Falta #${id}`);

const appJs = read('assets/js/app.js');
for (const token of [
  'generateUpdaterPowerShell', 'generateUpdaterBatch', 'winget list --upgrade-available', '--include-unknown',
  '--include-pinned', '--source', 'StoreEdgeFD', 'Error al actualizar', 'apphub:settings-restored'
]) assert.ok(appJs.includes(token), `Falta función: ${token}`);
assert.equal((appJs.match(/winget upgrade \$\{flags\}/g) || []).length, 1, 'El BAT no debe ejecutar dos veces winget upgrade --all');
assert.ok(!appJs.includes('WinGetVersion:'), 'El JSON no debe inventar una versión de WinGet');
assert.ok(!appJs.includes('.style.'), 'app.js usa estilos inline incompatibles con la CSP');
assert.ok(appJs.includes('noopener noreferrer'), 'Los enlaces externos deben aislar opener');
assert.ok(appJs.includes('AppHub 404 v${VERSION}'), 'Los scripts deben tomar la versión centralizada');
assert.ok((appJs.match(/-Verb RunAs/g) || []).length >= 2, 'Instalador y actualizador PowerShell deben autoelevarse con UAC');
assert.ok((appJs.match(/Security\.Principal\.WindowsPrincipal/g) || []).length >= 2, 'Los scripts PowerShell deben comprobar el rol de administrador');
assert.ok(appJs.includes('externalOnly'), 'El catálogo debe distinguir descargas oficiales externas de paquetes WinGet');
assert.ok(appJs.includes("!appsById.get(id).externalOnly"), 'La restauración de selección debe excluir apps externas');
assert.ok(appJs.includes('APPHUB_SELF=%~f0'), 'El BAT debe transmitir su propia ruta mediante APPHUB_SELF');
assert.ok(appJs.includes('System32\\WindowsPowerShell\\v1.0\\powershell.exe'), 'La elevación debe usar una ruta fiable de Windows PowerShell');
assert.ok(appJs.includes('-PassThru'), 'La elevación debe validar que se creó el proceso elevado');
assert.ok(appJs.includes('No se pudo obtener elevacion'), 'El BAT debe avisar cuando UAC falle o se cancele');
assert.ok((appJs.match(/Start-Process -FilePath \$env:ComSpec -Verb RunAs/g) || []).length >= 2, 'Los BAT deben elevar cmd.exe mediante UAC');
assert.ok(!appJs.includes('Start-Process -FilePath $env:APPHUB_SELF -Verb RunAs'), 'No se debe intentar elevar directamente el BAT');
assert.ok(!appJs.includes("$q + $q + $env:APPHUB_SELF + $q + $q"), 'El BAT no debe envolver la ruta con comillas dobles duplicadas al relanzar cmd.exe');
assert.ok(appJs.includes("$arg='/d /c call ' + $q + $env:APPHUB_SELF + $q"), 'El BAT debe relanzar el propio script mediante cmd /c call');
assert.ok((appJs.match(/fltmc >nul 2>&1/g) || []).length >= 2, 'Los BAT generados deben usar la misma comprobación administrativa fltmc validada manualmente');
assert.ok((appJs.match(/goto :APPHUB_ELEVATED/g) || []).length >= 2, 'Los BAT generados deben usar flujo por etiqueta en vez de envolver la elevación en un bloque IF');
assert.ok(appJs.includes("$q=[char]34; $arg='/d /c call '"), 'El relanzamiento BAT debe usar CALL para evitar el caso ambiguo de cmd /c con comando entrecomillado');
assert.ok(html.includes('name="format" value="bat" checked'), 'BAT debe ser el formato predeterminado del instalador');
assert.ok(html.includes('name="updaterFormat" value="bat" checked'), 'BAT debe ser el formato predeterminado del actualizador');

const toolsJs = read('assets/js/system-tools.js');
for (const token of [
  'INVENTORY_SCHEMA', 'BACKUP_SCHEMA', 'generateSchedulerScript', 'generateSchedulerRemovalScript',
  'generateRepairScript', 'downloadUninstaller', 'markInstalledApps', 'MAX_FILE_BYTES', 'validateInventory',
  'normalizeInventory', 'cleanText', 'uniqueByKey', 'Escribe DESINSTALAR para continuar'
]) assert.ok(toolsJs.includes(token), `Falta herramienta auditada: ${token}`);
assert.ok(toolsJs.includes('LogonType Interactive'), 'La tarea debe ejecutarse en contexto interactivo del usuario');
assert.ok(toolsJs.includes('-NoProfile -NonInteractive -File'), 'La tarea debe evitar ExecutionPolicy Bypass');
assert.ok(!toolsJs.includes('ExecutionPolicy Bypass'), 'No debe generarse ExecutionPolicy Bypass');
assert.ok(!toolsJs.includes('--allow-reboot'), 'No deben programarse reinicios automáticos');
assert.ok(!toolsJs.includes('.style.'), 'system-tools.js usa estilos inline incompatibles con la CSP');
assert.ok(toolsJs.includes("window.dispatchEvent(new CustomEvent('apphub:settings-restored'"), 'El backup debe aplicarse sin recarga');
assert.ok((toolsJs.match(/-Verb RunAs/g) || []).length >= 4, 'Programador, eliminación, reparación y desinstalación deben autoelevarse');
assert.ok(toolsJs.includes('System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe'), 'Las herramientas PowerShell deben usar el ejecutable de Windows por ruta fija');
assert.ok(toolsJs.includes('downloadCatalogValidator'), 'Falta el validador local del catálogo');
assert.ok(toolsJs.includes('apphub-404-catalog-validation-v1'), 'El validador debe exportar un informe estructurado');
assert.ok(toolsJs.includes("!appById.get(id).externalOnly"), 'Backups y restauración deben excluir apps externas de la selección');

const scanner = read('tools/apphub-404-scan.ps1').replace(/^\uFEFF/, '');
for (const token of [
  'winget export', '--include-versions', 'winget = [ordered]', 'Get-MpComputerStatus',
  'Get-WindowsOptionalFeature', 'apphub-404-inventory-v2', "appVersion = '2.4.7'", '[switch]$NoPause',
  '[switch]$IncludeDiagnosticText', 'Set-Content -LiteralPath'
]) assert.ok(scanner.includes(token), `Falta comprobación del analizador: ${token}`);
assert.ok(!scanner.match(/winget\s+(install|upgrade|uninstall)\b/i), 'El analizador debe ser de solo lectura');
assert.ok(!scanner.includes('items = $RegistrySoftware'), 'El analizador no debe exportar la lista del Registro');
assert.ok(!scanner.includes('??'), 'El analizador debe ser compatible con Windows PowerShell 5.1');
assert.ok(scanner.includes('-Verb RunAs'), 'El analizador debe solicitar UAC para completar el diagnóstico');

const example = JSON.parse(read('examples/inventory-example.json'));
assert.equal(example.schema, sandbox.window.APPHUB_CONFIG.inventorySchema);
assert.equal(example.appVersion, pkg.version);
assert.ok(example.winget.packages.length >= 3 && example.health.length >= 3, 'Ejemplo incompleto');
assert.ok(!('items' in (example.software || {})), 'El ejemplo expone software del Registro innecesariamente');

const sw = read('service-worker.js');
assert.ok(sw.includes('apphub-404-v2.4.7'), 'Caché PWA sin actualizar');
assert.ok(sw.includes('assets/js/config.js'), 'Service worker no precachea config.js');
assert.ok(sw.includes("request.mode === 'navigate'"), 'Falta estrategia específica de navegación');
assert.ok(sw.includes('url.origin !== self.location.origin'), 'El service worker debe limitarse al mismo origen');
assert.equal((sw.match(/caches\.match\('\.\/index\.html'\)/g) || []).length, 1, 'index.html solo debe ser fallback de navegación');
const cacheFirstBody = sw.slice(sw.indexOf('async function cacheFirst'), sw.indexOf('async function fetchAndCache'));
assert.ok(!cacheFirstBody.includes("caches.match('./index.html')"), 'Los recursos no HTML no deben recibir index.html como fallback');

// Comprueba referencias locales declaradas en HTML.
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  if (/^(?:https?:|#|mailto:|tel:)/.test(ref)) continue;
  const clean = ref.split(/[?#]/)[0];
  assert.ok(fs.existsSync(path.join(root, clean)), `Referencia local rota: ${ref}`);
}

// Nombres seguros y ausencia de residuos habituales.
for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
  assert.ok(!/[<>:"|?*]/.test(entry.name), `Nombre incompatible con Windows/GitHub: ${entry.name}`);
}
for (const file of ['index.html', 'assets/js/app.js', 'assets/js/system-tools.js', 'service-worker.js']) {
  const text = read(file);
  assert.ok(!/\b(?:TODO|FIXME)\b/.test(text) && !/Lorem ipsum/i.test(text), `Queda texto provisional en ${file}`);
}

console.log(`OK v${pkg.version}: ${data.apps.length} apps, ${data.categories.length} categorías, ${data.packs.length} packs; CSP, PWA, inventario, backups, validación de catálogo y scripts auditados.`);
