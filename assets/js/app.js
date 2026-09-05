(() => {
  'use strict';

  const CONFIG = window.APPHUB_CONFIG || { version: '2.5.0' };
  const VERSION = CONFIG.version;
  const DATA = window.APPHUB_DATA;
  if (!DATA || !Array.isArray(DATA.apps) || !Array.isArray(DATA.categories) || !Array.isArray(DATA.packs)) {
    throw new Error('El catálogo de AppHub 404 no se pudo cargar.');
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const appsById = new Map(DATA.apps.map(app => [app.id, app]));
  const categoriesById = new Map(DATA.categories.map(category => [category.id, category]));
  const state = {
    selected: new Set(loadJSON('apphub-selection', []).filter(id => appsById.has(id) && !appsById.get(id).externalOnly)),
    favorites: new Set(loadJSON('apphub-favorites', []).filter(id => appsById.has(id))),
    query: '',
    category: 'all',
    favoritesOnly: false
  };

  const els = {
    appsGrid: $('#appsGrid'), packsGrid: $('#packsGrid'), searchInput: $('#searchInput'),
    categoryFilter: $('#categoryFilter'), favoritesFilter: $('#favoritesFilter'),
    clearFilters: $('#clearFilters'), resultsCount: $('#resultsCount'), emptyState: $('#emptyState'),
    selectedCount: $('#selectedCount'), selectedLabel: $('#selectedLabel'), selectionDock: $('#selectionDock'),
    generateQuick: $('#generateQuick'), openBuilder: $('#openBuilder'), builderDialog: $('#builderDialog'),
    selectedAppsList: $('#selectedAppsList'), clearSelection: $('#clearSelection'),
    scriptPreview: $('#scriptPreview'), copyPreview: $('#copyPreview'), downloadScript: $('#downloadScript'),
    builderHint: $('#builderHint'), themeToggle: $('#themeToggle'), toastRegion: $('#toastRegion'),
    loadEssentialsHero: $('#loadEssentialsHero'), openUpdaterHero: $('#openUpdaterHero'),
    openUpdater: $('#openUpdater'), copyScanCommand: $('#copyScanCommand'),
    updaterDialog: $('#updaterDialog'), updaterPreview: $('#updaterPreview'),
    copyUpdaterPreview: $('#copyUpdaterPreview'), downloadUpdater: $('#downloadUpdater'),
    updaterHint: $('#updaterHint'), connectionStatus: $('#connectionStatus')
  };

  init();

  function init() {
    populateCategoryFilter();
    renderStats();
    renderPacks();
    renderApps();
    updateSelectionUI();
    bindEvents();
    restoreTheme();
    updateConnectionStatus();
    $('#appVersionLabel').textContent = `v${VERSION} · Auditoría, seguridad y estabilidad`;
    registerServiceWorker();
  }

  function bindEvents() {
    els.searchInput.addEventListener('input', event => {
      state.query = normalize(event.target.value);
      renderApps();
    });
    els.categoryFilter.addEventListener('change', event => {
      state.category = event.target.value;
      renderApps();
    });
    els.favoritesFilter.addEventListener('click', () => {
      state.favoritesOnly = !state.favoritesOnly;
      els.favoritesFilter.setAttribute('aria-pressed', String(state.favoritesOnly));
      els.favoritesFilter.textContent = state.favoritesOnly ? '★ Favoritos' : '☆ Favoritos';
      renderApps();
    });
    els.clearFilters.addEventListener('click', clearFilters);
    els.appsGrid.addEventListener('click', handleAppAction);
    els.packsGrid.addEventListener('click', handlePackAction);
    els.openBuilder.addEventListener('click', openBuilder);
    els.generateQuick.addEventListener('click', openBuilder);
    els.clearSelection.addEventListener('click', () => {
      state.selected.clear();
      persistSelection();
      renderApps();
      updateSelectionUI();
      updateBuilder();
    });
    els.selectedAppsList.addEventListener('click', event => {
      const button = event.target.closest('[data-remove]');
      if (!button) return;
      toggleSelected(button.dataset.remove, false);
      updateBuilder();
    });
    els.builderDialog.addEventListener('click', event => {
      if (event.target === els.builderDialog) els.builderDialog.close();
    });
    $$('input[name="format"]').forEach(input => input.addEventListener('change', updateBuilder));
    ['optionUpdateSources','optionSilent','optionUpgrade','optionCreateRestore','optionPause']
      .forEach(id => $(`#${id}`).addEventListener('change', updateBuilder));
    els.copyPreview.addEventListener('click', copyPreview);
    els.downloadScript.addEventListener('click', downloadCurrentScript);
    els.themeToggle.addEventListener('click', toggleTheme);
    els.loadEssentialsHero.addEventListener('click', () => loadPack('essential'));
    els.openUpdaterHero.addEventListener('click', openUpdater);
    els.openUpdater.addEventListener('click', openUpdater);
    els.copyScanCommand.addEventListener('click', copyScanCommand);
    els.updaterDialog.addEventListener('click', event => {
      if (event.target === els.updaterDialog) els.updaterDialog.close();
    });
    $$('input[name="updaterFormat"]').forEach(input => input.addEventListener('change', updateUpdater));
    ['updaterUpdateSources','updaterSilent','updaterUnknown','updaterPinned','updaterRestore','updaterPause']
      .forEach(id => $(`#${id}`).addEventListener('change', updateUpdater));
    els.copyUpdaterPreview.addEventListener('click', copyUpdaterPreview);
    els.downloadUpdater.addEventListener('click', downloadUpdaterScript);
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    window.addEventListener('apphub:settings-restored', event => {
      const detail = event.detail || {};
      state.selected = new Set((detail.selection || []).filter(id => appsById.has(id) && !appsById.get(id).externalOnly));
      state.favorites = new Set((detail.favorites || []).filter(id => appsById.has(id)));
      if (detail.theme === 'light' || detail.theme === 'dark') setTheme(detail.theme);
      persistSelection();
      saveJSON('apphub-favorites', [...state.favorites]);
      renderApps();
      updateSelectionUI();
      updateBuilder();
    });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        event.preventDefault();
        els.searchInput.focus();
      }
      if (event.key === 'Escape' && els.builderDialog.open) els.builderDialog.close();
      if (event.key === 'Escape' && els.updaterDialog.open) els.updaterDialog.close();
    });
  }

  function populateCategoryFilter() {
    DATA.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      els.categoryFilter.append(option);
    });
  }

  function renderStats() {
    $('#statApps').textContent = DATA.apps.length;
    $('#statCategories').textContent = DATA.categories.length;
    $('#statPacks').textContent = DATA.packs.length;
  }

  function renderPacks() {
    els.packsGrid.innerHTML = DATA.packs.map(pack => `
      <article class="pack-card">
        <div class="pack-icon" aria-hidden="true">${escapeHTML(pack.icon)}</div>
        <div class="pack-copy">
          <h3>${escapeHTML(pack.name)}</h3>
          <p>${escapeHTML(pack.desc)}</p>
          <span>${pack.apps.length} aplicaciones</span>
        </div>
        <button class="button button-secondary" type="button" data-pack="${escapeHTML(pack.id)}" aria-label="Cargar pack ${escapeHTML(pack.name)}">Cargar pack</button>
      </article>
    `).join('');
  }

  function renderApps() {
    const filtered = DATA.apps.filter(app => {
      const haystack = normalize([app.name, app.id, app.desc, app.release || '', ...(app.badges || []), ...app.tags].join(' '));
      return (!state.query || haystack.includes(state.query)) &&
        (state.category === 'all' || app.category === state.category) &&
        (!state.favoritesOnly || state.favorites.has(app.id));
    });

    els.resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'aplicación' : 'aplicaciones'}`;
    els.emptyState.classList.toggle('hidden', filtered.length !== 0);
    els.appsGrid.innerHTML = filtered.map(renderAppCard).join('');
  }

  function renderAppCard(app) {
    const selected = state.selected.has(app.id);
    const favorite = state.favorites.has(app.id);
    const category = categoriesById.get(app.category)?.name || app.category;
    return `
      <article class="app-card ${selected ? 'is-selected' : ''}" data-id="${escapeHTML(app.id)}">
        <button class="favorite-button" type="button" data-favorite="${escapeHTML(app.id)}" aria-label="${favorite ? 'Quitar' : 'Añadir'} ${escapeHTML(app.name)} ${favorite ? 'de' : 'a'} favoritos" aria-pressed="${favorite}">${favorite ? '★' : '☆'}</button>
        <div class="app-icon" aria-hidden="true">${escapeHTML(app.icon)}</div>
        <div class="app-content">
          <span class="app-category">${escapeHTML(category)}</span>
          <h3>${escapeHTML(app.name)}</h3>
          <p>${escapeHTML(app.desc)}</p>
          ${(app.source || app.requirement || app.release || (app.badges && app.badges.length)) ? `<div class="app-badges">${app.source === 'msstore' ? '<span>Microsoft Store</span>' : ''}${(app.badges || []).map(badge => `<span>${escapeHTML(badge)}</span>`).join('')}${app.release ? `<span class="app-release">${escapeHTML(app.release)}</span>` : ''}${app.requirement ? `<span class="app-requirement">${escapeHTML(app.requirement)}</span>` : ''}</div>` : ''}
          <code>${app.externalOnly ? 'Instalación oficial externa' : escapeHTML(app.id)}</code>
          ${app.links?.length ? `<div class="app-links">${app.links.map(link => `<a href="${escapeHTML(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link.label)} ↗</a>`).join('')}</div>` : ''}
        </div>
        ${app.externalOnly
          ? `<a class="select-app external-app-action" href="${escapeHTML(app.links?.[0]?.url || '#')}" target="_blank" rel="noopener noreferrer" aria-label="Abrir descarga oficial de ${escapeHTML(app.name)}"><span aria-hidden="true">↗</span>Oficial</a>`
          : `<button class="select-app" type="button" data-select="${escapeHTML(app.id)}" aria-pressed="${selected}" aria-label="${selected ? 'Quitar' : 'Añadir'} ${escapeHTML(app.name)} ${selected ? 'de' : 'a'} la selección"><span aria-hidden="true">${selected ? '✓' : '+'}</span>${selected ? 'Seleccionada' : 'Añadir'}</button>`}

      </article>`;
  }

  function handleAppAction(event) {
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      const id = favoriteButton.dataset.favorite;
      state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
      saveJSON('apphub-favorites', [...state.favorites]);
      renderApps();
      toast(state.favorites.has(id) ? 'Añadida a favoritos' : 'Eliminada de favoritos');
      return;
    }
    const selectButton = event.target.closest('[data-select]');
    if (selectButton) toggleSelected(selectButton.dataset.select);
  }

  function handlePackAction(event) {
    const button = event.target.closest('[data-pack]');
    if (button) loadPack(button.dataset.pack);
  }

  function loadPack(packId) {
    const pack = DATA.packs.find(item => item.id === packId);
    if (!pack) return;
    pack.apps.forEach(id => { if (appsById.has(id) && !appsById.get(id).externalOnly) state.selected.add(id); });
    persistSelection();
    renderApps();
    updateSelectionUI();
    toast(`${pack.name}: ${pack.apps.length} aplicaciones cargadas`);
    document.querySelector('#catalogo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleSelected(id, forced) {
    if (!appsById.has(id) || appsById.get(id).externalOnly) return;
    const shouldSelect = forced ?? !state.selected.has(id);
    shouldSelect ? state.selected.add(id) : state.selected.delete(id);
    persistSelection();
    renderApps();
    updateSelectionUI();
  }

  function persistSelection() {
    saveJSON('apphub-selection', [...state.selected]);
  }

  function updateSelectionUI() {
    const count = state.selected.size;
    els.selectedCount.textContent = count;
    els.selectedLabel.textContent = count ? 'Revisar y generar' : 'Selecciona aplicaciones';
    els.generateQuick.disabled = count === 0;
    els.selectionDock.classList.toggle('has-selection', count > 0);
  }

  function openBuilder() {
    if (!state.selected.size) {
      toast('Selecciona al menos una aplicación');
      return;
    }
    updateBuilder();
    els.builderDialog.showModal();
  }

  function updateBuilder() {
    const selectedApps = [...state.selected].map(id => appsById.get(id)).filter(Boolean);
    els.selectedAppsList.innerHTML = selectedApps.length ? selectedApps.map(app => `
      <div class="selected-item"><span class="mini-icon">${escapeHTML(app.icon)}</span><span><strong>${escapeHTML(app.name)}</strong><code>${escapeHTML(app.id)}${app.source === 'msstore' ? ' · Microsoft Store' : ''}</code>${app.requirement ? `<small>${escapeHTML(app.requirement)}</small>` : ''}</span><button type="button" data-remove="${escapeHTML(app.id)}" aria-label="Quitar ${escapeHTML(app.name)}">×</button></div>
    `).join('') : '<p class="muted">No hay aplicaciones seleccionadas.</p>';

    const format = getFormat();
    const content = generateContent(format);
    els.scriptPreview.textContent = content;
    const names = { ps1:'PowerShell', bat:'BAT', json:'JSON WinGet' };
    els.downloadScript.textContent = `Descargar ${names[format]}`;
    els.builderHint.textContent = format === 'json'
      ? 'Ejecuta después: winget import -i apphub-404.json --accept-package-agreements --accept-source-agreements'
      : 'Revisa el archivo antes de ejecutarlo como administrador.';
  }

  function getOptions() {
    return {
      updateSources: $('#optionUpdateSources').checked,
      silent: $('#optionSilent').checked,
      upgrade: $('#optionUpgrade').checked,
      restore: $('#optionCreateRestore').checked,
      pause: $('#optionPause').checked
    };
  }

  function getFormat() {
    return $('input[name="format"]:checked').value;
  }

  function generateContent(format) {
    const ids = [...state.selected].filter(id => appsById.has(id) && !appsById.get(id).externalOnly);
    if (format === 'json') return generateWingetJSON(ids);
    if (format === 'bat') return generateBatch(ids, getOptions());
    return generatePowerShell(ids, getOptions());
  }

  function generatePowerShell(ids, options) {
    const packages = ids.map(id => {
      const app = appsById.get(id);
      return `    @{ Id = '${psEscape(id)}'; Name = '${psEscape(app.name)}'; Source = '${psEscape(app.source || 'winget')}'; Requirement = '${psEscape(app.requirement || '')}' }`;
    }).join(',\n');
    return `# AppHub 404 v${VERSION}
# Generado localmente. Revisa este archivo antes de ejecutarlo.

$ErrorActionPreference = 'Continue'
$CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = [Security.Principal.WindowsPrincipal]::new($CurrentIdentity)
if (-not $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    if (-not $PSCommandPath) { Write-Error 'Guarda el script como .ps1 antes de ejecutarlo para poder solicitar elevación UAC.'; exit 1 }
    Write-Host 'Solicitando permisos de administrador mediante UAC...' -ForegroundColor Yellow
    try {
        $PowerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $QuotedScript = '"{0}"' -f $PSCommandPath.Replace('"','""')
        $RelaunchArgs = @('-NoLogo','-NoProfile','-File',$QuotedScript)
        $Elevated = Start-Process -FilePath $PowerShellExe -Verb RunAs -ArgumentList $RelaunchArgs -PassThru
        if ($Elevated) { exit 0 }
        throw 'No se pudo iniciar el proceso elevado.'
    } catch {
        Write-Error ('No se obtuvo elevación: ' + $_.Exception.Message)
        exit 1
    }
}

$LogFile = Join-Path $env:TEMP ('AppHub404-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
$Results = [System.Collections.Generic.List[object]]::new()

function Write-Log {
    param([string]$Message)
    $Line = ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $Message)
    $Line | Tee-Object -FilePath $LogFile -Append
}

Write-Host '=== AppHub 404 · Instalación WinGet ===' -ForegroundColor Cyan
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error 'WinGet no está disponible. Instala o repara App Installer desde Microsoft Store.'
    exit 1
}

