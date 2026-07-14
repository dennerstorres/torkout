[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message)
}

$requiredFiles = @(
    'drizzle.config.ts',
    'packages/database/src/client.ts',
    'packages/database/src/migrate.ts',
    'packages/database/src/schema/auth.ts',
    'packages/database/src/schema/common.ts',
    'packages/database/src/schema/privacy.ts',
    'packages/database/src/schema/progression.ts',
    'packages/database/src/schema/sync.ts',
    'packages/database/src/schema/tracking.ts',
    'packages/database/src/schema/training.ts',
    'packages/database/src/schema/index.ts',
    'packages/database/src/schema.integration.test.ts',
    'packages/domain/src/time.ts',
    'packages/domain/src/time.test.ts',
    'packages/test-utils/src/factories.ts'
)

foreach ($relativePath in $requiredFiles) {
    $absolutePath = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        Add-Failure "Required Phase 2 file is missing: $relativePath"
    }
}

$migrationsPath = Join-Path $root 'packages/database/migrations'
$migrationFiles = @()
if (Test-Path -LiteralPath $migrationsPath -PathType Container) {
    $migrationFiles = @(Get-ChildItem -LiteralPath $migrationsPath -Filter '*.sql' -File)
}
if ($migrationFiles.Count -lt 1) {
    Add-Failure 'At least one versioned SQL migration is required.'
}

$rootPackagePath = Join-Path $root 'package.json'
if (Test-Path -LiteralPath $rootPackagePath -PathType Leaf) {
    $package = Get-Content -LiteralPath $rootPackagePath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($script in @('db:generate', 'db:migrate', 'verify:phase-2')) {
        if (-not $package.scripts.$script) {
            Add-Failure "Root package.json is missing script: $script"
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 2 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Phase 2 structural verification passed for $($requiredFiles.Count) required files and $($migrationFiles.Count) migration(s)." -ForegroundColor Green
