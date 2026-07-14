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
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'eslint.config.mjs',
    'prettier.config.mjs',
    '.prettierignore',
    '.env.example',
    '.dockerignore',
    'vitest.config.ts',
    'playwright.config.ts',
    'compose.test.yml',
    '.github/workflows/ci.yml',
    'apps/api/package.json',
    'apps/api/tsconfig.json',
    'apps/api/Dockerfile',
    'apps/api/src/app.ts',
    'apps/api/src/env.ts',
    'apps/api/src/app.test.ts',
    'apps/web/package.json',
    'apps/web/tsconfig.json',
    'apps/web/Dockerfile',
    'apps/web/index.html',
    'apps/web/src/App.tsx',
    'apps/web/src/App.test.tsx',
    'packages/contracts/package.json',
    'packages/contracts/src/index.ts',
    'packages/contracts/src/index.test.ts',
    'packages/database/package.json',
    'packages/domain/package.json',
    'packages/test-utils/package.json'
)

foreach ($relativePath in $requiredFiles) {
    $absolutePath = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
        Add-Failure "Required Phase 1 file is missing: $relativePath"
    }
}

$rootPackagePath = Join-Path $root 'package.json'
if (Test-Path -LiteralPath $rootPackagePath -PathType Leaf) {
    try {
        $package = Get-Content -LiteralPath $rootPackagePath -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($script in @('build', 'check', 'format:check', 'lint', 'test', 'test:integration', 'test:e2e', 'typecheck', 'verify:governance')) {
            if (-not $package.scripts.$script) {
                Add-Failure "Root package.json is missing script: $script"
            }
        }
        if (-not ($package.packageManager -match '^pnpm@')) {
            Add-Failure 'Root package.json must pin pnpm in packageManager.'
        }
        if ($package.private -ne $true) {
            Add-Failure 'Root package.json must be private.'
        }
    }
    catch {
        Add-Failure "Root package.json is invalid: $($_.Exception.Message)"
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 1 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Phase 1 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
