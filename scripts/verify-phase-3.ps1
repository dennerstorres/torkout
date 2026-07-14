[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

$requiredFiles = @(
    'apps/api/src/auth.ts',
    'apps/api/src/auth-routes.ts',
    'apps/api/src/email.ts',
    'apps/api/src/password.ts',
    'apps/api/src/profile-routes.ts',
    'apps/api/src/admin-routes.ts',
    'apps/api/src/privacy.ts',
    'apps/web/src/auth-client.ts',
    'apps/web/src/components/AuthScreen.tsx',
    'apps/web/src/components/OnboardingScreen.tsx',
    'apps/web/src/components/AccountScreen.tsx',
    'packages/contracts/src/auth.ts',
    'packages/domain/src/offline-auth.ts',
    'e2e/auth.spec.ts'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 3 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-3') {
    $failures.Add('Root package.json is missing script: verify:phase-3')
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 3 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 3 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
