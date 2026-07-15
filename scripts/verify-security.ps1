[CmdletBinding()]
param([switch]$SelfTest)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$patterns = @(
    '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'AKIA[0-9A-Z]{16}',
    'gh[pousr]_[A-Za-z0-9]{30,}',
    'sk-(?:proj-)?[A-Za-z0-9_-]{24,}',
    'xox[baprs]-[A-Za-z0-9-]{20,}'
)

function Find-Secret([string]$Content) {
    foreach ($pattern in $patterns) {
        if ($Content -match $pattern) { return $pattern }
    }
    return $null
}

if ($SelfTest) {
    $fixture = 'AKIA' + ('A' * 16)
    if (-not (Find-Secret $fixture)) {
        throw 'Secret scanner failed to detect its controlled insecure fixture.'
    }
    Write-Host 'Secret scanner detected the controlled insecure fixture.' -ForegroundColor Green
}

$files = @(& git -C $root ls-files --cached --others --exclude-standard)
$findings = [System.Collections.Generic.List[string]]::new()
foreach ($relativePath in $files) {
    if ($relativePath -match '\.(png|ico|zip|dump|backup|lock)$') { continue }
    $path = Join-Path $root $relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
    $content = Get-Content -LiteralPath $path -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($null -eq $content) { continue }
    $matched = Find-Secret $content
    if ($matched) { $findings.Add("$relativePath matched $matched") }
}

if ($findings.Count -gt 0) {
    Write-Host 'Potential secrets found:' -ForegroundColor Red
    $findings | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
    exit 1
}

Write-Host "Secret scan passed for $($files.Count) repository files." -ForegroundColor Green
