# bitGen Studio - first-time bootstrap for Windows (2.331.0).
#
# Tim: "create a windows 11 type installer for the package ... start using
# bitgen studio immediately after setup with no further action needed".
# bitGen-Studio-Setup.exe (installer\windows\bitgen-setup.nsi) copies the app
# and runs THIS. Everything goes INSIDE the app folder - no admin rights,
# nothing on the system PATH:
#
#   runtime\node     Node.js LTS (server + npm)
#   runtime\uv       uv (fetches Python)
#   runtime\python   a Python 3.12 environment - the app's python
#   runtime\git      MinGit, only when git is not installed
#   runtime\ffmpeg   ffmpeg + ffprobe, only when there is none on PATH
#   node_modules     express, multer, jsdom + Electron (the app window)
#
# then the Start-menu and desktop shortcuts (straight to the app window, no
# console) and .setup-pending, so the first start opens the setup wizard -
# ComfyUI, node packs, OmniVoice, models, GPU tuning - and then the studio.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File installer\bootstrap.ps1 [-NoShortcuts]
#
# Mirrors / tests: BITGEN_NODE_URL, BITGEN_UV_URL, BITGEN_GIT_URL, BITGEN_FFMPEG_URL,
# BITGEN_PY_VERSION (default 3.12).
param([switch]$NoShortcuts)

# Continue, not Stop: native tools write progress to stderr, which Windows
# PowerShell 5.1 turns into error records under a redirect (the NSIS log).
# Failures are checked explicitly.
$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"   # Invoke-WebRequest is 10x slower with the bar
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$rt = Join-Path $root "runtime"
New-Item -ItemType Directory -Force -Path $rt | Out-Null
Set-Location $root
$arm = ($env:PROCESSOR_ARCHITECTURE -eq "ARM64")

function Say($m) { Write-Host "[bitgen] $m" }
function Fail($m) { Write-Host "[bitgen] ERROR: $m"; exit 1 }

function Get-File($url, $out) {
    for ($i = 1; $i -le 3; $i++) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -Headers @{ "User-Agent" = "bitgen-setup" }
            if ((Test-Path $out) -and ((Get-Item $out).Length -gt 0)) { return $true }
        } catch { Say "download attempt $i failed: $($_.Exception.Message)" }
        Start-Sleep -Seconds (2 * $i)
    }
    return $false
}

# tar.exe ships with Windows 10 1803+ and is far faster than Expand-Archive
function Expand-Zip($zip, $dest) {
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    $tar = Join-Path $env:SystemRoot "System32\tar.exe"
    if (Test-Path $tar) {
        & $tar -xf $zip -C $dest 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { return }
    }
    Expand-Archive -Path $zip -DestinationPath $dest -Force
}

# unpack a zip whose content sits in ONE top folder into $dest itself
function Install-Zip($url, $dest, $label) {
    $zip = Join-Path $rt "$label.zip"
    Say "$label : $url"
    if (-not (Get-File $url $zip)) { return $false }
    $tmp = Join-Path $rt "_x_$label"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Zip $zip $tmp
    Remove-Item $zip -Force
    $items = @(Get-ChildItem $tmp)
    $src = $tmp
    if ($items.Count -eq 1 -and $items[0].PSIsContainer) { $src = $items[0].FullName }
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Move-Item $src $dest
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    return $true
}

function Find-Git {
    $g = Get-Command git -ErrorAction SilentlyContinue
    if ($g) { return $g.Source }
    foreach ($p in @("$env:ProgramFiles\Git\cmd\git.exe", "${env:ProgramFiles(x86)}\Git\cmd\git.exe",
                     "$env:LocalAppData\Programs\Git\cmd\git.exe", (Join-Path $rt "git\cmd\git.exe"))) {
        if ($p -and (Test-Path $p)) { return $p }
    }
    return $null
}

