$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$preferredAlias = 'mall-virtual-one-ten.vercel.app'
$fallbackAlias = 'mall-virtual-one-mu.vercel.app'

if (-not (Test-Path '.vercel\project.json')) {
  throw 'No se encontro .vercel\project.json. Primero debes vincular este proyecto con Vercel.'
}

$projectInfo = Get-Content -Raw '.vercel\project.json' | ConvertFrom-Json
Write-Host "Proyecto Vercel vinculado: $($projectInfo.projectName)" -ForegroundColor Cyan

Write-Host 'Publicando version de produccion...' -ForegroundColor Yellow
$previousNativePreference = $null
if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $previousNativePreference = $PSNativeCommandUseErrorActionPreference
  $PSNativeCommandUseErrorActionPreference = $false
}
$deployOutput = & npx --yes vercel deploy --prod --yes 2>&1
$deployExitCode = $LASTEXITCODE
$LASTEXITCODE = 0
$deployText = ($deployOutput | Out-String)
$deployText.Trim() | Write-Host

if ($null -ne $previousNativePreference) {
  $PSNativeCommandUseErrorActionPreference = $previousNativePreference
}

if ($deployExitCode -ne 0) {
  throw $deployText.Trim()
}

$productionUrl = $null
$inspectUrl = $null

foreach ($line in ($deployText -split "`r?`n")) {
  if (-not $inspectUrl -and $line -match 'Inspect:\s+(https://\S+)') {
    $inspectUrl = $Matches[1]
  }
  if (-not $productionUrl -and $line -match 'Production:\s+(https://\S+)') {
    $productionUrl = $Matches[1]
  }
}

if (-not $productionUrl) {
  throw 'No pude detectar la URL del nuevo deployment en la salida de Vercel.'
}

Write-Host "Deployment publicado: $productionUrl" -ForegroundColor Green
if ($inspectUrl) {
  Write-Host "Inspeccion: $inspectUrl" -ForegroundColor DarkGray
}

function Set-AliasIfPossible {
  param(
    [Parameter(Mandatory = $true)][string]$DeploymentUrl,
    [Parameter(Mandatory = $true)][string]$Alias
  )

  Write-Host "Intentando asignar alias estable: $Alias" -ForegroundColor Yellow
  $previousNativePreferenceInner = $null
  if (Get-Variable PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $previousNativePreferenceInner = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
  }

  $aliasOutput = & npx --yes vercel alias set $DeploymentUrl $Alias 2>&1
  $aliasExitCode = $LASTEXITCODE
  $LASTEXITCODE = 0
  $aliasText = ($aliasOutput | Out-String)

  if ($null -ne $previousNativePreferenceInner) {
    $PSNativeCommandUseErrorActionPreference = $previousNativePreferenceInner
  }

  if ($aliasExitCode -eq 0) {
    Write-Host "Alias asignado correctamente: https://$Alias" -ForegroundColor Green
    return @{
      Success = $true
      Message = $aliasText.Trim()
    }
  }

  if ($aliasText -match 'already in use') {
    Write-Warning "El alias $Alias ya esta en uso por otro deployment o proyecto."
    return @{
      Success = $false
      Message = $aliasText.Trim()
    }
  }

  throw $aliasText.Trim()
}

$preferred = Set-AliasIfPossible -DeploymentUrl $productionUrl -Alias $preferredAlias

if (-not $preferred.Success) {
  Write-Host "Intentando mantener al menos este alias alternativo: $fallbackAlias" -ForegroundColor Yellow
  $fallback = Set-AliasIfPossible -DeploymentUrl $productionUrl -Alias $fallbackAlias

  if ($fallback.Success) {
    Write-Host '' 
    Write-Host 'Resumen:' -ForegroundColor Cyan
    Write-Host "  URL oficial temporal: https://$fallbackAlias"
    Write-Host "  Para volver a usar https://$preferredAlias debes liberar ese alias en Vercel y ejecutar nuevamente este script."
  }
}
else {
  Write-Host ''
  Write-Host 'Resumen:' -ForegroundColor Cyan
  Write-Host "  URL oficial: https://$preferredAlias"
}
