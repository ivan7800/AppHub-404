(() => {
  'use strict';

  const CONFIG = window.APPHUB_CONFIG || {};
  const VERSION = CONFIG.version || '2.7.2';
  const INVENTORY_SCHEMA = CONFIG.inventorySchema || 'apphub-404-inventory-v2';
  const BACKUP_SCHEMA = CONFIG.backupSchema || 'apphub-404-backup-v2';
  const INVENTORY_KEY = 'apphub-inventories-v2';
  const ACTIVE_KEY = 'apphub-active-inventory-v2';
  const MAX_FILE_BYTES = CONFIG.maxInventoryFileBytes || (5 * 1024 * 1024);
  const MAX_INVENTORIES = CONFIG.maxInventories || 10;
  const MAX_PACKAGES = 5000;
  const MAX_UPDATES = 1000;
  const MAX_HEALTH = 30;
  const MAX_TEXT = 500;
  const MAX_RAW_TEXT = 50000;
  const DATA = window.APPHUB_DATA || { apps: [] };
  const appById = new Map(DATA.apps.map(app => [app.id, app]));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const els = {
    empty: $('#systemEmpty'), dashboard: $('#systemDashboard'), inventorySelect: $('#inventorySelect'),
    importInventoryButton: $('#importInventoryButton'), inventoryFileInput: $('#inventoryFileInput'),
    exportBackupButton: $('#exportBackupButton'), exportBackupTool: $('#exportBackupTool'),
    importBackupButton: $('#importBackupButton'), backupFileInput: $('#backupFileInput'),
    exportMarkdownButton: $('#exportMarkdownButton'), deleteInventoryButton: $('#deleteInventoryButton'),
    pcName: $('#pcNameValue'), pcModel: $('#pcModelValue'), windows: $('#windowsValue'), windowsBuild: $('#windowsBuildValue'),
    installedCount: $('#installedCountValue'), catalogMatch: $('#catalogMatchValue'), updatesCount: $('#updatesCountValue'), scanDate: $('#scanDateValue'),
    healthScore: $('#healthScore'), healthList: $('#healthList'), updatesBody: $('#updatesTableBody'), inventoryBody: $('#inventoryTableBody'), inventorySearch: $('#inventorySearch'),
    compareA: $('#compareA'), compareB: $('#compareB'), compareButton: $('#compareButton'), compareResults: $('#compareResults'),
    openUpdaterFromDashboard: $('#openUpdaterFromDashboard'),
    schedulerDialog: $('#schedulerDialog'), openScheduler: $('#openScheduler'), scheduleFrequency: $('#scheduleFrequency'), scheduleDayRow: $('#scheduleDayRow'), scheduleDay: $('#scheduleDay'), scheduleTime: $('#scheduleTime'), scheduleSilent: $('#scheduleSilent'), scheduleUnknown: $('#scheduleUnknown'), schedulePinned: $('#schedulePinned'), schedulerPreview: $('#schedulerPreview'), copyScheduler: $('#copyScheduler'), downloadScheduler: $('#downloadScheduler'), downloadSchedulerRemoval: $('#downloadSchedulerRemoval'),
    repairDialog: $('#repairDialog'), openRepair: $('#openRepair'), repairInfo: $('#repairInfo'), repairUpdateSources: $('#repairUpdateSources'), repairAppInstaller: $('#repairAppInstaller'), repairResetSources: $('#repairResetSources'), repairPreview: $('#repairPreview'), repairHint: $('#repairHint'), copyRepair: $('#copyRepair'), downloadRepair: $('#downloadRepair'),
    downloadUninstaller: $('#downloadUninstaller'), downloadCatalogValidator: $('#downloadCatalogValidator'), downloadDriverBackup: $('#downloadDriverBackup'), downloadDriverInventory: $('#downloadDriverInventory'), downloadDriverRestore: $('#downloadDriverRestore'), toastRegion: $('#toastRegion')
  };

  let inventories = loadStoredInventories();
  let activeId = localStorageSafeGet(ACTIVE_KEY) || inventories[0]?.id || '';
  let inventoryQuery = '';

  init();

  function init() {
    bindEvents();
    renderAll();
    observeCatalog();
    updateSchedulerPreview();
    updateRepairPreview();
  }

  function bindEvents() {
    els.importInventoryButton?.addEventListener('click', () => els.inventoryFileInput.click());
    els.inventoryFileInput?.addEventListener('change', event => importInventoryFile(event.target.files?.[0]));
    [els.exportBackupButton, els.exportBackupTool].filter(Boolean).forEach(button => button.addEventListener('click', exportBackup));
    els.importBackupButton?.addEventListener('click', () => els.backupFileInput.click());
    els.backupFileInput?.addEventListener('change', event => importBackupFile(event.target.files?.[0]));
    els.inventorySelect?.addEventListener('change', event => { activeId = event.target.value; localStorageSafeSet(ACTIVE_KEY, activeId); renderAll(); });
    els.inventorySearch?.addEventListener('input', event => { inventoryQuery = normalize(event.target.value); renderInventoryTable(activeInventory()); });
    els.exportMarkdownButton?.addEventListener('click', exportMarkdown);
    els.deleteInventoryButton?.addEventListener('click', deleteActiveInventory);
    els.compareButton?.addEventListener('click', renderComparison);
    els.openUpdaterFromDashboard?.addEventListener('click', () => $('#openUpdater')?.click());

    els.openScheduler?.addEventListener('click', () => { updateSchedulerPreview(); els.schedulerDialog.showModal(); });
    els.schedulerDialog?.addEventListener('click', event => { if (event.target === els.schedulerDialog) els.schedulerDialog.close(); });
    [els.scheduleFrequency, els.scheduleDay, els.scheduleTime, els.scheduleSilent, els.scheduleUnknown, els.schedulePinned].filter(Boolean).forEach(input => input.addEventListener('change', updateSchedulerPreview));
    els.copyScheduler?.addEventListener('click', () => copyText(els.schedulerPreview.textContent, 'Programador copiado'));
    els.downloadScheduler?.addEventListener('click', () => downloadText('apphub-404-programar-actualizaciones.ps1', generateSchedulerScript()));
    els.downloadSchedulerRemoval?.addEventListener('click', () => downloadText('apphub-404-eliminar-tarea.ps1', generateSchedulerRemovalScript()));

    els.openRepair?.addEventListener('click', () => { updateRepairPreview(); els.repairDialog.showModal(); });
    els.repairDialog?.addEventListener('click', event => { if (event.target === els.repairDialog) els.repairDialog.close(); });
    [els.repairInfo, els.repairUpdateSources, els.repairAppInstaller].filter(Boolean).forEach(input => input.addEventListener('change', updateRepairPreview));
    els.repairResetSources?.addEventListener('change', () => {
      if (els.repairResetSources.checked && !confirm('Esta opción eliminará todas las fuentes personalizadas de WinGet. ¿Quieres mantenerla activada?')) {
        els.repairResetSources.checked = false;
      }
      updateRepairPreview();
    });
    els.copyRepair?.addEventListener('click', () => copyText(els.repairPreview.textContent, 'Script de reparación copiado'));
    els.downloadRepair?.addEventListener('click', () => downloadText('apphub-404-reparar-winget.ps1', generateRepairScript()));
    els.downloadUninstaller?.addEventListener('click', downloadUninstaller);
    els.downloadCatalogValidator?.addEventListener('click', downloadCatalogValidator);
    els.downloadDriverBackup?.addEventListener('click', () => downloadText('apphub-404-backup-drivers.ps1', generateDriverBackupScript()));
    els.downloadDriverInventory?.addEventListener('click', () => downloadText('apphub-404-inventario-drivers.ps1', generateDriverInventoryScript()));
    els.downloadDriverRestore?.addEventListener('click', () => downloadText('apphub-404-restaurar-drivers.ps1', generateDriverRestoreScript()));

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (els.schedulerDialog?.open) els.schedulerDialog.close();
      if (els.repairDialog?.open) els.repairDialog.close();
    });
  }

  async function importInventoryFile(file) {
    els.inventoryFileInput.value = '';
    if (!file) return;
    try {
      const data = await readJSONFile(file);
      validateInventory(data);
      const inventory = normalizeInventory(data);
      inventories = [inventory, ...inventories.filter(item => item.id !== inventory.id)].slice(0, MAX_INVENTORIES);
      activeId = inventory.id;
      persistInventories();
      renderAll();
      toast(`Inventario de ${inventory.computer.name} importado`);
      document.querySelector('#mi-pc')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      toast(`No se pudo importar: ${error.message}`, true);
    }
  }

  function validateInventory(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('JSON vacío o inválido');
    if (data.schema !== INVENTORY_SCHEMA) throw new Error('Formato de inventario no compatible');
    if (typeof data.computer?.name !== 'string' || !data.computer.name.trim()) throw new Error('Falta el nombre del equipo');
    const scannedAt = new Date(data.scannedAt);
    if (!data.scannedAt || Number.isNaN(scannedAt.getTime())) throw new Error('La fecha de análisis no es válida');
    if (!Array.isArray(data.winget?.packages) || !Array.isArray(data.winget?.updates)) throw new Error('Faltan datos de WinGet');
    if (data.winget.packages.length > MAX_PACKAGES) throw new Error(`El inventario supera ${MAX_PACKAGES} paquetes`);
    if (data.winget.updates.length > MAX_UPDATES) throw new Error(`El inventario supera ${MAX_UPDATES} actualizaciones`);
    if (data.health != null && !Array.isArray(data.health)) throw new Error('El health check no es válido');
  }

  function normalizeInventory(data) {
    const scannedAt = new Date(data.scannedAt).toISOString();
    const computerName = cleanText(data.computer.name, 120) || 'PC';
    const id = `${slug(computerName)}-${scannedAt.replace(/\D/g, '').slice(0, 14)}`;
    const packageItems = data.winget.packages.slice(0, MAX_PACKAGES).map(item => ({
      id: cleanText(item?.id || item?.PackageIdentifier, 180),
      version: cleanText(item?.version || item?.Version, 80),
      source: cleanText(item?.source || item?.Source || 'winget', 80) || 'winget'
    })).filter(item => item.id);
    const updateItems = data.winget.updates.slice(0, MAX_UPDATES).map(item => ({
      name: cleanText(item?.name, 180),
      id: cleanText(item?.id, 180),
      installed: cleanText(item?.installed, 80),
      available: cleanText(item?.available, 80),
      source: cleanText(item?.source, 80)
    })).filter(item => item.id || item.name);
    const healthItems = (Array.isArray(data.health) ? data.health : []).slice(0, MAX_HEALTH).map(item => ({
      id: cleanText(item?.id, 80),
      label: cleanText(item?.label || item?.id || 'Comprobación', 160),
      status: ['ok', 'info', 'warning', 'error'].includes(item?.status) ? item.status : 'info',
      detail: cleanText(item?.detail, MAX_TEXT)
    }));

    return {
      schema: INVENTORY_SCHEMA,
      appVersion: cleanText(data.appVersion || VERSION, 30),
      id,
      scannedAt,
      computer: {
        name: computerName,
        manufacturer: cleanText(data.computer?.manufacturer, 120),
        model: cleanText(data.computer?.model, 160)
      },
      system: {
        caption: cleanText(data.system?.caption, 180),
        edition: cleanText(data.system?.edition, 80),
        version: cleanText(data.system?.version, 80),
        build: cleanText(data.system?.build, 80),
        architecture: cleanText(data.system?.architecture, 80),
        processor: cleanText(data.system?.processor, 180),
        memoryGB: finiteNumber(data.system?.memoryGB),
        systemDriveFreeGB: finiteNumber(data.system?.systemDriveFreeGB),
        optionalFeatures: sanitizeFeatureMap(data.system?.optionalFeatures)
      },
      winget: {
        available: Boolean(data.winget?.available),
        version: cleanText(data.winget?.version, 80),
        packages: uniqueByKey(packageItems, item => item.id.toLowerCase()),
        updates: uniqueByKey(updateItems, item => (item.id || item.name).toLowerCase()),
        infoRaw: cleanText(data.winget?.infoRaw, MAX_RAW_TEXT, true),
        sourcesRaw: cleanText(data.winget?.sourcesRaw, MAX_RAW_TEXT, true),
        pinsRaw: cleanText(data.winget?.pinsRaw, MAX_RAW_TEXT, true),
        updatesRaw: cleanText(data.winget?.updatesRaw, MAX_RAW_TEXT, true)
      },
      software: {
        registryCount: Math.max(0, Math.min(100000, Number(data.software?.registryCount) || 0))
      },
      health: healthItems
    };
  }

  function renderAll() {
    renderInventorySelectors();
    const inventory = activeInventory();
    els.empty.classList.toggle('hidden', Boolean(inventory));
    els.dashboard.classList.toggle('hidden', !inventory);
    if (!inventory) {
      markInstalledApps(new Set());
      return;
    }
    renderSummary(inventory);
    renderHealth(inventory);
    renderUpdates(inventory);
    renderInventoryTable(inventory);
    markInstalledApps(new Set(inventory.winget.packages.map(item => item.id)));
  }

  function renderInventorySelectors() {
    const optionHTML = inventories.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.computer.name)} · ${escapeHTML(formatDate(item.scannedAt))}</option>`).join('');
    [els.inventorySelect, els.compareA, els.compareB].filter(Boolean).forEach(select => {
      const previous = select.value;
      select.innerHTML = optionHTML || '<option value="">Sin inventarios</option>';
      if ([...select.options].some(option => option.value === previous)) select.value = previous;
    });
    if (els.inventorySelect && activeId) els.inventorySelect.value = activeId;
    if (els.compareA && inventories[0]) els.compareA.value ||= inventories[0].id;
    if (els.compareB && inventories[1] && (!els.compareB.value || els.compareB.value === els.compareA?.value)) els.compareB.value = inventories[1].id;
    els.compareButton.disabled = inventories.length < 2;
  }

  function renderSummary(inventory) {
    const recognized = inventory.winget.packages.length;
    const registryCount = Number(inventory.software?.registryCount || inventory.software?.items?.length || recognized);
    const matches = inventory.winget.packages.filter(item => appById.has(item.id)).length;
    els.pcName.textContent = inventory.computer.name;
    els.pcModel.textContent = [inventory.computer.manufacturer, inventory.computer.model].filter(Boolean).join(' · ') || 'Modelo no detectado';
    els.windows.textContent = inventory.system?.caption || inventory.system?.edition || 'Windows';
    els.windowsBuild.textContent = `Build ${inventory.system?.build || '—'} · ${inventory.system?.architecture || '—'}`;
    els.installedCount.textContent = String(registryCount);
    els.catalogMatch.textContent = `${matches} del catálogo · ${recognized} WinGet`;
    els.updatesCount.textContent = String(inventory.winget.updates.length);
    els.scanDate.textContent = `Analizado ${formatDate(inventory.scannedAt)}`;
  }

  function renderHealth(inventory) {
    const health = inventory.health.length ? inventory.health : [{ label: 'Inventario importado', status: 'info', detail: 'El analizador no incluyó comprobaciones de salud.' }];
    const points = health.map(item => ({ ok: 100, info: 85, warning: 55, error: 10 }[item.status] ?? 70));
    const score = Math.round(points.reduce((sum, value) => sum + value, 0) / points.length);
    els.healthScore.textContent = `${score}/100`;
    els.healthScore.dataset.level = score >= 80 ? 'good' : score >= 55 ? 'warning' : 'danger';
    els.healthScore.title = 'Puntuación orientativa calculada a partir de las comprobaciones importadas.';
    els.healthList.innerHTML = health.map(item => `<article class="health-item" data-status="${escapeHTML(item.status || 'info')}"><span class="health-dot" aria-hidden="true"></span><div><strong>${escapeHTML(item.label || item.id || 'Comprobación')}</strong><small>${escapeHTML(item.detail || '')}</small></div></article>`).join('');
  }

  function renderUpdates(inventory) {
    const updates = inventory.winget.updates.slice(0, 50);
    els.updatesBody.innerHTML = updates.length ? updates.map(item => `<tr><td>${escapeHTML(item.name || item.id)}</td><td>${escapeHTML(item.installed || '—')}</td><td>${escapeHTML(item.available || '—')}</td></tr>`).join('') : '<tr><td class="empty-row" colspan="3">No se detectaron actualizaciones pendientes.</td></tr>';
  }

  function renderInventoryTable(inventory) {
    if (!inventory) return;
    const filtered = inventory.winget.packages.filter(item => {
      const app = appById.get(item.id);
      return !inventoryQuery || normalize(`${app?.name || ''} ${item.id} ${item.version} ${item.source}`).includes(inventoryQuery);
    });
    els.inventoryBody.innerHTML = filtered.length ? filtered.map(item => {
      const app = appById.get(item.id);
      return `<tr><td>${escapeHTML(app?.name || item.id)}</td><td><code>${escapeHTML(item.id)}</code></td><td>${escapeHTML(item.version || '—')}</td><td>${escapeHTML(item.source || '—')}</td></tr>`;
    }).join('') : '<tr><td class="empty-row" colspan="4">No hay coincidencias.</td></tr>';
  }

  function renderComparison() {
    const a = inventories.find(item => item.id === els.compareA.value);
    const b = inventories.find(item => item.id === els.compareB.value);
    if (!a || !b || a.id === b.id) {
      els.compareResults.innerHTML = '<p>Selecciona dos inventarios diferentes.</p>';
      return;
    }
    const setA = new Set(a.winget.packages.map(item => item.id));
    const setB = new Set(b.winget.packages.map(item => item.id));
    const onlyA = [...setA].filter(id => !setB.has(id)).sort();
    const onlyB = [...setB].filter(id => !setA.has(id)).sort();
    const renderList = ids => ids.length ? `<ul>${ids.map(id => `<li>${escapeHTML(appById.get(id)?.name || id)}</li>`).join('')}</ul>` : '<p>Sin diferencias.</p>';
    els.compareResults.innerHTML = `<p>${setA.size} paquetes en <strong>${escapeHTML(a.computer.name)}</strong> frente a ${setB.size} en <strong>${escapeHTML(b.computer.name)}</strong>.</p><div class="compare-columns"><div class="compare-column"><h4>Solo en ${escapeHTML(a.computer.name)} (${onlyA.length})</h4>${renderList(onlyA)}</div><div class="compare-column"><h4>Solo en ${escapeHTML(b.computer.name)} (${onlyB.length})</h4>${renderList(onlyB)}</div></div>`;
  }

  function deleteActiveInventory() {
    const current = activeInventory();
    if (!current || !confirm(`¿Eliminar el inventario de ${current.computer.name}?`)) return;
    inventories = inventories.filter(item => item.id !== current.id);
    activeId = inventories[0]?.id || '';
    persistInventories();
    renderAll();
    toast('Inventario eliminado');
  }

  function exportMarkdown() {
    const inventory = activeInventory();
    if (!inventory) return toast('Importa primero un inventario', true);
    const updates = inventory.winget.updates.map(item => `- ${item.name || item.id}: ${item.installed || '?'} → ${item.available || '?'}`).join('\n') || '- Ninguna detectada';
    const packages = inventory.winget.packages.map(item => `- ${appById.get(item.id)?.name || item.id} (${item.id})${item.version ? ` — ${item.version}` : ''}`).join('\n');
    const markdown = `# Inventario de ${inventory.computer.name}\n\nGenerado: ${formatDate(inventory.scannedAt)}\n\n## Sistema\n\n- Fabricante: ${inventory.computer.manufacturer || 'No detectado'}\n- Modelo: ${inventory.computer.model || 'No detectado'}\n- Windows: ${inventory.system?.caption || 'Windows'}\n- Build: ${inventory.system?.build || 'No detectada'}\n- Arquitectura: ${inventory.system?.architecture || 'No detectada'}\n- WinGet: ${inventory.winget?.version || 'No detectado'}\n\n## Actualizaciones pendientes\n\n${updates}\n\n## Paquetes reconocidos por WinGet (${inventory.winget.packages.length})\n\n${packages}\n`;
    downloadText(`inventario-${slug(inventory.computer.name)}.md`, markdown, 'text/markdown;charset=utf-8');
  }

  function exportBackup() {
    const selection = loadJSON('apphub-selection', []).filter(id => appById.has(id) && !appById.get(id).externalOnly);
    const favorites = loadJSON('apphub-favorites', []).filter(id => appById.has(id));
    const backup = {
      schema: BACKUP_SCHEMA,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      settings: {
        selection,
        favorites,
        theme: ['dark', 'light'].includes(localStorageSafeGet('apphub-theme')) ? localStorageSafeGet('apphub-theme') : 'dark',
        activeInventory: activeId
      },
      inventories
    };
    downloadText(`apphub-404-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(backup, null, 2), 'application/json');
  }

  async function importBackupFile(file) {
    els.backupFileInput.value = '';
    if (!file) return;
    try {
      const backup = await readJSONFile(file);
      if (!backup || typeof backup !== 'object' || backup.schema !== BACKUP_SCHEMA || !Array.isArray(backup.inventories)) {
        throw new Error('Backup no compatible');
      }
      if (backup.inventories.length > MAX_INVENTORIES) throw new Error(`El backup supera ${MAX_INVENTORIES} inventarios`);
      const normalized = backup.inventories.map(item => {
        validateInventory(item);
        return normalizeInventory(item);
      });
      const selection = uniqueStrings(backup.settings?.selection).filter(id => appById.has(id) && !appById.get(id).externalOnly);
      const favorites = uniqueStrings(backup.settings?.favorites).filter(id => appById.has(id));
      const theme = ['dark', 'light'].includes(backup.settings?.theme) ? backup.settings.theme : 'dark';
      inventories = normalized;
      activeId = inventories.some(item => item.id === backup.settings?.activeInventory) ? backup.settings.activeInventory : inventories[0]?.id || '';
      if (!saveJSON('apphub-selection', selection) || !saveJSON('apphub-favorites', favorites) || !localStorageSafeSet('apphub-theme', theme) || !persistInventories()) {
        throw new Error('No hay espacio disponible para guardar el backup');
      }
      renderAll();
      window.dispatchEvent(new CustomEvent('apphub:settings-restored', { detail: { selection, favorites, theme } }));
      toast('Backup restaurado y aplicado');
    } catch (error) {
      toast(`No se pudo restaurar: ${error.message}`, true);
    }
  }

  function powershellAdminGuard() {
    return `$CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = [Security.Principal.WindowsPrincipal]::new($CurrentIdentity)
if (-not $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    if (-not $PSCommandPath) { Write-Error 'Guarda primero el script como archivo .ps1 para poder solicitar UAC.'; exit 1 }
    Write-Host 'Solicitando permisos de administrador mediante UAC...' -ForegroundColor Yellow
    try {
        $PowerShellExe = (Get-Process -Id $PID -ErrorAction Stop).Path
        if (-not $PowerShellExe) { throw 'No se pudo identificar el ejecutable de PowerShell actual.' }
        $Psi = New-Object System.Diagnostics.ProcessStartInfo
        $Psi.FileName = $PowerShellExe
        $Psi.UseShellExecute = $true
        $Psi.Verb = 'runas'
        $Psi.WorkingDirectory = Split-Path -Parent $PSCommandPath
        $Psi.Arguments = '-NoLogo -NoProfile -File "' + $PSCommandPath + '"'
        $Elevated = [System.Diagnostics.Process]::Start($Psi)
        if ($null -ne $Elevated) { exit 0 }
        throw 'No se pudo iniciar el proceso elevado.'
    } catch {
        Write-Error ('No se pudo obtener elevación UAC: ' + $_.Exception.Message)
        Write-Host 'Alternativa fiable: abre Windows Terminal o PowerShell como administrador y ejecuta este archivo.' -ForegroundColor Yellow
        Read-Host 'Pulsa Enter para cerrar'
        exit 1
    }
}`;
  }

  function updateSchedulerPreview() {
    if (!els.schedulerPreview) return;
    els.scheduleDayRow.classList.toggle('hidden', els.scheduleFrequency.value === 'daily');
    els.schedulerPreview.textContent = generateSchedulerScript();
  }

  function generateSchedulerScript() {
    const frequency = els.scheduleFrequency?.value || 'weekly';
    const day = els.scheduleDay?.value || 'Sunday';
    const time = els.scheduleTime?.value || '09:00';
    const flags = ['--all', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'];
    if (els.scheduleSilent?.checked) flags.push('--silent');
    if (els.scheduleUnknown?.checked) flags.push('--include-unknown');
    if (els.schedulePinned?.checked) flags.push('--include-pinned');
    const trigger = frequency === 'daily'
      ? `$Trigger = New-ScheduledTaskTrigger -Daily -At '${time}'`
      : `$Trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek ${day} -At '${time}'`;
    return `# AppHub 404 v${VERSION} · Programador de actualizaciones
# Se autoeleva mediante UAC si es necesario. La tarea se ejecuta solo con el usuario conectado.

$ErrorActionPreference = 'Stop'
${powershellAdminGuard()}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'WinGet no está disponible.' }

$Base = Join-Path $env:ProgramData 'AppHub404'
$Worker = Join-Path $Base 'Update-Apps.ps1'
$LogDir = Join-Path $Base 'Logs'
New-Item -ItemType Directory -Path $Base,$LogDir -Force | Out-Null

@'
$ErrorActionPreference = 'Continue'
$LogDir = Join-Path $env:ProgramData 'AppHub404\\Logs'
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$Log = Join-Path $LogDir ('Update-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
winget source update --disable-interactivity 2>&1 | Tee-Object -FilePath $Log -Append
winget upgrade ${flags.join(' ')} 2>&1 | Tee-Object -FilePath $Log -Append
exit $LASTEXITCODE
'@ | Set-Content -Path $Worker -Encoding UTF8

$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -File "{0}"' -f $Worker)
${trigger}
$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 4) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName 'AppHub 404 - Actualizar aplicaciones' -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description 'Actualiza aplicaciones compatibles mediante WinGet.' -Force | Out-Null
Write-Host 'Tarea creada correctamente.' -ForegroundColor Green
Write-Host ('Script de trabajo: {0}' -f $Worker)
Write-Host ('Registros: {0}' -f $LogDir)
`;
  }

  function generateSchedulerRemovalScript() {
    return `# AppHub 404 v${VERSION} · Eliminar tarea programada
# Se autoeleva mediante UAC si es necesario. Solo elimina la tarea y su script de trabajo.

$ErrorActionPreference = 'Stop'
${powershellAdminGuard()}

$TaskName = 'AppHub 404 - Actualizar aplicaciones'
$Worker = Join-Path $env:ProgramData 'AppHub404\\Update-Apps.ps1'
$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host 'Tarea programada eliminada.' -ForegroundColor Green
} else {
    Write-Host 'La tarea no existe.' -ForegroundColor Yellow
}
if (Test-Path $Worker) {
    Remove-Item -LiteralPath $Worker -Force
    Write-Host 'Script de trabajo eliminado.' -ForegroundColor Green
}
Read-Host 'Pulsa Enter para cerrar'
`;
  }

  function updateRepairPreview() {
    if (!els.repairPreview) return;
    els.repairPreview.textContent = generateRepairScript();
    els.repairHint.textContent = els.repairResetSources.checked ? 'Atención: se eliminarán fuentes personalizadas y se restaurarán las predeterminadas.' : 'La configuración predeterminada no elimina fuentes.';
  }

  function generateRepairScript() {
    const info = els.repairInfo?.checked;
    const update = els.repairUpdateSources?.checked;
    const appInstaller = els.repairAppInstaller?.checked;
    const reset = els.repairResetSources?.checked;
    return `# AppHub 404 v${VERSION} · Diagnóstico y reparación de WinGet
