# Downloads the latest stable-diffusion.cpp Windows CUDA build (sd-cli.exe)
# into <app>\sd-cpp\ — where bitGen Studio's default config already points.
#
#   powershell -ExecutionPolicy Bypass -File get-sd-cli.ps1
#
# Robustness notes: forces TLS 1.2 (old PS defaults break GitHub), and if the
# GitHub API is rate-limited (60 req/hr unauthenticated) it falls back to
# resolving the release tag from the /releases/latest redirect and building
# the well-known asset names from it — no API needed.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$repo = "leejet/stable-diffusion.cpp"
$dest = Join-Path $PSScriptRoot "sd-cpp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$binUrl = $null; $cudartUrl = $null; $binName = $null; $cudartName = $null

Write-Host "Querying latest $repo release..."
try {
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" `
                             -Headers @{ "User-Agent" = "bitgen-studio" }
    Write-Host "Latest release: $($rel.tag_name)"
    $bin = $rel.assets | Where-Object {
        $_.name -match "win" -and $_.name -match "x64" -and
        $_.name -match "cuda|cu\d" -and $_.name -notmatch "cudart" -and
        $_.name -like "*.zip"
    } | Sort-Object { $_.name -match "cuda12|cu12" } -Descending | Select-Object -First 1
    $cud = $rel.assets | Where-Object {
        $_.name -match "cudart" -and $_.name -match "x64" -and $_.name -like "*.zip"
    } | Select-Object -First 1
    if ($bin) { $binUrl = $bin.browser_download_url; $binName = $bin.name }
    if ($cud) { $cudartUrl = $cud.browser_download_url; $cudartName = $cud.name }
} catch {
    Write-Host "[warn] GitHub API unavailable ($($_.Exception.Message))" -ForegroundColor Yellow
    Write-Host "       Falling back to the release-page redirect (no API)..."
}

if (-not $binUrl) {
    # API-free path: /releases/latest 302-redirects to /releases/tag/<tag>;
    # asset names follow a stable pattern containing the tag's short hash.
    $tag = $null
    try {
        $resp = [System.Net.WebRequest]::Create("https://github.com/$repo/releases/latest")
        $resp.AllowAutoRedirect = $false
        $resp.UserAgent = "bitgen-studio"
        $r = $resp.GetResponse()
        $loc = $r.Headers["Location"]; $r.Close()
        if ($loc) { $tag = ($loc -split "/")[-1] }
    } catch {}
    if (-not $tag) {
        Write-Host "[ERROR] Could not resolve the latest release." -ForegroundColor Red
        Write-Host "Open https://github.com/$repo/releases and download manually:"
        Write-Host "  1) sd-master-<hash>-bin-win-cuda12-x64.zip"
        Write-Host "  2) cudart-sd-bin-win-cu12-x64.zip"
        Write-Host "Extract BOTH into: $dest  (so sd-cli.exe sits directly in it)"
        exit 1
    }
    $hash = ($tag -split "-")[-1]
    $binName    = "sd-master-$hash-bin-win-cuda12-x64.zip"
    $cudartName = "cudart-sd-bin-win-cu12-x64.zip"
    $binUrl     = "https://github.com/$repo/releases/download/$tag/$binName"
    $cudartUrl  = "https://github.com/$repo/releases/download/$tag/$cudartName"
    Write-Host "Latest release: $tag (via redirect)"
}

function Get-Zip($name, $url) {
    $out = Join-Path $env:TEMP $name
    Write-Host "Downloading $name ..."
    & curl.exe -L --retry 3 -o $out $url
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out)) {
        Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing `
                          -Headers @{ "User-Agent" = "bitgen-studio" }
    }
    Write-Host "Extracting $name ..."
    Expand-Archive -Path $out -DestinationPath $dest -Force
    Remove-Item $out
}

Get-Zip $binName $binUrl
if ($cudartUrl) {
    try { Get-Zip $cudartName $cudartUrl }
    catch { Write-Host "[warn] cudart zip failed — fine if the CUDA toolkit is installed system-wide." -ForegroundColor Yellow }
}

# Zips sometimes nest files in a subfolder — flatten so sd-cli.exe sits in sd-cpp\
$cli = Get-ChildItem $dest -Recurse -Filter "sd-cli.exe" | Select-Object -First 1
if (-not $cli) {
    Write-Host "[ERROR] sd-cli.exe not found after extraction. Contents of ${dest}:" -ForegroundColor Red
    Get-ChildItem $dest -Recurse | Select-Object -ExpandProperty FullName
    exit 1
}
if ($cli.DirectoryName -ne $dest) {
    Get-ChildItem $cli.DirectoryName | Move-Item -Destination $dest -Force
}

Write-Host ""
Write-Host "Done. sd-cli is at: $(Join-Path $dest 'sd-cli.exe')" -ForegroundColor Green
Write-Host "bitGen Studio's default config already points there."
& (Join-Path $dest "sd-cli.exe") --version 2>$null
exit 0
