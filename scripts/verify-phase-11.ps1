[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'apps/web/public/icons/torkout-source.svg',
    'apps/web/public/icons/torkout-192.png',
    'apps/web/public/icons/torkout-512.png',
    'apps/web/public/icons/torkout-maskable-512.png',
    'apps/web/public/icons/apple-touch-icon.png',
    'apps/web/src/components/PwaExperience.tsx',
    'apps/web/src/components/PwaExperience.test.tsx',
    'apps/web/src/pwa-registration.ts',
    'e2e/accessibility.spec.ts',
    'e2e/pwa.spec.ts',
    'docs/testing/phase-11-device-checklist.md'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 11 file is missing: $relativePath")
    }
}

$rootPackage = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $rootPackage.scripts.'verify:phase-11') {
    $failures.Add('Root package.json is missing script: verify:phase-11')
}
if ($rootPackage.scripts.check -notmatch 'verify:phase-11') {
    $failures.Add('Root check does not include verify:phase-11')
}

$webPackage = Get-Content -LiteralPath (Join-Path $root 'apps/web/package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $webPackage.devDependencies.'vite-plugin-pwa') {
    $failures.Add('Web package is missing vite-plugin-pwa')
}

$viteSource = Get-Content -LiteralPath (Join-Path $root 'apps/web/vite.config.ts') -Raw -Encoding UTF8
foreach ($expected in @('VitePWA', "registerType: 'prompt'", "display: 'standalone'", "start_url: '/'", 'NetworkOnly')) {
    if ($viteSource -notmatch [regex]::Escape($expected)) {
        $failures.Add("Vite PWA configuration is missing: $expected")
    }
}

$indexSource = Get-Content -LiteralPath (Join-Path $root 'apps/web/index.html') -Raw -Encoding UTF8
if ($indexSource -notmatch 'apple-touch-icon') {
    $failures.Add('Web index is missing the Apple touch icon')
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 11 structural verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Phase 11 structural verification passed for $($requiredFiles.Count) required files." -ForegroundColor Green