# Revisa las opciones antes de ejecutar.

$ErrorActionPreference = 'Continue'
${powershellAdminGuard()}

$Log = Join-Path $env:TEMP ('AppHub404-Repair-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
function Run-Step([string]$Title, [scriptblock]$Action) {
    Write-Host ''
    Write-Host ('=== ' + $Title + ' ===') -ForegroundColor Cyan
    try { & $Action 2>&1 | Tee-Object -FilePath $Log -Append } catch { $_ | Out-String | Tee-Object -FilePath $Log -Append }
}

Run-Step 'Comprobar WinGet' {
    if (Get-Command winget -ErrorAction SilentlyContinue) { winget --version } else { throw 'WinGet no está disponible.' }
}
${info ? `Run-Step 'Información de WinGet' { winget --info }
Run-Step 'Fuentes configuradas' { winget source list }
` : ''}${update ? `Run-Step 'Actualizar fuentes' { winget source update --disable-interactivity }
` : ''}${appInstaller ? `Run-Step 'Restablecer App Installer' {
    $Package = Get-AppxPackage Microsoft.DesktopAppInstaller
    if (-not $Package) { throw 'App Installer no está instalado para este usuario.' }
    if (Get-Command Reset-AppxPackage -ErrorAction SilentlyContinue) { $Package | Reset-AppxPackage }
    else { Add-AppxPackage -DisableDevelopmentMode -Register (Join-Path $Package.InstallLocation 'AppxManifest.xml') }
}
` : ''}${reset ? `Run-Step 'RESTABLECER FUENTES PREDETERMINADAS' { winget source reset --force }
Run-Step 'Actualizar fuentes restauradas' { winget source update --disable-interactivity }
` : ''}
Write-Host ''
Write-Host ('Diagnóstico finalizado. Registro: {0}' -f $Log) -ForegroundColor Green
Read-Host 'Pulsa Enter para cerrar'
`;
  }

  function downloadUninstaller() {
    const ids = loadJSON('apphub-selection', []).filter(id => appById.has(id) && !appById.get(id).externalOnly);
    if (!ids.length) return toast('Selecciona primero aplicaciones en el catálogo', true);
    const packages = ids.map(id => {
      const app = appById.get(id);
      return `    [pscustomobject]@{ Name='${psEscape(app.name)}'; Id='${psEscape(id)}'; Source='${psEscape(app.source || 'winget')}' }`;
    }).join(',\n');
    const script = `# AppHub 404 v${VERSION} · Desinstalador de selección
# Revisa la lista. No usa --force ni elimina datos personales de forma adicional.

$ErrorActionPreference = 'Continue'
${powershellAdminGuard()}

$Packages = @(
${packages}
)
Write-Host 'Aplicaciones seleccionadas para desinstalar:' -ForegroundColor Yellow
$Packages | ForEach-Object { Write-Host (' - ' + $_.Name + ' [' + $_.Id + ']') }
$Confirmation = Read-Host 'Escribe DESINSTALAR para continuar'
if ($Confirmation -cne 'DESINSTALAR') {
    Write-Host 'Operación cancelada. No se ha modificado el equipo.' -ForegroundColor Yellow
    exit 0
}
foreach ($Package in $Packages) {
    Write-Host ''
    Write-Host ('=== ' + $Package.Name + ' ===') -ForegroundColor Cyan
    & winget uninstall --id $Package.Id -e --source $Package.Source --accept-source-agreements --disable-interactivity 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { Write-Host ('Error al desinstalar. Código: ' + $LASTEXITCODE) -ForegroundColor Red }
}
Read-Host 'Pulsa Enter para cerrar'
`;
    downloadText('apphub-404-desinstalar-seleccion.ps1', script);
  }

  function downloadCatalogValidator() {
    const installable = DATA.apps.filter(app => !app.externalOnly);
    const packages = installable.map(app =>
      `    [pscustomobject]@{ Name='${psEscape(app.name)}'; Id='${psEscape(app.id)}'; Source='${psEscape(app.source || 'winget')}' }`
    ).join(',\n');
    const script = `# AppHub 404 v${VERSION} · Validador del catálogo WinGet
# Solo consulta metadatos. No instala, actualiza ni desinstala aplicaciones.

[CmdletBinding()]
param([switch]$NoPause)

$ErrorActionPreference = 'Continue'
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error 'WinGet no está disponible. Instala o repara App Installer desde Microsoft Store.'
    exit 1
}

