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
  'assets/icons/icon-maskable-512.png', 'tools/apphub-404-scan.ps1', 'tools/test-uac-double-click.bat', 'examples/inventory-example.json'
];
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Falta ${file}`);

for (const file of ['assets/js/config.js', 'assets/js/app.js', 'assets/js/system-tools.js', 'service-worker.js']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, '2.7.2', 'Versión package incorrecta');

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
assert.ok(data.apps.length >= 93, 'Catálogo demasiado pequeño');
assert.ok(data.categories.length >= 13, 'Faltan categorías');
assert.ok(data.packs.length >= 12, 'Faltan packs');
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

for (const id of ['WinMerge.WinMerge','Microsoft.VisualStudio.2022.Community','Microsoft.VisualStudio.2022.BuildTools','EclipseAdoptium.Temurin.21.JDK','DBBrowserForSQLite.DBBrowserForSQLite','mRemoteNG.mRemoteNG']) {
  const app = data.apps.find(item => item.id === id);
  assert.ok(app && !app.externalOnly, `Falta aplicación WinGet nueva: ${id}`);
}
const adw = data.apps.find(app => app.id === 'Malwarebytes.AdwCleaner.External');
assert.ok(adw?.externalOnly, 'AdwCleaner debe integrarse como descarga oficial externa');
assert.ok(adw.links?.some(link => /malwarebytes\.com\/adwcleaner/.test(link.url)), 'AdwCleaner debe enlazar a Malwarebytes oficial');
for (const packId of ['corporate-new-pc','helpdesk-cau','windows-developer']) assert.ok(data.packs.some(pack => pack.id === packId), `Falta pack nuevo: ${packId}`);
assert.ok(data.packs.find(pack => pack.id === 'helpdesk-cau').apps.includes('mRemoteNG.mRemoteNG'), 'Helpdesk debe incluir mRemoteNG');
assert.ok(data.packs.find(pack => pack.id === 'windows-developer').apps.includes('Microsoft.VisualStudio.2022.BuildTools'), 'Desarrollador Windows debe incluir Build Tools');
assert.ok(!data.packs.some(pack => pack.apps.includes('Malwarebytes.AdwCleaner.External')), 'AdwCleaner externalOnly no debe entrar en packs ejecutables');

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
assert.ok(html.includes('id="appVersionLabel">v2.7.2'), 'Versión visible no actualizada');
assert.ok((html.match(/<th scope="col">/g) || []).length >= 7, 'Las tablas carecen de scope suficiente');
for (const id of [
  'appsGrid', 'packsGrid', 'builderDialog', 'scriptPreview', 'downloadScript', 'openUpdater', 'updaterDialog',
  'updaterPreview', 'downloadUpdater', 'systemDashboard', 'inventoryFileInput', 'inventorySelect', 'healthList',
  'updatesTableBody', 'inventoryTableBody', 'compareA', 'compareB', 'schedulerDialog', 'schedulerPreview',
  'repairDialog', 'repairPreview', 'downloadSchedulerRemoval', 'downloadUninstaller', 'downloadCatalogValidator', 'downloadDriverBackup', 'downloadDriverInventory', 'downloadDriverRestore', 'connectionStatus'
]) assert.ok(html.includes(`id="${id}"`), `Falta #${id}`);

