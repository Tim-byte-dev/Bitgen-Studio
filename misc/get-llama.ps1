# Downloads a llama.cpp Windows CUDA build (llama-server.exe) into
# <app>\llama-cpp\ — used by bitGen Studio's ✨ Enhance and the prompt chat.
#
#   powershell -ExecutionPolicy Bypass -File get-llama.ps1 [-Cuda 13|12] [-Tag b10456]
#
# 2.104.1: GitHub's /releases/latest for ggml-org/llama.cpp now points at the
# semver tag (v0.3.0, v0.2.x …), which is a RELEASE-NOTES tag with no binaries.
# The binaries are on the rolling bNNNNN builds. So this scans the recent
# releases and takes the newest one that actually carries a Windows x64 CUDA
# zip. CUDA 13 is preferred (RTX 50-series drivers ship CUDA 13; the cudart
# DLL pack is downloaded beside it so nothing else needs installing); -Cuda 12
# picks the 12.x build for older drivers. If the GitHub API is rate-limited
# (60/hour unauthenticated) it falls back to reading the releases web page.

param(
    [ValidateSet("13", "12")] [string] $Cuda = "13",
    [string] $Tag = ""
)

$ErrorActionPreference = "Stop"
$AppRoot = Split-Path -Parent $PSScriptRoot   # 2.591.0: this script is in misc\ - the app folder is its parent
$dest = Join-Path $AppRoot "llama-cpp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$hdr = @{ "User-Agent" = "bitgen-studio" }

function Pick-Assets($assets, $cudaMajor) {
    # llama-bNNNNN-bin-win-cuda-13.3-x64.zip  +  cudart-llama-bin-win-cuda-13.3-x64.zip
    $bin = $assets | Where-Object {
        $_.name -match "^llama-.*-bin-win-cuda-$cudaMajor\.\d+-x64\.zip$"
    } | Select-Object -First 1
    if (-not $bin) { return $null }
    $ver = [regex]::Match($bin.name, "cuda-(\d+\.\d+)-x64").Groups[1].Value
    $rt = $assets | Where-Object { $_.name -eq "cudart-llama-bin-win-cuda-$ver-x64.zip" } | Select-Object -First 1
    return @{ bin = $bin; cudart = $rt; ver = $ver }
}

$picked = $null
$relTag = ""
try {
    if ($Tag) {
        Write-Host "Fetching release $Tag..."
        $rels = @(Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/$Tag" -Headers $hdr)
    } else {
        Write-Host "Scanning recent llama.cpp releases for a Windows CUDA $Cuda build..."
        $rels = Invoke-RestMethod -Uri "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=30" -Headers $hdr
    }
    foreach ($r in $rels) {
        if ($r.draft) { continue }
        $p = Pick-Assets $r.assets $Cuda
        if (-not $p -and $Cuda -eq "13") { $p = Pick-Assets $r.assets "12" }
        if ($p) { $picked = $p; $relTag = $r.tag_name; break }
    }
} catch {
    Write-Host "GitHub API unavailable ($($_.Exception.Message)) - reading the releases page instead..."
}

if (-not $picked) {
    # Fallback: the HTML page links the assets directly; take the newest build.
    $html = (Invoke-WebRequest -Uri "https://github.com/ggml-org/llama.cpp/releases" -Headers $hdr -UseBasicParsing).Content
    $pat = "/ggml-org/llama\.cpp/releases/download/(b\d+)/llama-\1-bin-win-cuda-($Cuda\.\d+)-x64\.zip"
    $m = [regex]::Match($html, $pat)
    if (-not $m.Success -and $Cuda -eq "13") { $m = [regex]::Match($html, $pat.Replace("($Cuda\.", "(12\.")) }
    if ($m.Success) {
        $relTag = $m.Groups[1].Value; $ver = $m.Groups[2].Value
        $base = "https://github.com/ggml-org/llama.cpp/releases/download/$relTag"
        $picked = @{
            bin    = @{ name = "llama-$relTag-bin-win-cuda-$ver-x64.zip"; browser_download_url = "$base/llama-$relTag-bin-win-cuda-$ver-x64.zip"; size = 0 }
            cudart = @{ name = "cudart-llama-bin-win-cuda-$ver-x64.zip";  browser_download_url = "$base/cudart-llama-bin-win-cuda-$ver-x64.zip";  size = 0 }
            ver    = $ver
        }
    }
}

if (-not $picked) {
    Write-Host "[ERROR] No Windows x64 CUDA build found in the recent llama.cpp releases." -ForegroundColor Red
    Write-Host "Grab llama-bNNNNN-bin-win-cuda-1x.x-x64.zip (and the matching cudart zip) from"
    Write-Host "https://github.com/ggml-org/llama.cpp/releases and unzip both into: $dest"
    exit 1
}
Write-Host "Using $relTag - $($picked.bin.name) (CUDA $($picked.ver))"

function Get-Zip($asset) {
    $out = Join-Path $env:TEMP $asset.name
    $mb = if ($asset.size) { " ($([math]::Round($asset.size/1MB)) MB)" } else { "" }
    Write-Host "Downloading $($asset.name)$mb..."
    & curl.exe -L --retry 3 -o $out $asset.browser_download_url
    if ($LASTEXITCODE -ne 0) { Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $out -UseBasicParsing }
    Expand-Archive -Path $out -DestinationPath $dest -Force
    Remove-Item $out
}
Get-Zip $picked.bin
if ($picked.cudart) { Get-Zip $picked.cudart }

$srv = Get-ChildItem $dest -Recurse -Filter "llama-server.exe" | Select-Object -First 1
if (-not $srv) {
    Write-Host "[ERROR] llama-server.exe not found after extraction." -ForegroundColor Red
    exit 1
}
if ($srv.DirectoryName -ne $dest) {
    Get-ChildItem $srv.DirectoryName | Move-Item -Destination $dest -Force
}
Set-Content -Path (Join-Path $dest "VERSION.txt") -Value "$relTag cuda-$($picked.ver)"

Write-Host ""
Write-Host "Done. llama-server is at: $(Join-Path $dest 'llama-server.exe')  [$relTag, CUDA $($picked.ver)]" -ForegroundColor Green
Write-Host "Drop LLM .gguf files into llm-models\ and they appear in the dropdown under the prompt."