$Packages = @(
${packages}
)
$Results = [System.Collections.Generic.List[object]]::new()

Write-Host '=== AppHub 404 · Validación de catálogo ===' -ForegroundColor Cyan
Write-Host ('Paquetes a comprobar: {0}' -f $Packages.Count) -ForegroundColor DarkGray

foreach ($Package in $Packages) {
    Write-Host ('Comprobando {0} [{1}]...' -f $Package.Name, $Package.Id)
    & winget show --id $Package.Id -e --source $Package.Source --accept-source-agreements --disable-interactivity *> $null
    $ExitCode = $LASTEXITCODE
    $Results.Add([pscustomobject]@{
        name = $Package.Name
        id = $Package.Id
        source = $Package.Source
        available = ($ExitCode -eq 0)
        exitCode = $ExitCode
    })
}

$Unavailable = @($Results | Where-Object { -not $_.available })
$Desktop = [Environment]::GetFolderPath('Desktop')
$OutputPath = Join-Path $Desktop ('AppHub404-CatalogValidation-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')
$Report = [ordered]@{
    schema = 'apphub-404-catalog-validation-v1'
    appVersion = '${VERSION}'
    checkedAt = (Get-Date).ToUniversalTime().ToString('o')
    computer = $env:COMPUTERNAME
    wingetVersion = (& winget --version 2>$null | Select-Object -First 1)
    total = $Results.Count
    available = @($Results | Where-Object available).Count
    unavailable = $Unavailable.Count
    results = @($Results)
}
$Report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding UTF8

