[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

$requiredFiles = @(
    'apps/api/src/planning-routes.ts',
    'apps/api/src/planning.integration.test.ts',
    'apps/web/src/components/PlanningScreen.tsx',
    'apps/web/src/components/PlanningScreen.test.tsx',
    'e2e/planning.spec.ts',
    'packages/contracts/src/planning.ts',
    'packages/contracts/src/planning.test.ts',
    'packages/database/migrations/0004_phase_5_planning.sql',
    'packages/domain/src/planning.ts',
    'packages/domain/src/planning.test.ts'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 5 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-5') {
    $failures.Add('Root package.json is missing script: verify:phase-5')
}

$appSource = Get-Content -LiteralPath (Join-Path $root 'apps/api/src/app.ts') -Raw -Encoding UTF8
if ($appSource -notmatch 'registerPlanningRoutes') {
    $failures.Add('Planning routes are not registered in the API application.')
}

$syncContract = Get-Content -LiteralPath (Join-Path $root 'packages/contracts/src/sync.ts') -Raw -Encoding UTF8
foreach ($entityType in @('exercise', 'training_plan', 'workout_template', 'workout_session')) {
    if ($syncContract -notmatch [Regex]::Escape("'$entityType'")) {
        $failures.Add("Planning sync entity is missing from the contract: $entityType")
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 5 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 5 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