${options.restore ? `try {
    Enable-ComputerRestore -Drive "$($env:SystemDrive)\\" -ErrorAction Stop
    Checkpoint-Computer -Description 'Antes de AppHub 404' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
    Write-Log 'Punto de restauración creado.'
} catch { Write-Log ('No se pudo crear el punto de restauración: ' + $_.Exception.Message) }
` : ''}${options.updateSources ? `Write-Log 'Actualizando fuentes WinGet...'
& winget source update --disable-interactivity | Tee-Object -FilePath $LogFile -Append
` : ''}
$Packages = @(
${packages}
)

foreach ($Package in $Packages) {
    Write-Host ''
    Write-Host ("→ {0}" -f $Package.Name) -ForegroundColor Yellow
    if ($Package.Requirement) { Write-Host ("  Requisito: {0}" -f $Package.Requirement) -ForegroundColor DarkYellow }
    Write-Log ("Validando {0} ({1}) en {2}" -f $Package.Name, $Package.Id, $Package.Source)
    & winget show --id $Package.Id -e --source $Package.Source --accept-source-agreements --disable-interactivity *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning ("Paquete no encontrado: {0} [{1}]" -f $Package.Id, $Package.Source)
        $Results.Add([pscustomobject]@{ App=$Package.Name; Id=$Package.Id; Origen=$Package.Source; Estado='No encontrado' })
        continue
    }

    $InstalledOutput = (& winget list --id $Package.Id -e --source $Package.Source --accept-source-agreements --disable-interactivity 2>&1 | Out-String)
    $Installed = ($LASTEXITCODE -eq 0) -and ($InstalledOutput -match [regex]::Escape($Package.Id))
    if ($Installed) {
${options.upgrade ? `        $UpgradeCheck = (& winget list --id $Package.Id -e --source $Package.Source --upgrade-available --accept-source-agreements --disable-interactivity 2>&1 | Out-String)
        $UpgradeAvailable = ($LASTEXITCODE -eq 0) -and ($UpgradeCheck -match [regex]::Escape($Package.Id))
        if (-not $UpgradeAvailable) {
            $Results.Add([pscustomobject]@{ App=$Package.Name; Id=$Package.Id; Origen=$Package.Source; Estado='Ya instalada; sin actualización' })
            continue
        }
        $UpgradeArgs = @('upgrade','--id',$Package.Id,'-e','--source',$Package.Source,'--accept-package-agreements','--accept-source-agreements','--disable-interactivity'${options.silent ? ",'--silent'" : ''})
        Write-Log ("Actualizando {0}" -f $Package.Name)
        & winget @UpgradeArgs 2>&1 | Tee-Object -FilePath $LogFile -Append
        $UpgradeExitCode = $LASTEXITCODE
        $Status = if ($UpgradeExitCode -eq 0) { 'Actualizada' } else { 'Error al actualizar (' + $UpgradeExitCode + ')' }
        $Results.Add([pscustomobject]@{ App=$Package.Name; Id=$Package.Id; Origen=$Package.Source; Estado=$Status })
` : `        $Results.Add([pscustomobject]@{ App=$Package.Name; Id=$Package.Id; Origen=$Package.Source; Estado='Ya instalada' })
`}        continue
    }

    $InstallArgs = @('install','--id',$Package.Id,'-e','--source',$Package.Source,'--accept-package-agreements','--accept-source-agreements','--disable-interactivity'${options.silent ? ",'--silent'" : ''})
    Write-Log ("Instalando {0}" -f $Package.Name)
    & winget @InstallArgs | Tee-Object -FilePath $LogFile -Append
    $Status = if ($LASTEXITCODE -eq 0) { 'Instalada' } else { 'Error ' + $LASTEXITCODE }
    $Results.Add([pscustomobject]@{ App=$Package.Name; Id=$Package.Id; Origen=$Package.Source; Estado=$Status })
}

