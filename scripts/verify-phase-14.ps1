[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'apps/web/src/components/AuthenticatedShell.tsx',
    'apps/web/src/components/AuthenticatedShell.test.tsx',
    'apps/web/src/components/ui.tsx',
    'apps/web/src/components/ui.test.tsx',
    'docs/testing/phase-14-ui-ux-audit.md',
    'e2e/visual.spec.ts',
    'e2e/visual.spec.ts-snapshots/today-mobile-chromium-mobile-win32.png',
    'e2e/visual.spec.ts-snapshots/today-desktop-chromium-mobile-win32.png'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 14 file is missing: $relativePath")
    }
}

$styleFiles = @((Join-Path $root 'apps/web/src/styles.css')) + @(
    Get-ChildItem -LiteralPath (Join-Path $root 'apps/web/src/styles') -Filter '*.css' -File |
        ForEach-Object { $_.FullName }
)
$styles = ($styleFiles | ForEach-Object { Get-Content -LiteralPath $_ -Raw -Encoding UTF8 }) -join "`n"
foreach ($token in @('--color-primary:', '--color-danger:', '--color-surface:', 'prefers-reduced-motion', 'forced-colors', 'safe-area-inset-bottom')) {
    if ($styles -notmatch [regex]::Escape($token)) { $failures.Add("Phase 14 CSS is missing: $token") }
}

$webSources = Get-ChildItem -LiteralPath (Join-Path $root 'apps/web/src') -Recurse -File
foreach ($source in $webSources) {
    $content = Get-Content -LiteralPath $source.FullName -Raw -Encoding UTF8
    if ($content -match 'tailwindcss\.com|fonts\.googleapis\.com|Material Symbols') {
        $failures.Add("Runtime remote visual dependency found: $($source.FullName)")
    }
    $replacementCharacter = [char]0xFFFD
    $latinCapitalAWithTilde = [char]0x00C3
    $latinCapitalAWithCircumflex = [char]0x00C2
    if ($content.Contains($replacementCharacter) -or $content.Contains($latinCapitalAWithCircumflex) -or $content.Contains($latinCapitalAWithTilde)) {
        $failures.Add("Possible mojibake found: $($source.FullName)")
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 14 UI/UX verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 14 UI/UX structure passed for $($requiredFiles.Count) required files." -ForegroundColor Green
