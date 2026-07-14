[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

$requiredFiles = @(
    'apps/api/src/daily-routes.ts',
    'apps/api/src/daily.integration.test.ts',
    'apps/web/src/components/TodayScreen.tsx',
    'apps/web/src/components/TodayScreen.test.tsx',
    'e2e/today.spec.ts',
    'packages/contracts/src/daily.ts',
    'packages/contracts/src/daily.test.ts',
    'packages/database/migrations/0005_phase_6_daily_tracking.sql',
    'packages/domain/src/daily.ts',
    'packages/domain/src/daily.test.ts'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 6 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-6') {
    $failures.Add('Root package.json is missing script: verify:phase-6')
}

$appSource = Get-Content -LiteralPath (Join-Path $root 'apps/api/src/app.ts') -Raw -Encoding UTF8
if ($appSource -notmatch 'registerDailyRoutes') {
    $failures.Add('Daily routes are not registered in the API application.')
}

$syncContract = Get-Content -LiteralPath (Join-Path $root 'packages/contracts/src/sync.ts') -Raw -Encoding UTF8
foreach ($entityType in @('habit_definition', 'habit_entry', 'pain_report')) {
    if ($syncContract -notmatch [Regex]::Escape("'$entityType'")) {
        $failures.Add("Daily sync entity is missing from the contract: $entityType")
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 6 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 6 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
