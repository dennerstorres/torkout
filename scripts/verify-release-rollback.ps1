[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$migrationPath = Join-Path $root 'packages/database/migrations/0008_release_rollback_compatibility.sql'
$runbookPath = Join-Path $root 'docs/operations/rollback.md'
$failures = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $migrationPath -PathType Leaf)) {
    $failures.Add('Release rollback compatibility migration is missing.')
}
else {
    $migration = Get-Content -LiteralPath $migrationPath -Raw -Encoding UTF8
    foreach ($expected in @('2026-07-14', 'retired_at', 'NULL')) {
        if ($migration -notmatch [regex]::Escape($expected)) {
            $failures.Add("Rollback compatibility migration is missing: $expected")
        }
    }
    if ($migration -match '(?i)\b(drop|truncate)\b|alter\s+table.+drop') {
        $failures.Add('Rollback compatibility migration contains a destructive operation.')
    }
}

$runbook = Get-Content -LiteralPath $runbookPath -Raw -Encoding UTF8
foreach ($expected in @('migra', 'imagem anterior', 'readiness')) {
    if ($runbook -notmatch [regex]::Escape($expected)) {
        $failures.Add("Rollback runbook is missing: $expected")
    }
}

if ($failures.Count -gt 0) {
    Write-Host 'Release rollback verification failed:' -ForegroundColor Red
    foreach ($failure in $failures) { Write-Host " - $failure" -ForegroundColor Red }
    exit 1
}

Write-Host 'Release rollback verification passed: additive migration and previous legal versions remain compatible.' -ForegroundColor Green
