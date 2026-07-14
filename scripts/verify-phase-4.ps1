[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

$requiredFiles = @(
    'apps/api/src/sync-routes.ts',
    'apps/api/src/sync.integration.test.ts',
    'apps/web/src/sync/local-database.ts',
    'apps/web/src/sync/sync-coordinator.ts',
    'apps/web/src/sync/http-transport.ts',
    'apps/web/src/sync/use-sync-runtime.ts',
    'apps/web/src/components/SyncPanel.tsx',
    'apps/web/src/local-sync.test.tsx',
    'packages/contracts/src/sync.ts',
    'packages/contracts/src/sync.test.ts',
    'packages/database/migrations/0003_phase_4_sync.sql'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 4 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-4') {
    $failures.Add('Root package.json is missing script: verify:phase-4')
}

$webPackage = Get-Content -LiteralPath (Join-Path $root 'apps/web/package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $webPackage.dependencies.dexie) {
    $failures.Add('Web package is missing the required Dexie dependency.')
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 4 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 4 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
