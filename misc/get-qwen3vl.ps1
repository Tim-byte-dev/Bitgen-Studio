# Downloads the VISION model for "pictures in the prompt" (2.233.0, Tim
# verbatim: "upload a picture or pictures into the prompt and have a te like
# Qwen3-VL-8B-NSFW-Caption-V4-GGUF describe the pictures to the llm") into
# <app>\qwen3vl\ — model + mmproj projector. NO venv, NO new binaries: the
# vision model rides the EXISTING llama.cpp from get-llama.ps1
# (llama-server -m model.gguf --mmproj mmproj.gguf).
#
#   powershell -ExecutionPolicy Bypass -File get-qwen3vl.ps1 [-Quant Q4_K_M]
#              [-Mmproj mmproj-f16] [-Token hf_xxx]
#
# PINNED quant Q4_K_M by default (~5 GB) + the mmproj (~1 GB) — about 6 GB
# total. The mmproj file is MANDATORY: without it llama-server loads the
# model text-only and it cannot see; bitGen's Vision dropdown refuses to
# list a model whose projector is missing, for exactly that reason.
#
# THE NSFW GATE: this repo may require a logged-in Hugging Face session for
# downloads. If the anonymous pull answers 401/403, pass -Token with a token
# from https://huggingface.co/settings/tokens, or download the two files in
# your browser (logged in) and drop them into <app>\qwen3vl\ yourself —
# credentials are NEVER embedded in this script.
#
# EAP is Continue on purpose (the 2.222.1 lesson): under Windows PowerShell
# 5.1 an EAP of Stop turns a native command's redirected stderr progress
# into a terminating error record. Failures are checked explicitly instead.

param(
    [string] $Repo   = "mradermacher/Qwen3-VL-8B-NSFW-Caption-V4-GGUF",
    [string] $Quant  = "Q4_K_M",
    [string] $Mmproj = "mmproj-f16",
    [string] $Token  = ""
)

$ErrorActionPreference = "Continue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$AppRoot = Split-Path -Parent $PSScriptRoot   # 2.591.0: this script is in misc\ - the app folder is its parent
$dest = Join-Path $AppRoot "qwen3vl"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$stem  = ($Repo -split "/")[-1] -replace "-GGUF$", ""
$model = "$stem.$Quant.gguf"
$mmp   = "$stem.$Mmproj.gguf"
$base  = "https://huggingface.co/$Repo/resolve/main"
$hdr   = @{}
if ($Token) { $hdr["Authorization"] = "Bearer $Token" }

function Get-One([string] $name) {
    $out = Join-Path $dest $name
    if (Test-Path $out) { Write-Host "already here: $name"; return $true }
    Write-Host "downloading $name ..."
    try {
        Invoke-WebRequest -Uri "$base/$name" -OutFile "$out.part" -Headers $hdr -UseBasicParsing
    } catch {
        $code = ""
        try { $code = [int]$_.Exception.Response.StatusCode } catch { }
        Remove-Item "$out.part" -ErrorAction SilentlyContinue
        if ($code -eq 401 -or $code -eq 403) {
            Write-Host "BLOCKED ($code): the repo's gate refused the anonymous pull."
            Write-Host "  Fix: rerun with -Token hf_xxx (huggingface.co/settings/tokens),"
            Write-Host "  or download $name in your logged-in browser from"
            Write-Host "  https://huggingface.co/$Repo/tree/main and drop it into $dest"
        } elseif ($code -eq 404) {
            Write-Host "NOT FOUND (404): $name is not in the repo under that exact name."
            Write-Host "  Check the real filenames at https://huggingface.co/$Repo/tree/main"
            Write-Host "  and rerun with -Quant / -Mmproj matching them (this script builds"
            Write-Host "  names as <repo-stem>.<Quant>.gguf and <repo-stem>.<Mmproj>.gguf)."
        } else {
            Write-Host "download failed: $($_.Exception.Message)"
        }
        return $false
    }
    Move-Item -Force "$out.part" $out
    Write-Host "ok: $name"
    return $true
}

$okModel = Get-One $model
$okMmp   = Get-One $mmp
if (-not ($okModel -and $okMmp)) {
    Write-Host ""
    Write-Host "INCOMPLETE — the vision pair is model + mmproj TOGETHER."
    Write-Host "bitGen will not list a model without its projector (it cannot see)."
    exit 1
}

Write-Host ""
Write-Host "done. $dest now holds:"
Write-Host "  $model   (the vision model, quant $Quant)"
Write-Host "  $mmp   (the projector — mandatory)"
Write-Host "Pick it in the Prompt dock's Vision dropdown; it starts on demand on"
Write-Host "port 8199 and stops after 5 idle minutes (config captioner.keep=true"
Write-Host "holds it warm). Together with a large chat LLM this pair wants"
Write-Host "roughly 24 GB+ of VRAM — start-on-demand is the safe shape."
exit 0