Write-Host ''
Write-Host '=== Resumen ===' -ForegroundColor Cyan
$Results | Format-Table -AutoSize
Write-Host ("Registro: {0}" -f $LogFile) -ForegroundColor DarkGray
${options.pause ? "Read-Host 'Pulsa Enter para cerrar'" : ''}
`;
  }

  function generateBatch(ids, options) {
    const lines = ids.map(id => {
      const app = appsById.get(id);
      const name = batSafeLabel(app.name);
      const source = app.source || 'winget';
      const requirement = app.requirement ? `echo Requisito: ${batSafeLabel(app.requirement)}\n` : '';
      const silent = options.silent ? ' --silent' : '';
      const noUpgrade = options.upgrade ? '' : ' --no-upgrade';
      return `echo.\necho === ${name} ===\n${requirement}echo [INSTALANDO] ${id}\nwinget install --id "${id}" -e --source "${source}" --accept-package-agreements --accept-source-agreements --disable-interactivity${silent}${noUpgrade}\nset "APPHUB_RC=!ERRORLEVEL!"\nif "!APPHUB_RC!"=="0" (\n  echo [OK] ${id}\n) else (\n  echo [ERROR !APPHUB_RC!] ${id}\n  echo Reintentando diagnostico de paquete...\n  winget show --id "${id}" -e --source "${source}" --accept-source-agreements --disable-interactivity\n)\n`;
    }).join('\n');
    return `@echo off\nsetlocal EnableExtensions EnableDelayedExpansion\ntitle AppHub 404 - WinGet\nfltmc >nul 2>&1\nif %errorlevel%==0 goto :APPHUB_ELEVATED\n\necho Solicitando permisos de administrador mediante UAC...\nset "APPHUB_SELF=%~f0"\n"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $q=[char]34; $arg='/d /c call ' + $q + $env:APPHUB_SELF + $q; $p=Start-Process -FilePath $env:ComSpec -Verb RunAs -ArgumentList $arg -PassThru; if($p){exit 0}else{exit 1} } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"\nif errorlevel 1 (\n  echo ERROR: No se pudo obtener elevacion. Usa boton derecho ^> Ejecutar como administrador.\n  pause\n  exit /b 1\n)\nexit /b 0\n\n:APPHUB_ELEVATED\necho ========================================\necho AppHub 404 - Instalacion WinGet\necho ========================================\nwhere winget >nul 2>&1\nif errorlevel 1 (\n  echo ERROR: WinGet no esta disponible en esta sesion.\n  echo Ejecuta: winget --info\n  pause\n  exit /b 1\n)\nwinget --info\n${options.updateSources ? 'winget source update --disable-interactivity\n' : ''}\n${lines}\necho.\necho Proceso finalizado. Revisa los mensajes anteriores.\n${options.pause ? 'pause' : 'pause'}\nendlocal\n`;
  }

  function generateWingetJSON(ids) {
    const groups = new Map();
    ids.forEach(id => {
      const app = appsById.get(id);
      const source = app.source || 'winget';
      if (!groups.has(source)) groups.set(source, []);
      groups.get(source).push({ PackageIdentifier: id });
    });
    const details = {
      winget: {
        Argument: 'https://cdn.winget.microsoft.com/cache',
        Identifier: 'Microsoft.Winget.Source_8wekyb3d8bbwe',
        Name: 'winget',
        Type: 'Microsoft.PreIndexed.Package'
      },
      msstore: {
        Argument: 'https://storeedgefd.dsx.mp.microsoft.com/v9.0',
        Identifier: 'StoreEdgeFD',
        Name: 'msstore',
        Type: 'Microsoft.Rest'
      }
    };
    return JSON.stringify({
      $schema: 'https://aka.ms/winget-packages.schema.2.0.json',
      CreationDate: new Date().toISOString(),
      Sources: [...groups].map(([source, Packages]) => ({
        Packages,
        SourceDetails: details[source] || { ...details.winget, Name: source }
      }))
    }, null, 2);
  }

  function openUpdater() {
    updateUpdater();
    els.updaterDialog.showModal();
  }

  function getUpdaterOptions() {
    return {
      updateSources: $('#updaterUpdateSources').checked,
      silent: $('#updaterSilent').checked,
      unknown: $('#updaterUnknown').checked,
      pinned: $('#updaterPinned').checked,
      restore: $('#updaterRestore').checked,
      pause: $('#updaterPause').checked
    };
  }

  function getUpdaterFormat() {
    return $('input[name="updaterFormat"]:checked').value;
  }

  function updateUpdater() {
    const format = getUpdaterFormat();
    els.updaterPreview.textContent = generateUpdaterContent(format, getUpdaterOptions());
    els.downloadUpdater.textContent = format === 'ps1'
      ? 'Descargar actualizador PowerShell'
      : 'Descargar actualizador BAT';
    els.updaterHint.textContent = $('#updaterPinned').checked
      ? 'Incluye pins no bloqueantes. Los pins blocking siguen protegidos.'
      : 'Respeta los paquetes fijados, no utiliza --force y no activa reinicios.';
  }

  function generateUpdaterContent(format, options) {
    return format === 'bat' ? generateUpdaterBatch(options) : generateUpdaterPowerShell(options);
  }

  function generateUpdaterPowerShell(options) {
    const upgradeArgs = ["'upgrade'", "'--all'", "'--accept-package-agreements'", "'--accept-source-agreements'", "'--disable-interactivity'"];
    if (options.silent) upgradeArgs.push("'--silent'");
    if (options.unknown) upgradeArgs.push("'--include-unknown'");
    if (options.pinned) upgradeArgs.push("'--include-pinned'");
    return `# AppHub 404 v${VERSION} · Actualizador de aplicaciones
