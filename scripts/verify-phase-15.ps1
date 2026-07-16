[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()
$requiredFiles = @(
    'DESIGN.md',
    'apps/web/src/components/DesignSystemLab.tsx',
    'apps/web/src/components/BrandMark.tsx',
    'apps/web/src/components/BrandMark.test.tsx',
    'apps/web/src/components/DesignSystemLab.test.tsx',
    'apps/web/src/presentation.ts',
    'apps/web/src/presentation.test.tsx',
    'apps/web/src/styles/tokens.css',
    'apps/web/src/styles/base.css',
    'apps/web/src/styles/layout.css',
    'apps/web/src/styles/components.css',
    'apps/web/src/styles/features.css',
    'docs/testing/phase-15-ui-inventory.md',
    'docs/testing/phase-15-visual-contract.md',
    'docs/testing/phase-15-acceptance.md',
    'e2e/visual.spec.ts'
)

$designContract = Get-Content -LiteralPath (Join-Path $root 'DESIGN.md') -Raw -Encoding UTF8
foreach ($requiredToken in @(
    '--color-primary',
    '--space-4',
    '--radius-lg',
    '--content-wide',
    '--duration-fast'
)) {
    if (-not $designContract.Contains($requiredToken)) {
        $failures.Add("DESIGN.md does not document required token: $requiredToken")
    }
}

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $relativePath) -PathType Leaf)) {
        $failures.Add("Required Phase 15 file is missing: $relativePath")
    }
}

$entry = Get-Content -LiteralPath (Join-Path $root 'apps/web/src/styles.css') -Raw -Encoding UTF8
$expectedImports = @(
    "@import './styles/tokens.css';",
    "@import './styles/base.css';",
    "@import './styles/layout.css';",
    "@import './styles/components.css';",
    "@import './styles/features.css';"
)
$cursor = -1
foreach ($import in $expectedImports) {
    $index = $entry.IndexOf($import, [System.StringComparison]::Ordinal)
    if ($index -lt 0) { $failures.Add("Phase 15 CSS entry is missing: $import") }
    elseif ($index -le $cursor) { $failures.Add("Phase 15 CSS import order is invalid at: $import") }
    $cursor = $index
}

$sourceRoots = @('apps/web/src', 'apps/api/src')
foreach ($sourceRoot in $sourceRoots) {
    foreach ($source in Get-ChildItem -LiteralPath (Join-Path $root $sourceRoot) -Recurse -File) {
        $content = Get-Content -LiteralPath $source.FullName -Raw -Encoding UTF8
        foreach ($character in @([char]0xFFFD, [char]0x00C3, [char]0x00C2)) {
            if ($content.Contains($character)) {
                $failures.Add("Possible mojibake found: $($source.FullName)")
                break
            }
        }
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Phase 15 visual-system verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host "Phase 15 visual-system structure passed for $($requiredFiles.Count) required files." -ForegroundColor Green
