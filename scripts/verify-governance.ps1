[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure {
    param([Parameter(Mandatory)][string]$Message)
    $failures.Add($Message)
}

function Get-ProjectPath {
    param([Parameter(Mandatory)][string]$RelativePath)
    Join-Path $root $RelativePath
}

$requiredFiles = @(
    '.editorconfig',
    '.gitattributes',
    '.gitignore',
    'LICENSE',
    'SPEC.md',
    'PLAN.md',
    'HISTORY.md',
    'CLAUDE.md',
    'CONTRIBUTING.md',
    'docs/adr/README.md',
    'docs/adr/template.md',
    'docs/adr/0001-technology-stack.md',
    'docs/adr/0002-local-first-synchronization.md',
    'docs/adr/0003-authentication.md'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Get-ProjectPath $relativePath) -PathType Leaf)) {
        Add-Failure "Required file is missing: $relativePath"
    }
}

if (-not (Test-Path -LiteralPath (Get-ProjectPath '.git') -PathType Container)) {
    Add-Failure 'The project is not a Git repository.'
}
else {
    $branch = git -C $root branch --show-current
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') {
        Add-Failure "Expected current branch 'main', received '$branch'."
    }
}

$markdownFiles = Get-ChildItem -LiteralPath $root -Filter '*.md' -File
$adrDirectory = Get-ProjectPath 'docs/adr'
if (Test-Path -LiteralPath $adrDirectory -PathType Container) {
    $markdownFiles += Get-ChildItem -LiteralPath $adrDirectory -Filter '*.md' -File
}

foreach ($file in $markdownFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $relativeName = $file.FullName.Substring($root.Length).TrimStart('\', '/')
    $h1Count = ([regex]::Matches($content, '(?m)^# ')).Count
    if ($h1Count -ne 1) {
        Add-Failure "$relativeName must contain exactly one H1 heading; found $h1Count."
    }

    $fenceCount = ([regex]::Matches($content, '(?m)^```')).Count
    if (($fenceCount % 2) -ne 0) {
        Add-Failure "$relativeName contains unbalanced fenced code blocks."
    }

    $links = [regex]::Matches($content, '\[[^\]]+\]\((?!https?://|mailto:|#)(?<target>[^)#]+)(?:#[^)]+)?\)')
    foreach ($link in $links) {
        $target = [Uri]::UnescapeDataString($link.Groups['target'].Value.Trim('<', '>'))
        $resolvedTarget = Join-Path $file.DirectoryName $target
        if (-not (Test-Path -LiteralPath $resolvedTarget)) {
            Add-Failure "$relativeName contains a broken relative link: $target"
        }
    }
}

$specPath = Get-ProjectPath 'SPEC.md'
if (Test-Path -LiteralPath $specPath -PathType Leaf) {
    $spec = Get-Content -LiteralPath $specPath -Raw -Encoding UTF8
    $requirementIds = [regex]::Matches($spec, '\*\*([A-Z]+-[0-9]{3})') |
        ForEach-Object { $_.Groups[1].Value }
    $duplicateIds = $requirementIds | Group-Object | Where-Object Count -gt 1
    foreach ($duplicate in $duplicateIds) {
        Add-Failure "Duplicate requirement ID in SPEC.md: $($duplicate.Name)"
    }
}

$planPath = Get-ProjectPath 'PLAN.md'
if (Test-Path -LiteralPath $planPath -PathType Leaf) {
    $plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8
    $phaseCount = ([regex]::Matches($plan, '(?m)^### Fase [0-9]+')).Count
    $commitCount = ([regex]::Matches($plan, '\*\*Commit esperado:\*\*')).Count
    if ($phaseCount -eq 0 -or $phaseCount -ne $commitCount) {
        Add-Failure "PLAN.md must define exactly one expected commit per phase; phases=$phaseCount commits=$commitCount."
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Governance verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host " - $failure" -ForegroundColor Red
    }
    exit 1
}

Write-Host "Governance verification passed for $($requiredFiles.Count) required files and $($markdownFiles.Count) Markdown files." -ForegroundColor Green