# ---- 1. Node.js ----------------------------------------------------------------
$node = Join-Path $rt "node\node.exe"
if (Test-Path $node) { Say "Node.js already in runtime\node" }
else {
    $url = $env:BITGEN_NODE_URL
    if (-not $url) {
        $plat = if ($arm) { "win-arm64" } else { "win-x64" }
        $ver = "v22.20.0"
        try {
            $idx = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
            $rel = $idx | Where-Object { $_.lts -and ($_.files -contains "$plat-zip") } | Select-Object -First 1
            if ($rel) { $ver = $rel.version }
        } catch { Say "nodejs.org index unavailable - using $ver" }
        $url = "https://nodejs.org/dist/$ver/node-$ver-$plat.zip"
    }
    if (-not (Install-Zip $url (Join-Path $rt "node") "node")) { Fail "could not download Node.js" }
}
$env:Path = (Join-Path $rt "node") + ";" + $env:Path
$npm = Join-Path $rt "node\npm.cmd"
Say ("node " + (& $node --version))

# ---- 2. Python 3.12 through uv -------------------------------------------------
$py = Join-Path $rt "python\Scripts\python.exe"
if (Test-Path $py) { Say "Python already in runtime\python" }
else {
    $uv = Join-Path $rt "uv\uv.exe"
    if (-not (Test-Path $uv)) {
        $t = if ($arm) { "aarch64-pc-windows-msvc" } else { "x86_64-pc-windows-msvc" }
        $url = $env:BITGEN_UV_URL
        if (-not $url) { $url = "https://github.com/astral-sh/uv/releases/latest/download/uv-$t.zip" }
        $zip = Join-Path $rt "uv.zip"
        Say "uv : $url"
        if (-not (Get-File $url $zip)) { Fail "could not download uv" }
        Expand-Zip $zip (Join-Path $rt "uv")
        Remove-Item $zip -Force
        # some uv zips hold a folder, some the bare exe
        if (-not (Test-Path $uv)) {
            $f = Get-ChildItem (Join-Path $rt "uv") -Recurse -Filter uv.exe | Select-Object -First 1
            if ($f) { Copy-Item $f.FullName $uv; Copy-Item (Join-Path $f.DirectoryName "uvx.exe") (Join-Path $rt "uv") -ErrorAction SilentlyContinue }
        }
    }
    $env:UV_PYTHON_INSTALL_DIR = Join-Path $rt "pythons"
    $pyv = if ($env:BITGEN_PY_VERSION) { $env:BITGEN_PY_VERSION } else { "3.12" }
    & $uv venv (Join-Path $rt "python") --python $pyv --seed 2>&1 | ForEach-Object { "$_" }
    if (-not (Test-Path $py)) { Fail "uv could not set up Python 3.12" }
}
Say (& $py --version 2>&1)

# ---- 3. git (ComfyUI and the node packs are git clones; zips are the fallback)
$git = Find-Git
if ($git) { Say "git: $git" }
else {
    $url = $env:BITGEN_GIT_URL
    if (-not $url) {
        try {
            $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/git-for-windows/git/releases/latest" -UseBasicParsing -Headers @{ "User-Agent" = "bitgen-setup" }
            $pat = if ($arm) { '^MinGit-[\d.]+(\.windows\.\d+)?-arm64\.zip$' } else { '^MinGit-[\d.]+(\.windows\.\d+)?-64-bit\.zip$' }
            $a = $rel.assets | Where-Object { $_.name -match $pat } | Select-Object -First 1
            if ($a) { $url = $a.browser_download_url }
        } catch { Say "GitHub API unavailable: $($_.Exception.Message)" }
    }
    if ($url) {
        $zip = Join-Path $rt "git.zip"
        Say "MinGit : $url"
        if (Get-File $url $zip) { Expand-Zip $zip (Join-Path $rt "git"); Remove-Item $zip -Force }
    }
    if (Test-Path (Join-Path $rt "git\cmd\git.exe")) { Say "git: runtime\git" }
    else { Say "WARNING: no git - ComfyUI and the node packs will be fetched as zips" }
}

