[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'apps/api/src/history-routes.ts',
    'apps/api/src/history.integration.test.ts',
    'apps/web/src/components/HistoryScreen.tsx',
    'apps/web/src/components/HistoryScreen.test.tsx',
    'e2e/history.spec.ts',
    'packages/contracts/src/history.ts',
    'packages/contracts/src/history.test.ts',
    'packages/domain/src/history.ts',
    'packages/domain/src/history.test.ts'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 8 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-8') {
    $failures.Add('Root package.json is missing script: verify:phase-8')
}

$appSource = Get-Content -LiteralPath (Join-Path $root 'apps/api/src/app.ts') -Raw -Encoding UTF8
if ($appSource -notmatch 'registerHistoryRoutes') {
    $failures.Add('History routes are not registered.')
}

$webSource = Get-Content -LiteralPath (Join-Path $root 'apps/web/src/App.tsx') -Raw -Encoding UTF8
if ($webSource -notmatch 'HistoryScreen') {
    $failures.Add('History screen is not reachable from the application.')
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 8 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Phase 8 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
