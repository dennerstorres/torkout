[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    '.github/workflows/security.yml',
    'apps/api/src/authorization.test.ts',
    'apps/api/src/load.test.ts',
    'apps/api/src/operational.ts',
    'apps/api/src/privacy.test.ts',
    'apps/web/nginx.conf',
    'compose.production.yml',
    'compose.restore-test.yml',
    'docs/operations/backup-restore.md',
    'docs/operations/coolify-deploy.md',
    'docs/operations/domain-dns-smtp.md',
    'docs/operations/incident-response.md',
    'docs/operations/observability.md',
    'docs/operations/rollback.md',
    'docs/legal/privacy-notice.md',
    'docs/legal/terms-of-use.md',
    'docs/security/authorization-audit.md',
    'docs/security/threat-model.md',
    'infra/backup/Dockerfile',
    'infra/backup/backup.sh',
    'infra/postgres/init/001-create-app-user.sh',
    'packages/database/migrations/0007_phase_12_legal_documents.sql',
    'scripts/verify-backup-restore.ps1',
    'scripts/verify-security.ps1'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 12 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
foreach ($script in @('verify:phase-12', 'security:scan', 'test:restore')) {
    if (-not $rootPackage.scripts.$script) {
        $failures.Add("Root package.json is missing script: $script")
    }
}
if ($rootPackage.scripts.check -notmatch 'verify:phase-12') {
    $failures.Add('Root check does not include verify:phase-12')
}

$appSource = @(
    Get-Content -LiteralPath (Join-Path $root 'apps/api/src/app.ts') -Raw -Encoding UTF8
    Get-Content -LiteralPath (Join-Path $root 'apps/api/src/operational.ts') -Raw -Encoding UTF8
) -join "`n"
foreach ($expected in @('/health/ready', '/metrics', 'content-security-policy', 'trustProxy')) {
    if ($appSource -notmatch [regex]::Escape($expected)) {
        $failures.Add("API hardening is missing: $expected")
    }
}

$apiDockerfile = Get-Content -LiteralPath (Join-Path $root 'apps/api/Dockerfile') -Raw -Encoding UTF8
$webDockerfile = Get-Content -LiteralPath (Join-Path $root 'apps/web/Dockerfile') -Raw -Encoding UTF8
if ($apiDockerfile -notmatch '(?m)^USER node$') { $failures.Add('API runtime is not explicitly non-root.') }
if ($webDockerfile -notmatch '(?m)^USER nginx$') { $failures.Add('Web runtime is not explicitly non-root.') }

if ($failures.Count -gt 0) {
    Write-Host 'Phase 12 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 12 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