# Generado localmente. No usa --force, --allow-reboot ni --uninstall-previous.

$ErrorActionPreference = 'Continue'
$CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = [Security.Principal.WindowsPrincipal]::new($CurrentIdentity)
if (-not $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    if (-not $PSCommandPath) { Write-Error 'Guarda el script como .ps1 antes de ejecutarlo para poder solicitar elevación UAC.'; exit 1 }
    Write-Host 'Solicitando permisos de administrador mediante UAC...' -ForegroundColor Yellow
    try {
        $PowerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        $QuotedScript = '"{0}"' -f $PSCommandPath.Replace('"','""')
        $RelaunchArgs = @('-NoLogo','-NoProfile','-File',$QuotedScript)
        $Elevated = Start-Process -FilePath $PowerShellExe -Verb RunAs -ArgumentList $RelaunchArgs -PassThru
        if ($Elevated) { exit 0 }
        throw 'No se pudo iniciar el proceso elevado.'
    } catch {
        Write-Error ('No se obtuvo elevación: ' + $_.Exception.Message)
        exit 1
    }
}

$LogFile = Join-Path $env:TEMP ('AppHub404-Update-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')

function Write-Log {
    param([string]$Message)
    $Line = ('[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $Message)
    $Line | Tee-Object -FilePath $LogFile -Append
}

Write-Host '=== AppHub 404 · Actualizaciones WinGet ===' -ForegroundColor Cyan
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Error 'WinGet no está disponible. Instala o repara App Installer desde Microsoft Store.'
    exit 1
}

