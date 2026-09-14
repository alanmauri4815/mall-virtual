[CmdletBinding()]
param(
    [string]$OutputPath = 'docs\PROJECT_FILE_MATRIX_20260809.csv'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $OutputPath))
$projectPrefix = $projectRoot.TrimEnd('\') + '\'
if (-not $resolvedOutput.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "La matriz debe quedar dentro del proyecto: $resolvedOutput"
}

$trackedFiles = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
& git -C $projectRoot ls-files | ForEach-Object { [void]$trackedFiles.Add(($_ -replace '/', '\')) }

function Get-RelativeProjectPath {
    param([string]$FullPath)
    $resolved = [System.IO.Path]::GetFullPath($FullPath)
    if (-not $resolved.StartsWith($projectPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Ruta fuera del proyecto: $resolved"
    }
    return $resolved.Substring($projectPrefix.Length)
}

function Get-Classification {
    param([string]$Path)
    $normalized = $Path -replace '/', '\'
    $name = Split-Path -Leaf $normalized

    if ($normalized -eq 'index.html') { return @('production-entrypoint', 'critical', 'keep') }
    if ($normalized -eq 'css\mall.css') { return @('production-style', 'high', 'keep') }
    if ($normalized -like 'js\mall\*.js') {
        if ($normalized -like '*.backup*') { return @('legacy-backup', 'low', 'delete-candidate') }
        return @('production-module', 'critical', 'keep')
    }
    if ($normalized -like 'assets\vendor\*') { return @('vendored-dependency', 'high', 'keep-and-integrity-test') }
    if ($normalized -like 'assets\*') { return @('production-asset', 'medium', 'keep') }
    if ($normalized -like 'supabase\functions\*') { return @('backend-edge-function', 'critical', 'keep') }
    if ($normalized -like 'supabase\*.sql') { return @('database-operation', 'critical', 'review-and-organize') }
    if ($normalized -like 'supabase\*') { return @('database-support', 'high', 'review-and-organize') }
    if ($normalized -like 'tests\*') { return @('test', 'high', 'keep') }
    if ($normalized -like 'tools\*') { return @('developer-tool', 'medium', 'keep') }
    if ($normalized -like 'docs\*' -or $name -like '*.md') { return @('documentation', 'low', 'review-and-organize') }
    if ($normalized -like 'index*BKP*.html' -or $normalized -like 'index*.backup*.html' -or $normalized -eq 'index_OLD.html') {
        return @('legacy-backup', 'low', 'delete-candidate')
    }
    if ($normalized -like 'index_pro*.html' -or $normalized -like 'index_ROTA*.html') {
        return @('legacy-entrypoint', 'medium', 'archive-or-delete')
    }
    if ($name -match '^(adjust|align|clear|cut|extend|final|fix|join|precision|reapply|refine|remove|restore|set)_' -and $name -like '*.js') {
        return @('one-off-script', 'low', 'archive-or-delete')
    }
    if ($normalized -in @('store.html', 'app.js', 'config.js', 'utils.js')) { return @('secondary-application', 'high', 'review-before-moving') }
    if ($name -like '*.png' -or $name -like '*.csv' -or $name -like '*.json') { return @('generated-or-data-artifact', 'low', 'review') }
    return @('unclassified', 'medium', 'manual-review')
}

$excludedTopDirectories = @('.git', '.vercel', 'backups', 'edge-test', 'node_modules')
$rows = foreach ($file in (Get-ChildItem -LiteralPath $projectRoot -Recurse -File -Force)) {
    $relative = Get-RelativeProjectPath -FullPath $file.FullName
    $topDirectory = ($relative -split '[\\/]')[0]
    if ($excludedTopDirectories -contains $topDirectory) { continue }
    if (($relative -split '[\\/]') -contains 'node_modules') { continue }
    if ($file.Name -like '.env*' -or $file.Name -like '*.log') { continue }

    $classification = Get-Classification -Path $relative
    [pscustomobject]@{
        Path = $relative
        Category = $classification[0]
        Risk = $classification[1]
        ProposedDisposition = $classification[2]
        TrackedByGit = $trackedFiles.Contains($relative)
        Bytes = $file.Length
        LastModified = $file.LastWriteTime.ToString('s')
    }
}

$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$rows | Sort-Object Category, Path | Export-Csv -LiteralPath $resolvedOutput -NoTypeInformation -Encoding utf8

$categorySummary = $rows | Group-Object Category | Sort-Object Count -Descending | ForEach-Object {
    [pscustomobject]@{ Category = $_.Name; Files = $_.Count }
}
$summaryPath = [System.IO.Path]::ChangeExtension($resolvedOutput, '.summary.txt')
@(
    "GeneratedAt=$((Get-Date).ToString('o'))"
    "TotalFiles=$($rows.Count)"
    "TrackedFiles=$(($rows | Where-Object TrackedByGit).Count)"
    "UntrackedFiles=$(($rows | Where-Object { -not $_.TrackedByGit }).Count)"
    ''
    ($categorySummary | Format-Table -AutoSize | Out-String).TrimEnd()
) | Set-Content -LiteralPath $summaryPath -Encoding utf8

Write-Output "MATRIX=$resolvedOutput"
Write-Output "SUMMARY=$summaryPath"
Write-Output "FILES=$($rows.Count)"