Write-Host ''
if ($Unavailable.Count -eq 0) {
    Write-Host 'Catálogo validado: todos los paquetes están disponibles.' -ForegroundColor Green
} else {
    Write-Warning ('Paquetes no disponibles: {0}' -f $Unavailable.Count)
    $Unavailable | Format-Table name,id,source,exitCode -AutoSize
}
Write-Host ('Informe: {0}' -f $OutputPath) -ForegroundColor Cyan
if (-not $NoPause) { Read-Host 'Pulsa Enter para cerrar' }
`;
    downloadText('apphub-404-validar-catalogo.ps1', script);
  }

  function driverAdminGuard() {
    return powershellAdminGuard();
  }

  function driverFolderPicker(title, description) {
    return `Add-Type -AssemblyName System.Windows.Forms
$Dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$Dialog.Description = '${description}'
$Dialog.ShowNewFolderButton = $true
if ($Dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
    Write-Host 'Operación cancelada.' -ForegroundColor Yellow
    exit 0
}
$SelectedFolder = $Dialog.SelectedPath
`;
  }

  function generateDriverBackupScript() {
    return `# AppHub 404 v${VERSION} · Drivers 404 · Backup de drivers
# Exporta paquetes de controladores de terceros del Driver Store. No exporta utilidades OEM ni instaladores EXE.