${options.restore ? `try {
    Enable-ComputerRestore -Drive "$($env:SystemDrive)\\" -ErrorAction Stop
    Checkpoint-Computer -Description 'Antes de actualizar con AppHub 404' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop
    Write-Log 'Punto de restauración creado.'
} catch { Write-Log ('No se pudo crear el punto de restauración: ' + $_.Exception.Message) }

` : ''}${options.updateSources ? `Write-Log 'Actualizando fuentes WinGet...'
& winget source update --disable-interactivity 2>&1 | Tee-Object -FilePath $LogFile -Append

` : ''}Write-Host ''
Write-Host '=== Actualizaciones disponibles antes del proceso ===' -ForegroundColor Yellow
& winget list --upgrade-available --accept-source-agreements --disable-interactivity 2>&1 | Tee-Object -FilePath $LogFile -Append

Write-Host ''
Write-Host '=== Paquetes fijados ===' -ForegroundColor Yellow
& winget pin list --accept-source-agreements --disable-interactivity 2>&1 | Tee-Object -FilePath $LogFile -Append

$UpgradeArgs = @(${upgradeArgs.join(', ')})
Write-Log 'Iniciando actualización de aplicaciones compatibles...'
& winget @UpgradeArgs 2>&1 | Tee-Object -FilePath $LogFile -Append
$UpgradeExitCode = $LASTEXITCODE