# ---- 4. ffmpeg -------------------------------------------------------------------
$ff = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ff) { Say "ffmpeg: $($ff.Source)" }
elseif (Test-Path (Join-Path $rt "ffmpeg\bin\ffmpeg.exe")) { Say "ffmpeg already in runtime\ffmpeg" }
else {
    $url = $env:BITGEN_FFMPEG_URL
    if (-not $url) {
        $fa = if ($arm) { "winarm64" } else { "win64" }
        $url = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-$fa-gpl.zip"
    }
    if (-not (Install-Zip $url (Join-Path $rt "ffmpeg") "ffmpeg")) { Say "WARNING: no ffmpeg - video features need it (winget install ffmpeg)" }
}

# ---- 5. the Visual C++ runtime (PyTorch and ComfyUI need it) ----------------------
if (-not (Test-Path "$env:SystemRoot\System32\vcruntime140_1.dll")) {
    $vc = Join-Path $env:TEMP "vc_redist.x64.exe"
    Say "Microsoft Visual C++ Redistributable (Windows asks for permission once)"
    if (Get-File "https://aka.ms/vs/17/release/vc_redist.x64.exe" $vc) {
        $p = Start-Process -FilePath $vc -ArgumentList "/install", "/passive", "/norestart" -Verb RunAs -Wait -PassThru -ErrorAction SilentlyContinue
        if ($p) { Say "VC++ redistributable: exit $($p.ExitCode)" } else { Say "WARNING: VC++ redistributable was not installed" }
    }
}

# ---- 6. Node packages + the app window ---------------------------------------------
Say "npm install (express, multer, jsdom)"
& $npm install --no-audit --no-fund --loglevel=error 2>&1 | ForEach-Object { "$_" }
if (-not (Test-Path (Join-Path $root "node_modules\express"))) { Fail "npm install failed" }
Say "the app window (Electron, ~150 MB, one time)"
& $npm install electron --no-save --no-audit --no-fund --loglevel=error 2>&1 | ForEach-Object { "$_" }
$el = $null
try { $el = & $node -e "try{process.stdout.write(require('electron'))}catch(e){}" } catch {}
if (-not $el -or -not (Test-Path $el)) {
    & $node (Join-Path $root "node_modules\electron\install.js") 2>&1 | ForEach-Object { "$_" }
    try { $el = & $node -e "try{process.stdout.write(require('electron'))}catch(e){}" } catch {}
}
if ($el -and (Test-Path $el)) { Say "app window: $el" } else { $el = $null; Say "WARNING: Electron did not install - the shortcut opens start.bat (browser)" }

# ---- 7. Python packages for the app ------------------------------------------------
Say "pip install -r requirements.txt"
& $py -m pip install --upgrade --quiet -r (Join-Path $root "misc\requirements.txt") 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) { Say "WARNING: some Python packages did not install - see above" }

# ---- 8. settings: this python; the wizard opens on the first start ---------------
& $node (Join-Path $root "scripts\setup-cli.js") --bootstrap $py
if ($LASTEXITCODE -ne 0) { Fail "could not write the settings" }

# ---- 9. shortcuts: straight to the app window, no console -----------------------
if (-not $NoShortcuts) {
    $ws = New-Object -ComObject WScript.Shell
    $ico = Join-Path $root "installer\bitgen.ico"
    $places = @([Environment]::GetFolderPath("Programs"), [Environment]::GetFolderPath("Desktop"))
    foreach ($dir in $places) {
        if (-not $dir) { continue }
        $lnk = $ws.CreateShortcut((Join-Path $dir "bitGen Studio.lnk"))
        if ($el) { $lnk.TargetPath = $el; $lnk.Arguments = '"' + (Join-Path $root "electron") + '"' }
        else { $lnk.TargetPath = Join-Path $root "start.bat" }
        $lnk.WorkingDirectory = $root
        $lnk.IconLocation = "$ico,0"
        $lnk.Description = "bitGen Studio"
        $lnk.Save()
        Say "shortcut: $dir\bitGen Studio.lnk"
    }
}

Say "bootstrap done"
exit 0
