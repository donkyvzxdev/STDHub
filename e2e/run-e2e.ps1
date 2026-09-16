# STDHub e2e runner: boots `vite dev`, runs Playwright against real Edge
# (trusted mouse events), then shuts the server down.
# Usage: powershell -ExecutionPolicy Bypass -File e2e/run-e2e.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root 'app'
$viteBin = Join-Path $app 'node_modules/vite/bin/vite.js'
$vite = Start-Process -FilePath 'node' -ArgumentList @(
  $viteBin, '--port', '5173', '--strictPort'
) -WorkingDirectory $app -PassThru
try {
  $up = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
      $r = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) { $up = $true; break }
    } catch { }
  }
  if (-not $up) { throw 'vite dev did not come up on :5173' }
  Set-Location -LiteralPath $PSScriptRoot
  npx playwright test
  if ($LASTEXITCODE -ne 0) { throw "playwright failed ($LASTEXITCODE)" }
}
finally {
  Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
}
