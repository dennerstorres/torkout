[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'apps/api/src/progression-routes.ts',
    'apps/api/src/progression-service.ts',
    'apps/api/src/progression.integration.test.ts',
    'apps/web/src/components/ProgressionScreen.tsx',
    'apps/web/src/components/ProgressionScreen.test.tsx',
    'e2e/progression.spec.ts',
    'packages/contracts/src/progression.ts',
    'packages/contracts/src/progression.test.ts',
    'packages/database/migrations/0006_phase_7_progression.sql',
    'packages/domain/src/progression.ts',
    'packages/domain/src/progression.test.ts'
)
foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 7 file is missing: $relativePath")
    }
}
$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-7') { $failures.Add('Root package.json is missing script: verify:phase-7') }
$appSource = Get-Content -LiteralPath (Join-Path $root 'apps/api/src/app.ts') -Raw -Encoding UTF8
if ($appSource -notmatch 'registerProgressionRoutes') { $failures.Add('Progression routes are not registered.') }
$syncSource = Get-Content -LiteralPath (Join-Path $root 'apps/api/src/sync-routes.ts') -Raw -Encoding UTF8
if ($syncSource -notmatch 'evaluateProgressionForSession') { $failures.Add('Progression is not evaluated after synchronization.') }
if ($failures.Count -gt 0) {
    Write-Host 'Phase 7 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}
Write-Host "Phase 7 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
