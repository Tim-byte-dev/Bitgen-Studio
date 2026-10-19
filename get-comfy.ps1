# Installs ComfyUI into <app>\comfy\ WITH GIT (2.221.0, by instruction:
# "check if git is installed ... use git to pull comfyui install,
# https://github.com/comfy-org/comfyui and comfyui manager node,
# https://github.com/comfy-org/ComfyUI-Manager"):
#
#   comfy\ComfyUI\            git clone of comfy-org/comfyui
#   comfy\ComfyUI\venv\       its OWN python env - torch CUDA + requirements
#   comfy\ComfyUI\run.bat     venv python + main.py (what the app launches;
#                             layout #1 in lib/comfy.js detectLaunch, so the
#                             SYSTEM-python launch that died on
#                             "No module named 'sqlalchemy'" cannot recur)
#   custom_nodes\             ComfyUI-Manager + every pack the app needs
#                             (the list comes from lib/comfy.js requiredNodes()
#                             through node -e - ONE source of truth)
#
# Every step is an idempotent ENSURE: re-running repairs a half-install (a
# clone without a venv - exactly the sqlalchemy failure - gets its venv,
# deps, run.bat and nodes added). Consent to install git itself lives in
# start.bat / the setup window; this script only USES git, and if it is
# missing (checking PATH and the well-known %ProgramFiles%\Git fallback,
# because a just-winget-installed git is not on THIS process's stale PATH)
# it exits 2 with instructions instead of guessing.
#
#   powershell -ExecutionPolicy Bypass -File get-comfy.ps1

param([string]$Dest = "")

# 2.222.1 FIELD FIX ("comfy is not installing, i can't see the log"):
# ErrorActionPreference MUST be Continue here. This script runs with its
# stderr REDIRECTED (the setup window pipes it), and under Windows
# PowerShell 5.1 a native command writing to a redirected stderr — which
# git clone does for ordinary PROGRESS — becomes an error record; with
# EAP=Stop the script died on git's first progress line, before anything
# installed. Failure detection is explicit $LASTEXITCODE checks instead,
# and native stderr is merged into stdout (2>&1) so progress reads as
# progress.
$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# the clone URL and install steps follow the OFFICIAL manual install:
# https://docs.comfy.org/installation/manual_install (venv here instead of
# the docs' conda — same isolation requirement, no extra dependency)
$comfyRepo = "https://github.com/Comfy-Org/ComfyUI.git"
# the CHOSEN install folder (setup window passes -Dest); default comfy\
if (-not $Dest) { $Dest = Join-Path $PSScriptRoot "comfy" }
$dest = $Dest
$cui  = Join-Path $dest "ComfyUI"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Remove-Item (Join-Path $dest ".declined") -ErrorAction SilentlyContinue

# ---- git: PATH first, then the well-known install locations ----
function Find-Git {
    $g = Get-Command git -ErrorAction SilentlyContinue
    if ($g) { return $g.Source }
    foreach ($p in @("$env:ProgramFiles\Git\cmd\git.exe",
                     "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
                     "$env:LocalAppData\Programs\Git\cmd\git.exe")) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}
$git = Find-Git
if (-not $git) {
    Write-Host "[ERROR] git is not installed - ComfyUI is installed by git clone." -ForegroundColor Red
    Write-Host "        start.bat and the setup window offer to install it (winget"
    Write-Host "        install --id Git.Git), or get it from https://git-scm.com -"
    Write-Host "        then run this script again."
    exit 2
}
Write-Host "[ok] git: $git"

# the manual-install docs warn Windows needs the MSVC redistributable
if (-not (Test-Path "$env:SystemRoot\System32\vcruntime140.dll")) {
    Write-Host "[warn] Microsoft Visual C++ Redistributable not found - ComfyUI" -ForegroundColor Yellow
    Write-Host "       may fail to start. Install it from:"
    Write-Host "       https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist"
}

# ---- python for the venv ----
$py = $null
foreach ($c in @(@("py", "-3"), @("python"))) {
    $cmd = Get-Command $c[0] -ErrorAction SilentlyContinue
    if ($cmd) { $py = $c; break }
}
if (-not $py) {
    Write-Host "[ERROR] Python 3.10+ is required (python.org, tick 'Add to PATH')." -ForegroundColor Red
    exit 2
}

# ---- 1. the clone (ensure) ----
if (Test-Path (Join-Path $cui "main.py")) {
    Write-Host "[ok] ComfyUI already cloned in comfy\ComfyUI - keeping it as is."
} else {
    Write-Host "[..] git clone $comfyRepo (~1 GB with history depth 1)..."
    & $git clone --depth 1 $comfyRepo $cui 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $cui "main.py"))) {
        Write-Host "[ERROR] clone failed - see git's output above." -ForegroundColor Red
        exit 1
    }
}

