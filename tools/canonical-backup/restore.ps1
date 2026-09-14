[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetPath,
    [switch]$AllowExisting
)

$ErrorActionPreference = 'Stop'
$backupRoot = $PSScriptRoot
$snapshotRoot = Join-Path $backupRoot 'workspace'
$manifestPath = Join-Path $backupRoot 'manifest-sha256.csv'
$resolvedTarget = [System.IO.Path]::GetFullPath($TargetPath)
$backupPrefix = [System.IO.Path]::GetFullPath($backupRoot).TrimEnd('\') + '\'

if ($resolvedTarget.StartsWith($backupPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'El destino de restauración no puede estar dentro del respaldo.'
}
if (-not (Test-Path -LiteralPath $snapshotRoot) -or -not (Test-Path -LiteralPath $manifestPath)) {
    throw 'El respaldo no contiene workspace o manifest-sha256.csv.'
}
if (Test-Path -LiteralPath $resolvedTarget) {
    $existingItems = Get-ChildItem -LiteralPath $resolvedTarget -Force -ErrorAction SilentlyContinue
    if ($existingItems -and -not $AllowExisting) {
        throw 'El destino no está vacío. Usa una carpeta nueva o agrega -AllowExisting conscientemente.'
    }
} else {
    New-Item -ItemType Directory -Path $resolvedTarget -Force | Out-Null
}

$manifest = Import-Csv -LiteralPath $manifestPath
foreach ($entry in $manifest) {
    $source = Join-Path $snapshotRoot $entry.Path
    if (-not (Test-Path -LiteralPath $source)) { throw "Falta en el respaldo: $($entry.Path)" }
    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    if ($sourceHash -ne $entry.SHA256) { throw "Hash inválido en respaldo: $($entry.Path)" }

    $destination = Join-Path $resolvedTarget $entry.Path
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

$invalidRestoredFiles = foreach ($entry in $manifest) {
    $destination = Join-Path $resolvedTarget $entry.Path
    if (-not (Test-Path -LiteralPath $destination)) { $entry.Path; continue }
    $restoredHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    if ($restoredHash -ne $entry.SHA256) { $entry.Path }
}
if ($invalidRestoredFiles) {
    throw "La restauración falló para: $($invalidRestoredFiles -join ', ')"
}

Write-Output "RESTORED_TO=$resolvedTarget"
Write-Output "FILES=$($manifest.Count)"
Write-Output 'SHA256_VERIFIED=true'
