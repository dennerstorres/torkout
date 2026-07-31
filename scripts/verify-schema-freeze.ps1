[CmdletBinding()]
param([switch]$Print)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$expectedContracts = '9a65522df9f5f58b0fdb517328f3e35650f3f2645bdd16786f20d8d3442b5b57'
$expectedSchema = '727cc40958794ee5b02efcb02edb4b16a8f14ef30c89b4f34e8cb313793d6d7d'

function Get-TreeDigest([string[]]$paths) {
    $files = foreach ($relativePath in $paths) {
        Get-ChildItem -LiteralPath (Join-Path $root $relativePath) -Recurse -File |
            Where-Object { $_.Extension -in @('.sql', '.ts') -and $_.Name -notmatch '\.test\.ts$' }
    }
    $manifest = $files |
        Sort-Object FullName -Unique |
        ForEach-Object {
            $relative = $_.FullName.Substring($root.Length).TrimStart([char[]]@('\', '/')).Replace('\', '/')
            "$relative $((Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant())"
        }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($manifest -join "`n"))
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { $hash = $algorithm.ComputeHash($bytes) }
    finally { $algorithm.Dispose() }
    return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
}

$contracts = Get-TreeDigest @('packages/contracts/src')
$schema = Get-TreeDigest @('packages/database/migrations', 'packages/database/src/schema')

if ($Print) {
    [pscustomobject]@{ contracts = $contracts; schema = $schema } | ConvertTo-Json
    exit 0
}

$failures = [System.Collections.Generic.List[string]]::new()
if ($contracts -ne $expectedContracts) { $failures.Add("Contracts freeze changed: $contracts") }
if ($schema -ne $expectedSchema) { $failures.Add("Schema freeze changed: $schema") }
if ($failures.Count -gt 0) {
    Write-Host 'Schema/contract freeze verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Schema and public contracts match the 2.3.0 freeze.' -ForegroundColor Green