# ---- 2. the venv (ensure) - ComfyUI's deps NEVER go into system python ----
$venvPy = Join-Path $cui "venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
    Write-Host "[..] creating the venv (ComfyUI\venv)..."
    # ($py[1..N] on a ONE-element array is $null in PowerShell - branch instead)
    if ($py.Length -gt 1) { & $py[0] $py[1] -m venv (Join-Path $cui "venv") 2>&1 | ForEach-Object { "$_" } }
    else { & $py[0] -m venv (Join-Path $cui "venv") 2>&1 | ForEach-Object { "$_" } }
    if (-not (Test-Path $venvPy)) {
        Write-Host "[ERROR] venv creation failed." -ForegroundColor Red
        exit 1
    }
}
& $venvPy -m pip install --upgrade pip --quiet 2>&1 | ForEach-Object { "$_" }

# ---- 3. torch CUDA into the venv (ensure; ~3 GB the first time) ----
& $venvPy -c "import torch" 2>&1 | Out-Null
$hasTorch = ($LASTEXITCODE -eq 0)
if ($hasTorch) {
    Write-Host "[ok] torch already in the venv."
} else {
    # the documented Nvidia command, verbatim tag first (cu130), older CUDA
    # indexes as fallbacks: pip install torch torchvision torchaudio
    #   --extra-index-url https://download.pytorch.org/whl/cu130
    $done = $false
    foreach ($cu in @("cu130", "cu128", "cu126")) {
        Write-Host "[..] installing torch ($cu wheel index, ~3 GB)..."
        & $venvPy -m pip install torch torchvision torchaudio --extra-index-url "https://download.pytorch.org/whl/$cu" 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -eq 0) { $done = $true; break }
        Write-Host "[warn] $cu index refused this python/driver - trying the next" -ForegroundColor Yellow
    }
    if (-not $done) {
        Write-Host "[ERROR] no torch installed - check your NVIDIA driver, then re-run." -ForegroundColor Red
        exit 1
    }
    # --extra-index-url also consults PyPI, whose Windows torch is CPU-only -
    # verify a CUDA build actually landed and say so loudly if not
    $tv = & $venvPy -c "import torch; print(torch.__version__)" 2>&1
    if ("$tv" -notmatch "\+cu") {
        Write-Host "[warn] torch $tv looks CPU-only (no +cu tag) - generation would" -ForegroundColor Yellow
        Write-Host "       run on CPU. Check your NVIDIA driver and re-run setup."
    } else {
        Write-Host "[ok] torch $tv (CUDA build)"
    }
}

# ---- 4. ComfyUI requirements into the venv (ensure) ----
Write-Host "[..] pip install -r requirements.txt (into the venv)..."
& $venvPy -m pip install -r (Join-Path $cui "requirements.txt") 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] ComfyUI requirements failed - see pip's output above." -ForegroundColor Red
    exit 1
}

# ---- 5. the node packs the app needs (ensure; list from lib/comfy.js) ----
$nodesDir = Join-Path $cui "custom_nodes"
New-Item -ItemType Directory -Force -Path $nodesDir | Out-Null
$nodes = & node -e "console.log(JSON.stringify(require('./lib/comfy').requiredNodes()))" | ConvertFrom-Json
foreach ($n in $nodes) {
    $nd = Join-Path $nodesDir $n.folder
    if (Test-Path $nd) { Write-Host "[ok] node pack $($n.folder) already there."; continue }
    Write-Host "[..] git clone $($n.url)..."
    if ($n.subdir) {
        # 2.331.0: a pack that lives in a folder INSIDE its repo - clone aside, copy the folder
        $tmp = Join-Path $env:TEMP ("bgpack-" + [guid]::NewGuid().ToString("N"))
        & $git clone --depth 1 $n.url $tmp 2>&1 | ForEach-Object { "$_" }
        $src = Join-Path $tmp ($n.subdir -replace "/", "\")
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $src)) { Write-Host "[warn] $($n.folder) clone failed - install it later from Settings" -ForegroundColor Yellow; continue }
        Copy-Item -Recurse $src $nd
        Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    } else {
        & $git clone --depth 1 $n.url $nd 2>&1 | ForEach-Object { "$_" }
        if ($LASTEXITCODE -ne 0) { Write-Host "[warn] $($n.folder) clone failed - install it later from Settings" -ForegroundColor Yellow; continue }
    }
    $req = Join-Path $nd "requirements.txt"
    if (Test-Path $req) { & $venvPy -m pip install -r $req 2>&1 | ForEach-Object { "$_" } }
}

# ---- 6. run.bat: THE launch the app picks first (venv python, never system) ----
$runBat = Join-Path $cui "run.bat"
@("@echo off", "cd /d %~dp0", "venv\Scripts\python.exe -s main.py %*") | Set-Content -Path $runBat -Encoding ascii
Write-Host "[ok] wrote comfy\ComfyUI\run.bat (venv python + main.py)"

# ---- 7. adopt into Settings (lib/comfy.js writes the custom.settings diff) ----
$adopt = & node -e "console.log(JSON.stringify(require('./lib/comfy').adoptInstall(undefined, process.argv[1])))" $dest
Write-Host "[ok] settings: $adopt"

Write-Host ""
Write-Host "[ok] ComfyUI is installed in comfy\ComfyUI with its own venv, run.bat,"
Write-Host "     ComfyUI-Manager and the app's node packs. Settings > ComfyUI now"
Write-Host "     points at it (unless a folder was already configured), and"
Write-Host "     ComfyUI is set to START WITH THE APP."