Write-Host ''
Write-Host '=== Comprobación posterior ===' -ForegroundColor Yellow
& winget list --upgrade-available --accept-source-agreements --disable-interactivity 2>&1 | Tee-Object -FilePath $LogFile -Append

if ($UpgradeExitCode -eq 0) {
    Write-Host ''
    Write-Host 'Proceso completado correctamente.' -ForegroundColor Green
} else {
    Write-Warning ("WinGet terminó con el código {0}. Revisa el registro; puede haber paquetes sin actualización aplicable o instaladores que requieran interacción." -f $UpgradeExitCode)
}
Write-Host ("Registro: {0}" -f $LogFile) -ForegroundColor DarkGray
${options.pause ? "Read-Host 'Pulsa Enter para cerrar'" : ''}
`;
  }

  function generateUpdaterBatch(options) {
    const flags = [
      '--all', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity',
      options.silent ? '--silent' : '',
      options.unknown ? '--include-unknown' : '',
      options.pinned ? '--include-pinned' : ''
    ].filter(Boolean).join(' ');
    return `@echo off
setlocal EnableExtensions
title AppHub 404 - Actualizaciones WinGet
fltmc >nul 2>&1
if %errorlevel%==0 goto :APPHUB_ELEVATED

echo Solicitando permisos de administrador mediante UAC...
set "APPHUB_SELF=%~f0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "try { $q=[char]34; $arg='/d /c call ' + $q + $env:APPHUB_SELF + $q; $p=Start-Process -FilePath $env:ComSpec -Verb RunAs -ArgumentList $arg -PassThru; if($p){exit 0}else{exit 1} } catch { Write-Host $_.Exception.Message -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
  echo ERROR: No se pudo obtener elevacion. Comprueba UAC o ejecuta este BAT con ^"Ejecutar como administrador^".
  pause
  exit /b 1
)
exit /b 0