const appJs = read('assets/js/app.js');
for (const token of [
  'generateUpdaterPowerShell', 'generateUpdaterBatch', 'winget list --upgrade-available', '--include-unknown',
  '--include-pinned', '--source', 'StoreEdgeFD', 'WinGet terminó con el código', 'apphub:settings-restored'
]) assert.ok(appJs.includes(token), `Falta función: ${token}`);
assert.equal((appJs.match(/winget upgrade \$\{flags\}/g) || []).length, 1, 'El BAT no debe ejecutar dos veces winget upgrade --all');
assert.ok(!appJs.includes('WinGetVersion:'), 'El JSON no debe inventar una versión de WinGet');
assert.ok(!appJs.includes('.style.'), 'app.js usa estilos inline incompatibles con la CSP');
assert.ok(appJs.includes('noopener noreferrer'), 'Los enlaces externos deben aislar opener');
assert.ok(appJs.includes('AppHub 404 v${VERSION}'), 'Los scripts deben tomar la versión centralizada');
assert.ok(appJs.includes('function powershellAdminGuard()'), 'Falta guardia UAC centralizada para PowerShell');
assert.ok((appJs.match(/\$\{powershellAdminGuard\(\)\}/g) || []).length >= 2, 'Instalador y actualizador PowerShell deben reutilizar la misma guardia UAC');
assert.ok(appJs.includes("$Psi.Verb = 'runas'"), 'PowerShell debe solicitar UAC mediante ProcessStartInfo');
assert.ok(appJs.includes('Get-Process -Id $PID'), 'La elevación debe reutilizar el ejecutable real de PowerShell');
assert.ok(appJs.includes('externalOnly'), 'El catálogo debe distinguir descargas oficiales externas de paquetes WinGet');
assert.ok(appJs.includes("!appsById.get(id).externalOnly"), 'La restauración de selección debe excluir apps externas');
assert.ok(appJs.includes('function batchAdminGuard()'), 'Falta guardia UAC centralizada para BAT');
assert.ok((appJs.match(/\$\{batchAdminGuard\(\)\}/g) || []).length >= 2, 'Instalador y actualizador BAT deben reutilizar la misma guardia UAC');
assert.ok(appJs.includes('fltmc >nul 2>&1'), 'Los BAT deben comprobar explícitamente si ya están elevados');
assert.ok(appJs.includes('APPHUB_SELF=%~f0'), 'Los BAT deben conservar la ruta real del propio script para autoelevarse');
assert.ok(appJs.includes("$Psi.FileName = $env:APPHUB_SELF"), 'La autoelevación BAT debe usar el propio BAT como destino de ShellExecute');
assert.ok(appJs.includes('SystemRoot%\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe'), 'El generador BAT debe usar Windows PowerShell del sistema con escapes seguros');
assert.ok(appJs.includes("$Psi.Verb = 'runas'"), 'La autoelevación BAT debe usar el verbo runas');
assert.ok(!appJs.includes('Start-Process -FilePath $env:ComSpec -Verb RunAs'), 'Los BAT no deben volver al flujo PowerShell → cmd /c que falló en Windows real');
assert.ok(!appJs.includes('ExecutionPolicy Bypass'), 'Los generadores no deben saltarse la ExecutionPolicy');
assert.ok(!appJs.includes('winget show --id $Package.Id'), 'El instalador PS1 no debe bloquear la instalación con winget show previo');
assert.ok(!appJs.includes('winget list --id $Package.Id'), 'El instalador PS1 no debe bloquear la instalación con winget list previo');
const badWinPath = String.raw`System32\WindowsPowerShell\v1.0\powershell.exe`;
assert.ok(!appJs.includes(badWinPath), 'Queda una ruta Windows sin escapar dentro de un template string de app.js');
assert.ok(html.includes('Recomendado · doble clic + UAC'), 'La interfaz debe describir el nuevo flujo BAT de doble clic + UAC');
assert.ok(html.includes('name="format" value="bat" checked'), 'BAT debe ser el formato predeterminado del instalador');
assert.ok(html.includes('name="updaterFormat" value="bat" checked'), 'BAT debe ser el formato predeterminado del actualizador');

// Ejecuta los generadores sin inicializar la UI para validar los bytes reales producidos por los template strings.
const dummyElement = { checked:false, value:'', textContent:'', addEventListener(){}, setAttribute(){}, classList:{ toggle(){} } };
const generatorSandbox = {
  window: { APPHUB_CONFIG: sandbox.window.APPHUB_CONFIG, APPHUB_DATA: data, addEventListener(){} },
  document: { querySelector(){ return dummyElement; }, querySelectorAll(){ return []; } },
  localStorage: { getItem(){ return null; }, setItem(){} },
  navigator: { onLine:true }, location:{ protocol:'file:' }, matchMedia(){ return { matches:false }; },
  Blob: class {}, URL:{ createObjectURL(){return 'blob:test';}, revokeObjectURL(){} }, setTimeout(){}, clearTimeout(){}, console
};
vm.createContext(generatorSandbox);
const instrumentedApp = appJs
  .replace('  init();', '  // init disabled by smoke test')
  .replace(/\}\)\(\);\s*$/, `  window.__APPHUB_TEST__ = { generatePowerShell, generateBatch, generateUpdaterPowerShell, generateUpdaterBatch };\n})();`);
