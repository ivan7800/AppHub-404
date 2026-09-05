# AppHub 404 v2.7.2 - Analizador local de inventario y salud
# No instala, actualiza ni desinstala aplicaciones. Solo recopila información local y crea un JSON.
[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path ([Environment]::GetFolderPath('Desktop')) ('AppHub404-Inventory-' + $env:COMPUTERNAME + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')),
    [switch]$IncludeDiagnosticText,
    [switch]$NoPause
)

$CurrentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$CurrentPrincipal = [Security.Principal.WindowsPrincipal]::new($CurrentIdentity)
if (-not $CurrentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    if (-not $PSCommandPath) { Write-Error 'Guarda el analizador como .ps1 antes de ejecutarlo.'; exit 1 }
    Write-Host 'Solicitando permisos de administrador mediante UAC para completar el diagnóstico...' -ForegroundColor Yellow
    try {
        $PowerShellExe = (Get-Process -Id $PID -ErrorAction Stop).Path
        if (-not $PowerShellExe) { throw 'No se pudo identificar el ejecutable de PowerShell actual.' }
        $Arguments = '-NoProfile -File "' + $PSCommandPath + '" -OutputPath "' + $OutputPath + '"'
        if ($IncludeDiagnosticText) { $Arguments += ' -IncludeDiagnosticText' }
        if ($NoPause) { $Arguments += ' -NoPause' }
        $Psi = New-Object System.Diagnostics.ProcessStartInfo
        $Psi.FileName = $PowerShellExe
        $Psi.UseShellExecute = $true
        $Psi.Verb = 'runas'
        $Psi.WorkingDirectory = Split-Path -Parent $PSCommandPath
        $Psi.Arguments = $Arguments
        $Elevated = [System.Diagnostics.Process]::Start($Psi)
        if ($null -ne $Elevated) { exit 0 }
        throw 'No se pudo iniciar el proceso elevado.'
    } catch {
        Write-Error ('No se obtuvo elevación UAC: ' + $_.Exception.Message)
        exit 1
    }
}

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$Health = [System.Collections.Generic.List[object]]::new()

function Add-Health {
    param([string]$Id, [string]$Label, [ValidateSet('ok','info','warning','error')][string]$Status, [string]$Detail)
    $Health.Add([ordered]@{ id=$Id; label=$Label; status=$Status; detail=$Detail })
}

function Invoke-WingetText {
    param([string[]]$Arguments)
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return '' }
    try { return ((& winget @Arguments 2>&1) | Out-String).Trim() } catch { return $_.Exception.Message }
}

function Convert-WingetUpdateTable {
    param([string]$Text)
    $Rows = [System.Collections.Generic.List[object]]::new()
    if ([string]::IsNullOrWhiteSpace($Text)) { return @() }
    $Lines = $Text -split "`r?`n"
    $SeparatorIndex = -1
    for ($i=0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\s*-{5,}') { $SeparatorIndex = $i; break }
    }
    if ($SeparatorIndex -lt 0) { return @() }
    foreach ($Line in $Lines[($SeparatorIndex + 1)..($Lines.Count - 1)]) {
        if ([string]::IsNullOrWhiteSpace($Line)) { continue }
        if ($Line -match '^\s*\d+\s+') { continue }
        $Parts = [regex]::Split($Line.Trim(), '\s{2,}')
        if ($Parts.Count -lt 4) { continue }
        if ($Parts.Count -ge 5) {
            $Source = $Parts[-1]
            $Available = $Parts[-2]
            $Installed = $Parts[-3]
            $Id = $Parts[-4]
            $NamePartsEnd = $Parts.Count - 5
            $Name = if ($NamePartsEnd -ge 0) { ($Parts[0..$NamePartsEnd] -join '  ') } else { $Parts[0] }
        } else {
            $Source = ''
            $Name = $Parts[0]
            $Id = $Parts[1]
            $Installed = $Parts[2]
            $Available = $Parts[3]
        }
        if ($Id -and $Id -notmatch '^-+$') {
            $Rows.Add([ordered]@{ name=$Name; id=$Id; installed=$Installed; available=$Available; source=$Source })
        }
    }
    return @($Rows)
}

Write-Host '=== AppHub 404 - Analizador local ===' -ForegroundColor Cyan
Write-Host 'No se enviará información a Internet. El JSON no incluye la lista del Registro de Windows.' -ForegroundColor DarkGray

$ComputerSystem = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
$OperatingSystem = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$Processor = Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
$SystemDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$($env:SystemDrive)'" -ErrorAction SilentlyContinue

$WingetCommand = Get-Command winget -ErrorAction SilentlyContinue
$WingetAvailable = [bool]$WingetCommand
$WingetVersion = if ($WingetAvailable) { (Invoke-WingetText @('--version')) } else { '' }
$WingetInfo = if ($WingetAvailable) { (Invoke-WingetText @('--info')) } else { '' }
$SourcesRaw = if ($WingetAvailable) { (Invoke-WingetText @('source','list','--accept-source-agreements','--disable-interactivity')) } else { '' }
$PinsRaw = if ($WingetAvailable) { (Invoke-WingetText @('pin','list','--accept-source-agreements','--disable-interactivity')) } else { '' }

