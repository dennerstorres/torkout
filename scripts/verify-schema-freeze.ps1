[CmdletBinding()]
param([switch]$Print)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$expectedContracts = 'bebd02ba4f9aeef1a39caf952f3b117305e34fc3628e183926c828accae0c93f'
$expectedSchema = '40708e6c0e158447e769679f4df529d3b02f6e86aa4728c4c945459b73bf5a84'

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

Write-Host 'Schema and public contracts match the 2.4.0 freeze.' -ForegroundColor Green