vm.runInContext(instrumentedApp, generatorSandbox);
const gen = generatorSandbox.window.__APPHUB_TEST__;
assert.ok(gen, 'No se pudieron exponer los generadores para QA');
const installOpts = { updateSources:true, silent:false, upgrade:false, restore:false, pause:true };
const ps1Generated = gen.generatePowerShell(['7zip.7zip'], installOpts);
const batGenerated = gen.generateBatch(['7zip.7zip'], installOpts);
const updaterPs1Generated = gen.generateUpdaterPowerShell({ updateSources:true, silent:false, unknown:false, pinned:false, restore:false, pause:true });
const updaterBatGenerated = gen.generateUpdaterBatch({ updateSources:true, silent:false, unknown:false, pinned:false, restore:false, pause:true });
for (const [name, generated] of Object.entries({ ps1Generated, batGenerated, updaterPs1Generated, updaterBatGenerated })) {
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(generated), `${name} contiene caracteres de control inesperados`);
}
assert.ok(ps1Generated.includes("$Psi.Verb = 'runas'"), 'El PS1 real generado no contiene la elevación UAC esperada');
assert.ok(ps1Generated.includes("winget @InstallArgs 2>&1"), 'El PS1 real generado no captura stderr de WinGet');
assert.ok(!ps1Generated.includes('winget show --id $Package.Id'), 'El PS1 real generado conserva un bloqueo previo winget show');
assert.ok(batGenerated.includes('Solicitando permisos de administrador mediante UAC'), 'El BAT real generado no solicita UAC al hacer doble clic');
assert.ok(batGenerated.includes('set \"APPHUB_SELF=%~f0\"'), 'El BAT real generado no conserva su ruta para el relanzamiento');
assert.ok(batGenerated.includes("$Psi.FileName = $env:APPHUB_SELF"), 'El BAT real generado no usa ShellExecute sobre el propio BAT');
assert.ok(batGenerated.includes("$Psi.Verb = 'runas'"), 'El BAT real generado no usa runas');
assert.ok(batGenerated.includes('%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'), 'El BAT real generado no contiene la ruta segura de Windows PowerShell');
assert.ok(batGenerated.includes(':APPHUB_UAC_FAILED'), 'El BAT real generado no contiene fallback visible si UAC falla o se cancela');
assert.ok(updaterBatGenerated.includes('Solicitando permisos de administrador mediante UAC'), 'El actualizador BAT real no solicita UAC');
assert.ok(updaterBatGenerated.includes('winget pin --help'), 'El actualizador BAT no comprueba compatibilidad del comando pin');

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
assert.ok(toolsJs.includes('function powershellAdminGuard()'), 'Falta guardia UAC centralizada en herramientas');
assert.ok((toolsJs.match(/\$\{powershellAdminGuard\(\)\}/g) || []).length >= 4, 'Programador, eliminación, reparación y desinstalación deben compartir la guardia UAC');
assert.ok(toolsJs.includes("$Psi.Verb = 'runas'"), 'Las herramientas administrativas deben solicitar UAC mediante ProcessStartInfo');
assert.ok(toolsJs.includes('Get-Process -Id $PID'), 'Las herramientas deben reutilizar el ejecutable real de PowerShell');
assert.ok(!toolsJs.includes('Ejecutar con PowerShell como administrador'), 'No debe mostrarse la instrucción incorrecta de elevación manual para PS1');
assert.ok(!toolsJs.includes(badWinPath), 'Queda una ruta Windows sin escapar dentro de un template string de system-tools.js');
assert.ok(toolsJs.includes('downloadCatalogValidator'), 'Falta el validador local del catálogo');
assert.ok(toolsJs.includes('apphub-404-catalog-validation-v1'), 'El validador debe exportar un informe estructurado');
for (const token of ['generateDriverBackupScript', 'generateDriverInventoryScript', 'generateDriverRestoreScript', "pnputil.exe /export-driver '*'", 'dism.exe /Online /Export-Driver', 'pnputil.exe /enum-drivers', 'pnputil.exe /add-driver $Inf.FullName /install', "Escribe RESTAURAR para continuar"]) assert.ok(toolsJs.includes(token), `Falta Drivers 404: ${token}`);
assert.ok(toolsJs.includes('No exporta utilidades OEM ni instaladores EXE'), 'Drivers 404 debe documentar la limitación del backup');
assert.ok(toolsJs.includes("!appById.get(id).externalOnly"), 'Backups y restauración deben excluir apps externas de la selección');

const toolsSandbox = {
  window: { APPHUB_CONFIG: sandbox.window.APPHUB_CONFIG, APPHUB_DATA: data, addEventListener(){}, dispatchEvent(){} },
  document: { querySelector(){ return dummyElement; }, querySelectorAll(){ return []; }, createElement(){ return dummyElement; } },
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  navigator: { clipboard:{ writeText:async()=>{} } }, confirm(){ return true; }, setTimeout(){}, console, Intl, Date, JSON, Blob:class {}, URL:{ createObjectURL(){return 'blob:test';}, revokeObjectURL(){} }, FileReader:class {}
};
vm.createContext(toolsSandbox);
const instrumentedTools = toolsJs
  .replace('  init();', '  // init disabled by smoke test')
  .replace(/\}\)\(\);\s*$/, `  window.__APPHUB_TOOLS_TEST__ = { generateSchedulerScript, generateSchedulerRemovalScript, generateRepairScript, generateDriverBackupScript, generateDriverInventoryScript, generateDriverRestoreScript };\n})();`);