if ($WingetAvailable) { Add-Health 'winget' 'Windows Package Manager' 'ok' ("Disponible: " + $WingetVersion) }
else { Add-Health 'winget' 'Windows Package Manager' 'error' 'WinGet no está disponible.' }

$AppInstaller = Get-AppxPackage Microsoft.DesktopAppInstaller -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
if ($AppInstaller) { Add-Health 'app-installer' 'App Installer' 'ok' ("Versión " + $AppInstaller.Version) }
else { Add-Health 'app-installer' 'App Installer' 'warning' 'No se encontró el paquete Microsoft.DesktopAppInstaller.' }

$Pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
if ($Pwsh) { Add-Health 'powershell7' 'PowerShell 7' 'ok' ((& pwsh -NoLogo -NoProfile -Command '$PSVersionTable.PSVersion.ToString()' 2>$null) | Select-Object -First 1) }
else { Add-Health 'powershell7' 'PowerShell 7' 'info' 'No instalado; Windows PowerShell sigue disponible.' }

$PendingReboot = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or
                 (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') -or
                 ((Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -Name PendingFileRenameOperations -ErrorAction SilentlyContinue).PendingFileRenameOperations)
if ($PendingReboot) { Add-Health 'reboot' 'Reinicio pendiente' 'warning' 'Windows indica que hay cambios pendientes de reinicio.' }
else { Add-Health 'reboot' 'Reinicio pendiente' 'ok' 'No se detectó un reinicio pendiente.' }

try {
    $Defender = Get-MpComputerStatus -ErrorAction Stop
    if ($Defender.AntivirusEnabled -and $Defender.RealTimeProtectionEnabled) { Add-Health 'defender' 'Microsoft Defender' 'ok' 'Antivirus y protección en tiempo real activos.' }
    else { Add-Health 'defender' 'Microsoft Defender' 'warning' 'La protección no está completamente activa o existe otro antivirus.' }
} catch { Add-Health 'defender' 'Microsoft Defender' 'info' 'Estado no disponible con los permisos actuales.' }

$DotNetRuntimes = if (Get-Command dotnet -ErrorAction SilentlyContinue) { ((& dotnet --list-runtimes 2>$null) | Out-String).Trim() } else { '' }
if ($DotNetRuntimes) { Add-Health 'dotnet' '.NET Runtime' 'ok' (($DotNetRuntimes -split "`r?`n" | Select-Object -First 1) + $(if (($DotNetRuntimes -split "`r?`n").Count -gt 1) { ' y otros' } else { '' })) }
else { Add-Health 'dotnet' '.NET Runtime' 'info' 'No se detectó el comando dotnet.' }

$WebView2 = Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F1E7E7B6-5A2C-4A50-9C18-9D13D2A1C2C2}' -ErrorAction SilentlyContinue
if (-not $WebView2) { $WebView2 = Get-ChildItem 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients' -ErrorAction SilentlyContinue | Get-ItemProperty -ErrorAction SilentlyContinue | Where-Object { $_.name -match 'WebView2' } | Select-Object -First 1 }
if ($WebView2) { $WebViewVersion = if ($WebView2.pv) { [string]$WebView2.pv } else { 'Instalado' }; Add-Health 'webview2' 'Microsoft Edge WebView2' 'ok' $WebViewVersion }
else { Add-Health 'webview2' 'Microsoft Edge WebView2' 'info' 'No se detectó mediante el registro.' }

if ($SystemDrive -and $SystemDrive.FreeSpace) {
    $FreeGB = [math]::Round($SystemDrive.FreeSpace / 1GB, 1)
    if ($FreeGB -lt 15) { Add-Health 'disk-space' 'Espacio libre del sistema' 'warning' ("Solo quedan $FreeGB GB libres en $($env:SystemDrive).") }
    else { Add-Health 'disk-space' 'Espacio libre del sistema' 'ok' ("$FreeGB GB libres en $($env:SystemDrive).") }
}

$Features = @{}
foreach ($FeatureName in @('Microsoft-Windows-Subsystem-Linux','VirtualMachinePlatform','Microsoft-Hyper-V-All')) {
    try { $Features[$FeatureName] = (Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction Stop).State.ToString() } catch { $Features[$FeatureName] = 'Unavailable' }
}
Add-Health 'wsl' 'WSL' 'info' ("Estado: " + $Features['Microsoft-Windows-Subsystem-Linux'])
Add-Health 'hyper-v' 'Hyper-V' 'info' ("Estado: " + $Features['Microsoft-Hyper-V-All'])

$WingetPackages = [System.Collections.Generic.List[object]]::new()
if ($WingetAvailable) {
    $TempExport = Join-Path $env:TEMP ('AppHub404-Export-' + [guid]::NewGuid().ToString('N') + '.json')
    try {
        & winget export --output $TempExport --include-versions --accept-source-agreements --disable-interactivity | Out-Null
        if (Test-Path $TempExport) {
            $ExportData = Get-Content $TempExport -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($Source in @($ExportData.Sources)) {
                $SourceName = [string]$Source.SourceDetails.Name
                foreach ($Package in @($Source.Packages)) {
                    $WingetPackages.Add([ordered]@{
                        id = [string]$Package.PackageIdentifier
                        version = [string]$Package.Version
                        source = $(if ($SourceName) { $SourceName } else { 'winget' })
                    })
                }
            }
        }
    } catch { }
    finally { Remove-Item $TempExport -Force -ErrorAction SilentlyContinue }
}

$UpdatesRaw = if ($WingetAvailable) { (Invoke-WingetText @('list','--upgrade-available','--include-pinned','--accept-source-agreements','--disable-interactivity')) } else { '' }
$Updates = @(Convert-WingetUpdateTable $UpdatesRaw)

$SoftwareRoots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$RegistrySoftware = foreach ($Root in $SoftwareRoots) {
    Get-ItemProperty $Root -ErrorAction SilentlyContinue | Where-Object DisplayName | ForEach-Object {
        [ordered]@{ name=[string]$_.DisplayName; version=[string]$_.DisplayVersion; publisher=[string]$_.Publisher }
    }
}
$RegistrySoftware = @($RegistrySoftware | Sort-Object name,version,publisher -Unique)

$Inventory = [ordered]@{
    schema = 'apphub-404-inventory-v2'
    appVersion = '2.7.2'
    scannedAt = (Get-Date).ToUniversalTime().ToString('o')
    computer = [ordered]@{
        name = $env:COMPUTERNAME
        manufacturer = [string]$ComputerSystem.Manufacturer
        model = [string]$ComputerSystem.Model
    }
    system = [ordered]@{
        caption = [string]$OperatingSystem.Caption
        edition = [string]$OperatingSystem.OperatingSystemSKU
        version = [string]$OperatingSystem.Version
        build = [string]$OperatingSystem.BuildNumber
        architecture = [string]$OperatingSystem.OSArchitecture
        processor = [string]$Processor.Name
        memoryGB = [math]::Round($ComputerSystem.TotalPhysicalMemory / 1GB, 1)
        systemDriveFreeGB = $(if ($SystemDrive) { [math]::Round($SystemDrive.FreeSpace / 1GB, 1) } else { $null })
        optionalFeatures = $Features
    }
    winget = [ordered]@{
        available = $WingetAvailable
        version = $WingetVersion
        packages = @($WingetPackages | Sort-Object id -Unique)
        updates = $Updates
        infoRaw = $(if ($IncludeDiagnosticText) { $WingetInfo } else { '' })
        sourcesRaw = $(if ($IncludeDiagnosticText) { $SourcesRaw } else { '' })
        pinsRaw = $(if ($IncludeDiagnosticText) { $PinsRaw } else { '' })
        updatesRaw = $(if ($IncludeDiagnosticText) { $UpdatesRaw } else { '' })
    }
    software = [ordered]@{
        registryCount = $RegistrySoftware.Count
    }
    health = @($Health)
}

try {
    if ([IO.Path]::GetExtension($OutputPath) -ne '.json') { $OutputPath = [IO.Path]::ChangeExtension($OutputPath, '.json') }
    $OutputPath = [IO.Path]::GetFullPath($OutputPath)
    $OutputDirectory = Split-Path -Parent $OutputPath
    if ($OutputDirectory -and -not (Test-Path -LiteralPath $OutputDirectory)) {
        New-Item -ItemType Directory -Path $OutputDirectory -Force -ErrorAction Stop | Out-Null
    }
    $Inventory | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutputPath -Encoding UTF8 -ErrorAction Stop
} catch {
    Write-Error ('No se pudo guardar el inventario: ' + $_.Exception.Message)
    if (-not $NoPause) { Read-Host 'Pulsa Enter para cerrar' }
    exit 1
}

Write-Host ''
Write-Host 'Inventario creado correctamente:' -ForegroundColor Green
Write-Host $OutputPath -ForegroundColor White
Write-Host ("Paquetes reconocidos por WinGet: {0}" -f $WingetPackages.Count)
Write-Host ("Aplicaciones del registro (solo recuento): {0}" -f $RegistrySoftware.Count)
Write-Host ("Actualizaciones detectadas: {0}" -f $Updates.Count)
if ($IncludeDiagnosticText) { Write-Host 'Se incluyó texto técnico de WinGet por petición expresa.' -ForegroundColor Yellow }
Write-Host ''
if (-not $NoPause) { Read-Host 'Pulsa Enter para cerrar' }
