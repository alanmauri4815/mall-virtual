param(
    [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestDirectory = Join-Path $root 'docs\audits\data'
$manifestPath = Join-Path $manifestDirectory 'OBSOLETE_ARTIFACTS_REMOVED_20260809.csv'

function Assert-SafeWorkspacePath {
    param([string]$Path)

    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $rootPrefix = $root.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing path outside workspace: $fullPath"
    }
    if ($fullPath -eq $root) {
        throw 'Refusing to operate on workspace root.'
    }
    return $fullPath
}

function Get-WorkspaceRelativePath {
    param([string]$Path)

    $baseUri = [System.Uri]($root.TrimEnd('\') + '\')
    $pathUri = [System.Uri]([System.IO.Path]::GetFullPath($Path))
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($pathUri).ToString()).Replace('/', '\')
}

$targets = [System.Collections.Generic.List[System.IO.FileSystemInfo]]::new()

Get-ChildItem -LiteralPath $root -File | Where-Object {
    ($_.Extension -eq '.html' -and $_.Name -ne 'index.html') -or
    $_.Extension -eq '.js' -or
    $_.Name -eq 'patch.py' -or
    $_.Name -eq 'edge_test.png' -or
    $_.Name -like '.codex-*.png' -or
    $_.Name -like 'preview_*.png' -or
    $_.Name -like '*.log'
} | ForEach-Object { $targets.Add($_) }

Get-ChildItem -LiteralPath (Join-Path $root 'js\mall') -File |
    Where-Object { $_.Name -like '*.backup-*.js' } |
    ForEach-Object { $targets.Add($_) }

Get-ChildItem -LiteralPath $root -Directory | Where-Object {
    $_.Name -eq 'edge-test' -or
    $_.Name -like 'pc-optimization-backup-*' -or
    $_.Name -like 'supabase_backup_*'
} | ForEach-Object { $targets.Add($_) }

$backupsDirectory = Join-Path $root 'backups'
if (Test-Path -LiteralPath $backupsDirectory) {
    Get-ChildItem -LiteralPath $backupsDirectory -Force | Where-Object {
        $_.Name -notlike 'CANONICAL_*'
    } | ForEach-Object { $targets.Add($_) }
}

$targets = $targets |
    Sort-Object FullName -Unique |
    ForEach-Object {
        $null = Assert-SafeWorkspacePath -Path $_.FullName
        $_
    }

if ($targets.Count -eq 0) {
    Write-Output 'Targets: 0'
    Write-Output 'Files: 0'
    Write-Output 'Bytes: 0'
    Write-Output 'No obsolete artifacts found. Existing manifest preserved.'
    exit 0
}

$manifestRows = foreach ($target in $targets) {
    $files = if ($target.PSIsContainer) {
        Get-ChildItem -LiteralPath $target.FullName -Recurse -Force -File
    } else {
        @($target)
    }

    if (-not $files.Count) {
        [pscustomobject]@{
            Target = Get-WorkspaceRelativePath -Path $target.FullName
            File = ''
            SizeBytes = 0
            Sha256 = ''
        }
        continue
    }

    foreach ($file in $files) {
        [pscustomobject]@{
            Target = Get-WorkspaceRelativePath -Path $target.FullName
            File = Get-WorkspaceRelativePath -Path $file.FullName
            SizeBytes = $file.Length
            Sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        }
    }
}

New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null
$manifestRows | Export-Csv -LiteralPath $manifestPath -NoTypeInformation -Encoding UTF8

$totalBytes = ($manifestRows | Measure-Object -Property SizeBytes -Sum).Sum
Write-Output "Targets: $($targets.Count)"
Write-Output "Files: $($manifestRows.Count)"
Write-Output "Bytes: $totalBytes"
Write-Output "Manifest: $(Get-WorkspaceRelativePath -Path $manifestPath)"

if (-not $Execute) {
    Write-Output 'Plan only. Re-run with -Execute after reviewing the manifest.'
    exit 0
}

foreach ($target in $targets) {
    $safePath = Assert-SafeWorkspacePath -Path $target.FullName
    if (Test-Path -LiteralPath $safePath) {
        Remove-Item -LiteralPath $safePath -Recurse -Force
    }
}

Write-Output 'Obsolete artifacts removed. All CANONICAL_* backups preserved.'