vm.runInContext(instrumentedTools, toolsSandbox);
const toolGen = toolsSandbox.window.__APPHUB_TOOLS_TEST__;
assert.ok(toolGen, 'No se pudieron exponer los generadores de herramientas para QA');
const generatedTools = {
  scheduler: toolGen.generateSchedulerScript(),
  schedulerRemoval: toolGen.generateSchedulerRemovalScript(),
  repair: toolGen.generateRepairScript(),
  driverBackup: toolGen.generateDriverBackupScript(),
  driverInventory: toolGen.generateDriverInventoryScript(),
  driverRestore: toolGen.generateDriverRestoreScript()
};
for (const [name, generated] of Object.entries(generatedTools)) {
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(generated), `${name} contiene caracteres de control inesperados`);
}
for (const name of ['scheduler','schedulerRemoval','repair','driverBackup','driverRestore']) {
  assert.ok(generatedTools[name].includes("$Psi.Verb = 'runas'"), `${name} no contiene la guardia UAC unificada`);
}

assert.ok(generatedTools.scheduler.includes('AppHub404\\Logs'), 'El worker programado pierde la barra de ProgramData/AppHub404/Logs');
assert.ok(generatedTools.schedulerRemoval.includes('AppHub404\\Update-Apps.ps1'), 'El eliminador pierde la barra de ProgramData/AppHub404/Update-Apps.ps1');

const scanner = read('tools/apphub-404-scan.ps1').replace(/^\uFEFF/, '');
for (const token of [
  'winget export', '--include-versions', 'winget = [ordered]', 'Get-MpComputerStatus',
  'Get-WindowsOptionalFeature', 'apphub-404-inventory-v2', "appVersion = '2.7.2'", '[switch]$NoPause',
  '[switch]$IncludeDiagnosticText', 'Set-Content -LiteralPath'
]) assert.ok(scanner.includes(token), `Falta comprobación del analizador: ${token}`);
assert.ok(!scanner.match(/winget\s+(install|upgrade|uninstall)\b/i), 'El analizador debe ser de solo lectura');
assert.ok(!scanner.includes('items = $RegistrySoftware'), 'El analizador no debe exportar la lista del Registro');
assert.ok(!scanner.includes('??'), 'El analizador debe ser compatible con Windows PowerShell 5.1');
assert.ok(scanner.includes("$Psi.Verb = 'runas'"), 'El analizador debe solicitar UAC para completar el diagnóstico');

const example = JSON.parse(read('examples/inventory-example.json'));
assert.equal(example.schema, sandbox.window.APPHUB_CONFIG.inventorySchema);
assert.equal(example.appVersion, pkg.version);
assert.ok(example.winget.packages.length >= 3 && example.health.length >= 3, 'Ejemplo incompleto');
assert.ok(!('items' in (example.software || {})), 'El ejemplo expone software del Registro innecesariamente');

const sw = read('service-worker.js');
assert.ok(sw.includes('apphub-404-v2.7.2'), 'Caché PWA sin actualizar');
assert.ok(sw.includes('assets/js/config.js'), 'Service worker no precachea config.js');
assert.ok(sw.includes("const CACHE_PREFIX = 'apphub-404-';"), 'Service worker sin prefijo de caché AppHub');
assert.ok(sw.includes('oldAppHubCaches'), 'Service worker no detecta cachés antiguas');
assert.ok(sw.includes('client.navigate(client.url)'), 'Service worker no recarga clientes tras cambio de versión');
assert.ok(sw.includes("cache: 'no-store'"), 'Recursos críticos no fuerzan validación de red');
assert.ok(html.includes('id="clearAppCache"'), 'Falta botón manual de limpieza de caché');
assert.ok(appJs.includes("const CACHE_VERSION_KEY = 'apphub-cache-version';"), 'Falta marcador local de versión de caché');
assert.ok(appJs.includes('healCacheOnStartup()'), 'No se ejecuta autocuración de caché al iniciar');
assert.ok(appJs.includes('deleteOldAppHubCaches({ includeCurrent: true })'), 'La limpieza manual no purga la caché actual de AppHub');
assert.ok(appJs.includes("key.startsWith(CACHE_PREFIX)"), 'La purga no está limitada a cachés AppHub');
assert.ok(!appJs.includes('localStorage.clear()'), 'La limpieza de caché no debe borrar preferencias/datos locales');
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
