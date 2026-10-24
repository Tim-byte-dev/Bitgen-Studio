# bitGen Studio - install the optional Electron shell (frameless Windows 11 look).
# Nothing else depends on this: without it, start.bat opens the studio in your
# default browser exactly as before.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # 2.591.0: misc\ -> the app folder
Set-Location $root

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "[electron] npm not found. Install Node.js from nodejs.org, then re-run." -ForegroundColor Yellow
  exit 1
}

Write-Host "[electron] fetching the package..."
# --no-save keeps it out of package.json, so the server's own dependency
# install stays small and this stays genuinely optional.
& npm install electron --no-save --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
  Write-Host "[electron] npm install FAILED - see the output above." -ForegroundColor Yellow
  exit 1
}

# The npm package is a small shim: the ~150 MB binary is fetched by its own
# install.js. Recent electron releases ship NO postinstall script, so npm
# "succeeds" in a couple of seconds having downloaded nothing, and the exe is
# never created. Run it ourselves rather than trusting npm's exit code.
$exe = $null
try { $exe = & node -e "try{process.stdout.write(require('electron'))}catch(e){}" } catch {}
if (-not $exe -or -not (Test-Path $exe)) {
  Write-Host "[electron] downloading the runtime (~150 MB, one time)..."
  & node "$root\node_modules\electron\install.js"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[electron] runtime download FAILED." -ForegroundColor Yellow
    Write-Host "           Usual causes: no network, a proxy, or GitHub blocked."
    Write-Host "           A proxy can be set with: setx HTTPS_PROXY http://host:port"
    exit 1
  }
  try { $exe = & node -e "try{process.stdout.write(require('electron'))}catch(e){}" } catch {}
}

if ($exe -and (Test-Path $exe)) {
  Write-Host "[electron] ready: $exe" -ForegroundColor Green
  Write-Host "[electron] start.bat will now open bitGen Studio as an app window."
  exit 0
}
Write-Host "[electron] the runtime is still missing after install." -ForegroundColor Yellow
Write-Host "           Try deleting node_modules\electron and running this again."
exit 1
