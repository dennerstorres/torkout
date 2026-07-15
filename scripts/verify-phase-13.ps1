[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'RELEASE_NOTES.md',
    'apps/api/src/release.integration.test.ts',
    'docs/operations/production-launch-checklist.md',
    'docs/release/schema-contract-freeze-v1.md',
    'docs/testing/phase-13-acceptance-checklist.md',
    'docs/testing/phase-13-release-audit.md',
    'e2e/reconnection.spec.ts',
    'packages/database/migrations/0008_release_rollback_compatibility.sql',
    'scripts/verify-release-rollback.ps1',
    'scripts/verify-schema-freeze.ps1'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 13 file is missing: $relativePath")
    }
}

$acceptancePath = Join-Path $root 'docs/testing/phase-13-acceptance-checklist.md'
if (Test-Path -LiteralPath $acceptancePath) {
    $acceptance = Get-Content -LiteralPath $acceptancePath -Raw -Encoding UTF8
    foreach ($index in 1..12) {
        $id = 'AC-{0:D2}' -f $index
        if ($acceptance -notmatch [regex]::Escape($id)) {
            $failures.Add("Acceptance checklist does not map SPEC section 17 item: $id")
        }
    }
}

$packageFiles = @(
    'package.json',
    'apps/api/package.json',
    'apps/web/package.json',
    'packages/contracts/package.json',
    'packages/database/package.json',
    'packages/domain/package.json'
)
foreach ($relativePath in $packageFiles) {
    $package = Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($package.version -ne '1.0.0') {
        $failures.Add("Release package is not frozen at 1.0.0: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-13') {
    $failures.Add('Root package.json is missing script: verify:phase-13')
}
if ($rootPackage.scripts.check -notmatch 'verify:phase-13') {
    $failures.Add('Root check does not include verify:phase-13')
}

foreach ($verification in @('scripts/verify-release-rollback.ps1', 'scripts/verify-schema-freeze.ps1')) {
    $path = Join-Path $root $verification
    if (Test-Path -LiteralPath $path) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $path
        if ($LASTEXITCODE -ne 0) { $failures.Add("Release verification failed: $verification") }
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 13 release verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 13 release structure passed for $($requiredFiles.Count) required files and 12 acceptance criteria." -ForegroundColor Green
