# Installs the OFFICIAL YuE2 music-generation pipeline (2.229.0, Tim: "can
# we add this to our music docker, use dropdown to change from minimax to
# yue2") into its own Python venv at <app>\yue2\.venv — the same
# self-contained pattern as get-llama.ps1 / get-sd-cli.ps1: no global
# installs, nothing outside this folder.
#
#   powershell -ExecutionPolicy Bypass -File get-yue2.ps1 [-Tag yue2-v0.1.6]
#
# PINNED to release tag yue2-v0.1.6 (the same commit-pinning rule as the
# RefMod pack): the repo moves fast, and an unpinned install is a different
# program every month. Pass -Tag to move the pin deliberately.
#
# Requirements (the upstream README's own words): Python 3.12, an NVIDIA
# GPU with BF16 support and ~24 GB VRAM. Model files (m-a-p/YuE2-3B, the
# vocoder) download from Hugging Face on FIRST generation — the first song
# needs the network; later runs are offline-capable. Output is 48 kHz
# stereo FLAC.

param(
    [string] $Tag = "yue2-v0.1.6"
)

$ErrorActionPreference = "Stop"
$dest = Join-Path $PSScriptRoot "yue2"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$venv = Join-Path $dest ".venv"

# ---- Python 3.12 -----------------------------------------------------------
$py = $null
foreach ($cand in @("py -3.12", "python3.12", "python")) {
    try {
        $v = & $cand.Split(" ")[0] $cand.Split(" ")[1..99] --version 2>&1
        if ("$v" -match "3\.12\.") { $py = $cand; break }
    } catch { }
}
if (-not $py) {
    Write-Host "Python 3.12 is required (the upstream pipeline pins it)." -ForegroundColor Red
    Write-Host "Install it from https://www.python.org/downloads/ (tick 'py launcher') and re-run."
    exit 1
}
Write-Host "Python 3.12 found: $py"

# ---- the venv --------------------------------------------------------------
if (-not (Test-Path (Join-Path $venv "Scripts\python.exe"))) {
    Write-Host "Creating venv: $venv"
    & $py.Split(" ")[0] $py.Split(" ")[1..99] -m venv $venv
}
$vpy = Join-Path $venv "Scripts\python.exe"

# ---- the pinned pipeline ---------------------------------------------------
Write-Host "Installing YuE2 @ $Tag (this compiles nothing but downloads a lot)..."
& $vpy -m pip install --upgrade pip
& $vpy -m pip install "git+https://github.com/multimodal-art-projection/YuE@$Tag"
if ($LASTEXITCODE -ne 0) {
    Write-Host "pip install failed - see above. The pin was: $Tag" -ForegroundColor Red
    exit 1
}

$cli = Join-Path $venv "Scripts\yue2.exe"
if (Test-Path $cli) {
    Write-Host ""
    Write-Host "YuE2 installed: $cli" -ForegroundColor Green
    Write-Host "Pick the 'YuE2' style in the music docker's dropdown and press"
    Write-Host "Generate Music. The FIRST song downloads m-a-p/YuE2-3B from"
    Write-Host "Hugging Face (tens of GB - one time); needs BF16 + ~24 GB VRAM."
} else {
    Write-Host "Installed, but $cli was not created - 'python -m yue2' may still work; re-run this script or report the pip log." -ForegroundColor Yellow
}
