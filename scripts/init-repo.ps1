# init-repo.ps1 - put bitGen Studio on GitHub (2.123.0).
#
# Run this from the project root on the machine that has the code:
#
#     powershell -ExecutionPolicy Bypass -File scripts\init-repo.ps1 -Name bitgen-studio -Private
#
# WHAT IT DOES, in order, stopping at the first thing that looks wrong:
#   1. checks git is installed and that this really is the project root
#   2. runs scripts/check-gitignore.sh so a commit cannot carry model weights,
#      your projects folder or custom.settings
#   3. git init (if needed), stages, and shows you WHAT IT IS ABOUT TO COMMIT
#      before it commits anything
#   4. creates the GitHub repo with the `gh` CLI and pushes - or, if `gh` is not
#      installed, prints the two commands to finish by hand
#
# IT NEVER FORCE-PUSHES and never touches an existing remote called `origin`.
# If this is already a repo with a remote, it stops and says so: quietly
# rewriting somebody's remote is not a thing an "init" script gets to do.

param(
  [string]$Name = "bitgen-studio",
  [string]$Description = "bitGen Studio - a local, self-hosted studio for video, image, audio and speech generation on Windows, driving ComfyUI.",
  [switch]$Private,
  [switch]$Public
)

$ErrorActionPreference = "Stop"
function Fail($m) { Write-Host "`n  $m`n" -ForegroundColor Red; exit 1 }
function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }

# --- 1. sanity -------------------------------------------------------------
Set-Location (Join-Path $PSScriptRoot "..")
if (-not (Test-Path "package.json")) { Fail "run this from the bitGen Studio project root" }
if (-not (Test-Path "server.js"))    { Fail "this does not look like the project root (no server.js)" }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Fail "git is not installed. Get it from https://git-scm.com/download/win and run this again."
}
$ver = (node -p "require('./package.json').version")
Write-Host "bitGen Studio v$ver"

# --- 2. the ignore list must be right BEFORE anything is staged ------------
Step "checking .gitignore"
if (-not (Test-Path ".gitignore")) { Fail ".gitignore is missing - do not commit without it" }
$bash = Get-Command bash -ErrorAction SilentlyContinue
if ($bash) {
  & bash scripts/check-gitignore.sh
  if ($LASTEXITCODE -ne 0) { Fail ".gitignore and make_zips.sh disagree - fix that first" }
} else {
  Write-Host "  (no bash on PATH - skipping the drift check; Git for Windows ships one)" -ForegroundColor Yellow
}

# --- 3. init and stage -----------------------------------------------------
if (Test-Path ".git") {
  Step "this is already a git repository"
  $remote = (git remote 2>$null)
  if ($remote) { Fail "it already has a remote ($remote). Push it yourself; this script will not rewrite it." }
} else {
  Step "git init"
  git init -b main | Out-Null
}

Step "staging"
git add -A
$staged = (git diff --cached --name-only)
if (-not $staged) { Fail "nothing to commit" }
$count = ($staged -split "`n").Count
$bytes = 0
foreach ($f in $staged) { if (Test-Path $f) { $bytes += (Get-Item $f).Length } }
$mb = [math]::Round($bytes / 1MB, 1)
Write-Host "  $count files, $mb MB"

# A repo this size means something big slipped past .gitignore. Say so and stop
# rather than pushing 40GB of weights to somebody's account.
if ($mb -gt 200) {
  git diff --cached --name-only | ForEach-Object {
    if ((Test-Path $_) -and ((Get-Item $_).Length -gt 20MB)) { Write-Host "  LARGE: $_" -ForegroundColor Yellow }
  }
  Fail "$mb MB staged - that is far too big. Something is not being ignored (see LARGE above)."
}
Write-Host "`n  About to commit these top-level entries:" -ForegroundColor Cyan
git diff --cached --name-only | ForEach-Object { ($_ -split "/")[0] } | Sort-Object -Unique | ForEach-Object { Write-Host "    $_" }
$ok = Read-Host "`n  Commit and continue? (y/N)"
if ($ok -ne "y") { Write-Host "  stopped; nothing was committed (files are still staged)"; exit 0 }

git commit -m "bitGen Studio v$ver" | Out-Null
Write-Host "  committed"

# --- 4. create and push ----------------------------------------------------
$vis = if ($Public) { "--public" } elseif ($Private) { "--private" } else { "--private" }
if (Get-Command gh -ErrorAction SilentlyContinue) {
  Step "creating the GitHub repo with gh"
  gh repo create $Name $vis --source=. --remote=origin --description $Description --push
  if ($LASTEXITCODE -ne 0) { Fail "gh could not create the repo (are you logged in? run: gh auth login)" }
  Write-Host "`n  done" -ForegroundColor Green
  gh repo view --web
} else {
  Step "gh is not installed - two commands left"
  Write-Host @"
  The commit is made. To finish:

    1. Create an empty repo at https://github.com/new
       Name: $Name
       Do NOT add a README, .gitignore or licence - this repo already has them.

    2. Then run:

       git remote add origin https://github.com/<you>/$Name.git
       git push -u origin main

  Or install the GitHub CLI (https://cli.github.com), run 'gh auth login',
  and run this script again - it will do both steps for you.
"@
}
