# bitGen Studio - installer/tone.ps1 (2.634.0): THE WINDOWS BOOTSTRAP'S COLOURS (dot-sourced by bootstrap.ps1).
# Tim: "in the setup file report completed in green, currently installing in a lighter green, warnings in orange and errors
# in red. when waiting installing, let the user know so they don't think the setup stalled"
#   Tone LINE -> ok | run | warn | err | "" : "[ok] ..." / "... done" green, "[..] ..." / "     ..." light green,
#   "WARNING ..." orange, "ERROR ..." red.
#   Say LINE  -> "[bitgen] LINE" in its colour: 256-colour VT codes on a terminal that takes them, else the console's own
#   colours (Green / DarkGreen / DarkYellow / Red); plain when the output goes to a log (the NSIS installer's window).
#   NO_COLOR=1 turns the colours off. ASCII only (Windows PowerShell 5.1 reads this file as the ANSI code page).
$script:ToneEsc = [char]27
$script:ToneVT = $false
$script:ToneOn = -not $env:NO_COLOR
try { if ([Console]::IsOutputRedirected) { $script:ToneOn = $false } } catch { }
try { if ($script:ToneOn -and $Host.UI.SupportsVirtualTerminal) { $script:ToneVT = $true } } catch { }

function Tone($m) {
    $s = [string]$m
    if ($s -match '^\s*(\[ok\]|\[done\])' -or $s -match ' done$') { return "ok" }
    if ($s -match '^\s*(\[\.\.\]|\s{4})') { return "run" }
    if ($s -match '^\s*(WARNING|\[warn\])') { return "warn" }
    if ($s -match '^\s*(ERROR|\[error\])') { return "err" }
    return ""
}

function Say($m) {
    $line = "[bitgen] $m"
    $t = Tone $m
    if (-not $script:ToneOn -or -not $t) { Write-Host $line; return }
    if ($script:ToneVT) {
        $c = @{ ok = "38;5;40"; run = "38;5;157"; warn = "38;5;208"; err = "38;5;196" }[$t]
        Write-Host ("$($script:ToneEsc)[$($c)m$line$($script:ToneEsc)[0m")
    } else {
        $c = @{ ok = "DarkGreen"; run = "Green"; warn = "DarkYellow"; err = "Red" }[$t]
        Write-Host $line -ForegroundColor $c
    }
}

function Fail($m) { Say "ERROR: $m"; exit 1 }
