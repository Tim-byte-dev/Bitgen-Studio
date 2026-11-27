# bitGen Studio - put a flat CORE delivery back into its folders (2.992.0; Windows twin of scripts/unflatten.py).
# Run in the folder where the flat zip was unzipped:  powershell -ExecutionPolicy Bypass -File misc__unflatten.ps1
# Reads _MANIFEST.txt's "<flat name>  <-  <path>" lines; a path that would leave this folder is refused.
$ErrorActionPreference = "Continue"
$here = (Get-Location).Path
$man = Join-Path $here "_MANIFEST.txt"
if (-not (Test-Path $man)) { Write-Host "no _MANIFEST.txt here - run this in the folder where the flat zip was unzipped"; exit 1 }
$moved = 0; $kept = 0; $missing = 0
foreach ($line in Get-Content -LiteralPath $man -Encoding UTF8) {
  $i = $line.IndexOf("  <-  ")
  if ($i -lt 0) { continue }
  $flat = $line.Substring(0, $i).Trim(); $path = $line.Substring($i + 6).Trim()
  if ($flat -eq $path) { $kept++; continue }
  $dst = [System.IO.Path]::GetFullPath((Join-Path $here $path))
  if (-not $dst.StartsWith($here + [System.IO.Path]::DirectorySeparatorChar)) { Write-Host "refused (outside this folder): $path"; exit 1 }
  $src = Join-Path $here $flat
  if (-not (Test-Path -LiteralPath $src)) { $missing++; continue }
  $dir = Split-Path -Parent $dst
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Move-Item -LiteralPath $src -Destination $dst -Force
  $moved++
}
Write-Host "moved $moved files; $kept already in place; $missing not here"
