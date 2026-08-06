[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compose = Join-Path $root 'compose.restore-test.yml'
$backupPath = Join-Path ([IO.Path]::GetTempPath()) "torkout-restore-$([guid]::NewGuid()).dump"
$stopwatch = [Diagnostics.Stopwatch]::StartNew()

try {
    & docker compose -f $compose up -d --wait
    if ($LASTEXITCODE -ne 0) { throw 'Restore test databases did not become healthy.' }

    $env:DATABASE_URL = 'postgresql://restore_test:restore_test@127.0.0.1:15434/torkout_restore_source'
    & pnpm --dir $root db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'Source migrations failed.' }

    $source = (& docker compose -f $compose ps -q source).Trim()
    $target = (& docker compose -f $compose ps -q target).Trim()
    $createdAt = [DateTimeOffset]::UtcNow.ToString('O')
    & docker exec $source psql -U restore_test -d torkout_restore_source -v ON_ERROR_STOP=1 -c "create table restore_probe(created_at timestamptz not null); insert into restore_probe values ('$createdAt');"
    if ($LASTEXITCODE -ne 0) { throw 'Could not seed the source restore probe.' }
    & docker exec $source pg_dump -U restore_test -d torkout_restore_source -Fc -f /tmp/torkout.dump
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
    & docker cp "${source}:/tmp/torkout.dump" $backupPath
    & docker cp $backupPath "${target}:/tmp/torkout.dump"
    & docker exec $target pg_restore -U restore_test -d torkout_restore_target --no-owner --no-acl /tmp/torkout.dump
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }

    $restoredAt = (& docker exec $target psql -U restore_test -d torkout_restore_target -At -c 'select created_at from restore_probe limit 1').Trim()
    $tableCount = [int](& docker exec $target psql -U restore_test -d torkout_restore_target -At -c "select count(*) from information_schema.tables where table_schema = 'public'")
    $stopwatch.Stop()
    $rpoHours = ([DateTimeOffset]::UtcNow - [DateTimeOffset]::Parse($restoredAt)).TotalHours
    if ($tableCount -lt 20) { throw "Restored schema is incomplete: $tableCount tables." }
    if ($rpoHours -gt 24) { throw "RPO exceeded 24 hours: $rpoHours." }
    if ($stopwatch.Elapsed.TotalHours -gt 4) { throw "RTO exceeded 4 hours: $($stopwatch.Elapsed)." }

    [pscustomobject]@{
        restoredTables = $tableCount
        rpoHours = [math]::Round($rpoHours, 4)
        rtoSeconds = [math]::Round($stopwatch.Elapsed.TotalSeconds, 2)
        status = 'passed'
    } | ConvertTo-Json
}
finally {
    if (Test-Path -LiteralPath $backupPath) { Remove-Item -LiteralPath $backupPath -Force }
    & docker compose -f $compose down --volumes
}
