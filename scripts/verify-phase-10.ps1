[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'apps/api/src/export-package.ts',
    'apps/api/src/export-package.test.ts',
    'apps/api/src/portability-routes.ts',
    'apps/api/src/portability.integration.test.ts',
    'apps/web/src/components/AccountScreen.test.tsx',
    'e2e/portability.spec.ts',
    'packages/contracts/src/portability.ts',
    'packages/contracts/src/portability.test.ts'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 10 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-10') {
    $failures.Add('Root package.json is missing script: verify:phase-10')
}

$apiSource = Get-Content -LiteralPath (Join-Path $root 'apps/api/src/app.ts') -Raw -Encoding UTF8
if ($apiSource -notmatch 'registerPortabilityRoutes') {
    $failures.Add('Portability routes are not registered.')
}

$accountSource = Get-Content -LiteralPath (Join-Path $root 'apps/web/src/components/AccountScreen.tsx') -Raw -Encoding UTF8
if ($accountSource -notmatch 'Exportar JSON' -or $accountSource -notmatch 'deleteAccount') {
    $failures.Add('Account screen does not expose export and erasure actions.')
}

$contractSource = Get-Content -LiteralPath (Join-Path $root 'packages/contracts/src/portability.ts') -Raw -Encoding UTF8
if ($contractSource -notmatch "DATA_EXPORT_FORMAT_VERSION = '1.0.0'") {
    $failures.Add('The JSON data export format is not explicitly versioned.')
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 10 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Phase 10 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