[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
${driverAdminGuard()}
${driverFolderPicker('backup', 'Elige la carpeta donde guardar el backup de drivers')}
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Computer = ($env:COMPUTERNAME -replace '[^A-Za-z0-9._-]', '_')
$BackupRoot = Join-Path $SelectedFolder ("DriversBackup-$Computer-$Stamp")
$DriversPath = Join-Path $BackupRoot 'Drivers'
New-Item -ItemType Directory -Path $DriversPath -Force | Out-Null
$LogPath = Join-Path $BackupRoot 'backup-drivers.log'
$InventoryPath = Join-Path $BackupRoot 'drivers-inventory.txt'
$SummaryPath = Join-Path $BackupRoot 'README-BACKUP.txt'

Write-Host '=== AppHub 404 · Backup de drivers ===' -ForegroundColor Cyan
Write-Host ('Destino: ' + $BackupRoot)

& pnputil.exe /enum-drivers 2>&1 | Tee-Object -FilePath $InventoryPath | Out-Host
Write-Host ''
Write-Host 'Exportando drivers con PnPUtil...' -ForegroundColor Cyan
& pnputil.exe /export-driver '*' $DriversPath 2>&1 | Tee-Object -FilePath $LogPath | Out-Host
$ExitCode = $LASTEXITCODE
$Method = 'PnPUtil'

if ($ExitCode -ne 0) {
    Write-Warning ('PnPUtil devolvió código ' + $ExitCode + '. Probando DISM como fallback...')
    & dism.exe /Online /Export-Driver (('/Destination:{0}' -f $DriversPath)) 2>&1 | Tee-Object -FilePath $LogPath -Append | Out-Host
    $ExitCode = $LASTEXITCODE
    $Method = 'DISM fallback'
}

$InfFiles = @(Get-ChildItem -LiteralPath $DriversPath -Filter '*.inf' -Recurse -File -ErrorAction SilentlyContinue)
$Summary = @(
    'AppHub 404 · Drivers 404',
    ('Equipo: ' + $env:COMPUTERNAME),
    ('Fecha: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
    ('Método: ' + $Method),
    ('Código de salida: ' + $ExitCode),
    ('Paquetes INF exportados: ' + $InfFiles.Count),
    ('Carpeta: ' + $DriversPath),
    '',
    'Este backup contiene paquetes INF del Driver Store. No garantiza incluir aplicaciones, paneles o instaladores OEM del fabricante.'
)
$Summary | Set-Content -LiteralPath $SummaryPath -Encoding UTF8

if ($ExitCode -eq 0 -and $InfFiles.Count -gt 0) {
    Write-Host ('Backup completado. INF encontrados: ' + $InfFiles.Count) -ForegroundColor Green
    Write-Host ('Carpeta: ' + $BackupRoot) -ForegroundColor Green
    Start-Process explorer.exe -ArgumentList ('"' + $BackupRoot + '"')
} else {
    Write-Error ('El backup no pudo verificarse. Código: ' + $ExitCode + '; INF encontrados: ' + $InfFiles.Count)
}
Read-Host 'Pulsa Enter para cerrar'
`;
  }

  function generateDriverInventoryScript() {
    return `# AppHub 404 v${VERSION} · Drivers 404 · Inventario de drivers
# Solo lectura: enumera paquetes de controladores de terceros.

[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
${driverFolderPicker('inventory', 'Elige la carpeta donde guardar el inventario de drivers')}
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$Computer = ($env:COMPUTERNAME -replace '[^A-Za-z0-9._-]', '_')
$Output = Join-Path $SelectedFolder ("DriversInventory-$Computer-$Stamp.txt")

Write-Host '=== AppHub 404 · Inventario de drivers ===' -ForegroundColor Cyan
$Header = @(
    'AppHub 404 · Drivers 404 · Inventario',
    ('Equipo: ' + $env:COMPUTERNAME),
    ('Fecha: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')),
    ''
)
$Header | Set-Content -LiteralPath $Output -Encoding UTF8
& pnputil.exe /enum-drivers 2>&1 | Tee-Object -FilePath $Output -Append | Out-Host
if ($LASTEXITCODE -ne 0) { Write-Error ('PnPUtil devolvió código: ' + $LASTEXITCODE) }
Write-Host ('Inventario guardado en: ' + $Output) -ForegroundColor Green
Read-Host 'Pulsa Enter para cerrar'
`;
  }

  function generateDriverRestoreScript() {
    return `# AppHub 404 v${VERSION} · Drivers 404 · Restaurar drivers
# Agrega al Driver Store los INF encontrados y solicita instalación sobre dispositivos existentes.

[CmdletBinding()]
param()
$ErrorActionPreference = 'Continue'
${driverAdminGuard()}
${driverFolderPicker('restore', 'Elige la carpeta Drivers de un backup creado por AppHub 404')}
$InfFiles = @(Get-ChildItem -LiteralPath $SelectedFolder -Filter '*.inf' -Recurse -File -ErrorAction SilentlyContinue)
if ($InfFiles.Count -eq 0) {
    Write-Error 'No se encontraron archivos INF en la carpeta seleccionada.'
    Read-Host 'Pulsa Enter para cerrar'
    exit 2
}

Write-Host '=== AppHub 404 · Restaurar drivers ===' -ForegroundColor Cyan
Write-Host ('INF encontrados: ' + $InfFiles.Count) -ForegroundColor Yellow
Write-Host 'Windows decidirá qué controlador es aplicable; no se fuerzan eliminaciones ni downgrades.' -ForegroundColor Yellow
$Confirm = Read-Host 'Escribe RESTAURAR para continuar'
if ($Confirm -cne 'RESTAURAR') {
    Write-Host 'Operación cancelada. No se ha modificado el equipo.' -ForegroundColor Yellow
    exit 0
}

$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogPath = Join-Path $SelectedFolder ("restore-drivers-$Stamp.log")
$Ok = 0; $Failed = 0; $Reboot = $false
foreach ($Inf in $InfFiles) {
    Write-Host ('Procesando: ' + $Inf.FullName) -ForegroundColor Cyan
    & pnputil.exe /add-driver $Inf.FullName /install 2>&1 | Tee-Object -FilePath $LogPath -Append | Out-Host
    $Code = $LASTEXITCODE
    if ($Code -in @(0, 3010, 1641)) {
        $Ok++
        if ($Code -in @(3010, 1641)) { $Reboot = $true }
    } else {
        $Failed++
        Add-Content -LiteralPath $LogPath -Value ('ERROR ' + $Code + ' :: ' + $Inf.FullName)
    }
}

Write-Host ''
Write-Host ('Correctos: ' + $Ok + ' · Fallidos: ' + $Failed) -ForegroundColor $(if ($Failed -eq 0) { 'Green' } else { 'Yellow' })
Write-Host ('Log: ' + $LogPath)
if ($Reboot) { Write-Warning 'Algún controlador indicó que puede requerirse reinicio.' }
Read-Host 'Pulsa Enter para cerrar'
`;
  }

  function observeCatalog() {
    const grid = $('#appsGrid');
    if (!grid) return;
    new MutationObserver(() => {
      const inventory = activeInventory();
      markInstalledApps(new Set(inventory?.winget?.packages?.map(item => item.id) || []));
    }).observe(grid, { childList: true, subtree: false });
  }

  function markInstalledApps(installedIds) {
    $$('.app-card').forEach(card => {
      card.querySelector('.installed-badge')?.remove();
      if (!installedIds.has(card.dataset.id)) return;
      const badge = document.createElement('span');
      badge.className = 'installed-badge';
      badge.textContent = 'INSTALADA';
      card.append(badge);
    });
  }

  function loadStoredInventories() {
    const stored = loadJSON(INVENTORY_KEY, []);
    if (!Array.isArray(stored)) return [];
    return stored.slice(0, MAX_INVENTORIES).flatMap(item => {
      try {
        validateInventory(item);
        return [normalizeInventory(item)];
      } catch {
        return [];
      }
    });
  }

  function activeInventory() { return inventories.find(item => item.id === activeId) || inventories[0] || null; }
  function persistInventories() {
    const stored = saveJSON(INVENTORY_KEY, inventories) && localStorageSafeSet(ACTIVE_KEY, activeId);
    if (!stored) toast('No se pudieron guardar los inventarios: almacenamiento local lleno o bloqueado', true);
    return stored;
  }

  async function readJSONFile(file) {
    if (file.size > MAX_FILE_BYTES) throw new Error('el archivo supera 5 MB');
    const text = (await file.text()).replace(/^\uFEFF/, '');
    try { return JSON.parse(text); } catch { throw new Error('JSON mal formado'); }
  }

  function downloadText(filename, content, type = 'text/plain;charset=utf-8') {
    const payload = filename.toLowerCase().endsWith('.ps1') ? `\uFEFF${content}` : content;
    const blob = new Blob([payload], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${filename} descargado`);
  }

  async function copyText(text, message) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.readOnly = true;
      area.className = 'clipboard-helper';
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    toast(message);
  }

  function toast(message, error = false) {
    const item = document.createElement('div');
    item.className = error ? 'toast toast-error' : 'toast';
    item.textContent = message;
    els.toastRegion?.append(item);
    setTimeout(() => item.remove(), 3400);
  }

  function formatDate(value) {
    try { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
    catch { return value || '—'; }
  }
  function normalize(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function slug(value) { return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pc'; }
  function psEscape(value) { return String(value).replace(/'/g, "''"); }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char])); }
  function cleanText(value, maxLength = MAX_TEXT, preserveLines = false) {
    if (value == null) return '';
    const normalized = String(value).replace(/\u0000/g, '').replace(preserveLines ? /[\t\r]+/g : /[\t\r\n]+/g, preserveLines ? ' ' : ' ').trim();
    return normalized.slice(0, maxLength);
  }
  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function sanitizeFeatureMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, state]) => [cleanText(key, 80), cleanText(state, 80)]).filter(([key]) => key));
  }
  function uniqueByKey(items, getKey) {
    const seen = new Set();
    return items.filter(item => {
      const key = getKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function uniqueStrings(value) {
    return [...new Set((Array.isArray(value) ? value : []).filter(item => typeof item === 'string').map(item => item.slice(0, 180)))];
  }
  function loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  function localStorageSafeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function localStorageSafeSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
})();
