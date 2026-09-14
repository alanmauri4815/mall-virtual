[CmdletBinding()]
param(
    [string]$Label = 'MANUAL',
    [switch]$SkipArchive
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$backupsRoot = Join-Path $projectRoot 'backups'
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$safeLabel = ($Label -replace '[^A-Za-z0-9_-]', '_').ToUpperInvariant()
$backupRoot = Join-Path $backupsRoot "CANONICAL_${safeLabel}_${timestamp}"
$workspaceSnapshot = Join-Path $backupRoot 'workspace'

function Get-SafeRelativePath {
    param(
        [Parameter(Mandatory = $true)][string]$BasePath,
        [Parameter(Mandatory = $true)][string]$FullPath
    )
    $basePrefix = [System.IO.Path]::GetFullPath($BasePath).TrimEnd('\') + '\'
    $resolvedPath = [System.IO.Path]::GetFullPath($FullPath)
    if (-not $resolvedPath.StartsWith($basePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "La ruta queda fuera de la base permitida: $resolvedPath"
    }
    return $resolvedPath.Substring($basePrefix.Length)
}

$projectPrefix = $projectRoot.TrimEnd('\') + '\'
$resolvedBackupRoot = [System.IO.Path]::GetFullPath($backupRoot)
if (-not $resolvedBackupRoot.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "La ruta de respaldo queda fuera del proyecto: $resolvedBackupRoot"
}

New-Item -ItemType Directory -Path $workspaceSnapshot -Force | Out-Null

$excludedTopDirectories = @('.git', '.vercel', '.vscode', 'backups', 'edge-test', 'node_modules')
$excludedFilePatterns = @('.env', '.env.*', '*.log', '.server.*', '.codex-*.png', 'edge_test.png')

$sourceFiles = Get-ChildItem -LiteralPath $projectRoot -Recurse -File -Force | Where-Object {
    $relative = Get-SafeRelativePath -BasePath $projectRoot -FullPath $_.FullName
    $topDirectory = ($relative -split '[\\/]')[0]
    if ($excludedTopDirectories -contains $topDirectory) { return $false }
    if (($relative -split '[\\/]') -contains 'node_modules') { return $false }
    foreach ($pattern in $excludedFilePatterns) {
        if ($_.Name -like $pattern) { return $false }
    }
    return $true
}

foreach ($file in $sourceFiles) {
    $relative = Get-SafeRelativePath -BasePath $projectRoot -FullPath $file.FullName
    $destination = Join-Path $workspaceSnapshot $relative
    $destinationDirectory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}

& git -C $projectRoot status --short | Set-Content -LiteralPath (Join-Path $backupRoot 'git-status.txt') -Encoding utf8
& git -C $projectRoot branch --show-current | Set-Content -LiteralPath (Join-Path $backupRoot 'git-branch.txt') -Encoding utf8
& git -C $projectRoot rev-parse HEAD | Set-Content -LiteralPath (Join-Path $backupRoot 'git-head.txt') -Encoding ascii
& git -C $projectRoot diff --binary | Set-Content -LiteralPath (Join-Path $backupRoot 'current-changes.patch') -Encoding utf8
& git -C $projectRoot diff --cached --binary | Set-Content -LiteralPath (Join-Path $backupRoot 'staged-changes.patch') -Encoding utf8
& git -C $projectRoot ls-files | Set-Content -LiteralPath (Join-Path $backupRoot 'tracked-files.txt') -Encoding utf8
& git -C $projectRoot ls-files --others --exclude-standard | Set-Content -LiteralPath (Join-Path $backupRoot 'untracked-files.txt') -Encoding utf8

$projectInfoPath = Join-Path $projectRoot '.vercel\project.json'
$deploymentInfo = [ordered]@{
    captured_at = (Get-Date).ToString('o')
    public_domains = @(
        'https://mall-virtual-one-mu.vercel.app/',
        'https://mall-virtual-one-ten.vercel.app/'
    )
    vercel_project = if (Test-Path $projectInfoPath) { Get-Content -LiteralPath $projectInfoPath -Raw | ConvertFrom-Json } else { $null }
}
$deploymentInfo | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $backupRoot 'deployment-info.json') -Encoding utf8

$manifest = Get-ChildItem -LiteralPath $workspaceSnapshot -Recurse -File | ForEach-Object {
    [pscustomobject]@{
        Path = Get-SafeRelativePath -BasePath $workspaceSnapshot -FullPath $_.FullName
        Length = $_.Length
        SHA256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
} | Sort-Object Path
$manifestPath = Join-Path $backupRoot 'manifest-sha256.csv'
$manifest | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding utf8

$failedHashes = foreach ($entry in (Import-Csv -LiteralPath $manifestPath)) {
    $snapshotFile = Join-Path $workspaceSnapshot $entry.Path
    if (-not (Test-Path -LiteralPath $snapshotFile)) { $entry.Path; continue }
    $actualHash = (Get-FileHash -LiteralPath $snapshotFile -Algorithm SHA256).Hash
    if ($actualHash -ne $entry.SHA256) { $entry.Path }
}
if ($failedHashes) {
    throw "Falló la verificación SHA-256 de: $($failedHashes -join ', ')"
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'canonical-backup\RESTORE.md') -Destination (Join-Path $backupRoot 'RESTORE.md')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'canonical-backup\restore.ps1') -Destination (Join-Path $backupRoot 'restore.ps1')

$summary = [ordered]@{
    created_at = (Get-Date).ToString('o')
    label = $safeLabel
    source = $projectRoot
    backup = $backupRoot
    files = $manifest.Count
    bytes = ($manifest | Measure-Object Length -Sum).Sum
    sha256_verified = $true
    excluded_top_directories = $excludedTopDirectories
    excluded_file_patterns = $excludedFilePatterns
}
$summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupRoot 'backup-summary.json') -Encoding utf8

$archivePath = $null
if (-not $SkipArchive) {
    $archivePath = "$backupRoot.zip"
    Compress-Archive -LiteralPath $backupRoot -DestinationPath $archivePath -CompressionLevel Optimal
}

Write-Output "BACKUP_ROOT=$backupRoot"
if ($archivePath) { Write-Output "ARCHIVE=$archivePath" }
Write-Output "FILES=$($manifest.Count)"
Write-Output "BYTES=$(($manifest | Measure-Object Length -Sum).Sum)"
Write-Output 'SHA256_VERIFIED=true'
