$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $root '.env'
$exampleFile = Join-Path $root '.env.example'

if (-not (Test-Path -LiteralPath $environmentFile)) {
  Copy-Item -LiteralPath $exampleFile -Destination $environmentFile
  Write-Host 'Created .env from .env.example.'
}

Get-Content -LiteralPath $environmentFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $separator = $line.IndexOf('=')
  if ($separator -lt 1) { return }
  $name = $line.Substring(0, $separator).Trim()
  $value = $line.Substring($separator + 1)
  Set-Item -Path "Env:$name" -Value $value
}

Push-Location $root
try {
  docker compose -f compose.development.yml up -d --wait
  pnpm build:packages
  pnpm db:migrate
  pnpm --parallel --filter @torkout/api --filter @torkout/web dev
} finally {
  Pop-Location
}
