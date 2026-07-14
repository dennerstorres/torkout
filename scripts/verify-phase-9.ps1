[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'apps/api/src/analytics-routes.ts',
    'apps/api/src/analytics.integration.test.ts',
    'apps/web/src/components/AnalyticsScreen.tsx',
    'apps/web/src/components/AnalyticsScreen.test.tsx',
    'e2e/analytics.spec.ts',
    'packages/contracts/src/analytics.ts',
    'packages/contracts/src/analytics.test.ts',
    'packages/domain/src/analytics.ts',
    'packages/domain/src/analytics.test.ts'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 9 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-9') {
    $failures.Add('Root package.json is missing script: verify:phase-9')
}

$apiSource = Get-Content -LiteralPath (Join-Path $root 'apps/api/src/app.ts') -Raw -Encoding UTF8
if ($apiSource -notmatch 'registerAnalyticsRoutes') {
    $failures.Add('Analytics routes are not registered.')
}

$webSource = Get-Content -LiteralPath (Join-Path $root 'apps/web/src/App.tsx') -Raw -Encoding UTF8
if ($webSource -notmatch 'AnalyticsScreen') {
    $failures.Add('Analytics screen is not reachable from the application.')
}

$webPackage = Get-Content -LiteralPath (Join-Path $root 'apps/web/package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $webPackage.dependencies.recharts) {
    $failures.Add('Recharts is missing from the web dependencies.')
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 9 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Phase 9 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