:APPHUB_ELEVATED
set "LOG=%TEMP%\\AppHub404-Update-%RANDOM%-%RANDOM%.log"
echo ========================================
echo AppHub 404 - Actualizaciones WinGet
echo ========================================
where winget >nul 2>&1
if errorlevel 1 (
  echo ERROR: WinGet no esta disponible.
  echo Instala o repara App Installer desde Microsoft Store.
  pause
  exit /b 1
)

${options.restore ? `echo Intentando crear un punto de restauracion...
powershell.exe -NoProfile -Command "try { Enable-ComputerRestore -Drive ($env:SystemDrive + '\\'); Checkpoint-Computer -Description 'Antes de actualizar con AppHub 404' -RestorePointType MODIFY_SETTINGS } catch { Write-Output $_.Exception.Message }" >> "%LOG%" 2>&1

` : ''}${options.updateSources ? `echo Actualizando fuentes WinGet...
winget source update --disable-interactivity >> "%LOG%" 2>&1

` : ''}echo.
echo === Actualizaciones disponibles antes del proceso ===
winget list --upgrade-available --accept-source-agreements --disable-interactivity
winget list --upgrade-available --accept-source-agreements --disable-interactivity >> "%LOG%" 2>&1

echo.
echo === Paquetes fijados ===
winget pin list --accept-source-agreements --disable-interactivity
winget pin list --accept-source-agreements --disable-interactivity >> "%LOG%" 2>&1

echo.
echo === Actualizando aplicaciones compatibles ===
set "UPDATE_OUT=%TEMP%\\AppHub404-Update-Out-%RANDOM%-%RANDOM%.tmp"
winget upgrade ${flags} > "%UPDATE_OUT%" 2>&1
set "UPDATE_EXIT=%ERRORLEVEL%"
type "%UPDATE_OUT%"
type "%UPDATE_OUT%" >> "%LOG%"
del "%UPDATE_OUT%" >nul 2>&1

echo.
echo === Comprobacion posterior ===
winget list --upgrade-available --accept-source-agreements --disable-interactivity
winget list --upgrade-available --accept-source-agreements --disable-interactivity >> "%LOG%" 2>&1

echo.
echo Codigo de salida WinGet: %UPDATE_EXIT%
echo Registro: %LOG%
${options.pause ? 'pause' : ''}
endlocal
`;
  }

  async function copyScanCommand() {
    await copyText('winget list --upgrade-available --accept-source-agreements');
    toast('Comando de análisis copiado');
  }

  async function copyUpdaterPreview() {
    await copyText(els.updaterPreview.textContent);
    toast('Actualizador copiado');
  }

  function downloadUpdaterScript() {
    const format = getUpdaterFormat();
    const content = generateUpdaterContent(format, getUpdaterOptions());
    const payload = format === 'ps1' ? `\uFEFF${content}` : content;
    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `apphub-404-update-all.${format}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Actualizador .${format} descargado`);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.className = 'clipboard-helper';
      document.body.append(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  }

  async function copyPreview() {
    try {
      await navigator.clipboard.writeText(els.scriptPreview.textContent);
      toast('Contenido copiado');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(els.scriptPreview);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      toast('Seleccionado: pulsa Ctrl+C');
    }
  }

  function downloadCurrentScript() {
    const format = getFormat();
    const extension = format;
    const mime = format === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
    const content = generateContent(format);
    const payload = format === 'ps1' ? `\uFEFF${content}` : content;
    const blob = new Blob([payload], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `apphub-404-setup.${extension}`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Archivo .${extension} descargado`);
  }

  function clearFilters() {
    state.query = '';
    state.category = 'all';
    state.favoritesOnly = false;
    els.searchInput.value = '';
    els.categoryFilter.value = 'all';
    els.favoritesFilter.setAttribute('aria-pressed', 'false');
    els.favoritesFilter.textContent = '☆ Favoritos';
    renderApps();
  }

  function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function restoreTheme() {
    let saved = null;
    try { saved = localStorage.getItem('apphub-theme'); } catch {}
    const preferred = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    setTheme(saved || preferred);
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('apphub-theme', theme); } catch { toast('No se pudo guardar el tema en este navegador', true); }
    els.themeToggle.textContent = theme === 'dark' ? '☼' : '☾';
    els.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro');
    const meta = $('meta[name="theme-color"]');
    meta.setAttribute('content', theme === 'dark' ? '#0b1020' : '#f4f7fb');
  }

  function toast(message, error = false) {
    const item = document.createElement('div');
    item.className = error ? 'toast toast-error' : 'toast';
    item.textContent = message;
    els.toastRegion.append(item);
    setTimeout(() => item.remove(), 2800);
  }

  function updateConnectionStatus() {
    if (!els.connectionStatus) return;
    const online = navigator.onLine;
    els.connectionStatus.dataset.state = online ? 'online' : 'offline';
    els.connectionStatus.textContent = online ? 'En línea' : 'Sin conexión';
    els.connectionStatus.title = online ? 'La PWA puede actualizar su caché local.' : 'El catálogo y las herramientas precargadas siguen disponibles.';
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
    }
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { toast('No se pudo guardar la configuración local', true); return false; }
  }
  function normalize(value) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function psEscape(value) { return String(value).replace(/'/g, "''"); }
  function batSafeLabel(value) { return String(value).replace(/[\r\n&|<>^()%!]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function escapeHTML(value) { return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
})();
