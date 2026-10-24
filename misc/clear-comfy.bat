@echo off
setlocal EnableDelayedExpansion
REM ===================================================================
REM  bitGen Studio - clear-comfy.bat
REM
REM  Puts ComfyUI back to a KNOWN-EMPTY state: no process alive, no port
REM  held, no cached node outputs, no stale .pyc. Then, optionally, starts
REM  it again in a REAL CONSOLE WINDOW.
REM
REM  WHY THIS EXISTS. Two things kept making test results meaningless:
REM
REM   1. ORPHANS. Before 2.81.3 every quit of bitGen Studio left the ComfyUI it
REM      had launched alive and HIDDEN (windowsHide), still holding :8188 and
REM      the VRAM. So "I restarted ComfyUI" often meant "I started a second
REM      one that could not bind, and kept talking to the old one" - and
REM      which process actually answered a render was never knowable.
REM
REM   2. CACHED NODES. ComfyUI reuses node outputs across prompts
REM      (execution_cached in the worker log). That is normally a feature,
REM      but while chasing a crash it means the run you are studying is
REM      partly a replay of an earlier one. Killing the process is the only
REM      way to empty that cache; there is no button for it.
REM
REM  WHAT IT DELETES: __pycache__ / *.pyc, ComfyUI's temp folder, and
REM  ComfyUI-Manager's registry cache. NOTHING ELSE.
REM  It NEVER touches models, output, input, user settings, saved workflows
REM  or extra_model_paths.yaml. Everything it removes is regenerated on the
REM  next launch, so there is nothing here to back up.
REM
REM  USAGE:  clear-comfy.bat  [path\to\ComfyUI]  [/start]  [/quiet]
REM    (no args)  find ComfyUI from H3's settings files, clear, then ask
REM    /start     start ComfyUI afterwards without asking
REM    /nostart   clear only, never ask
REM    /quiet     when starting, also set TQDM_DISABLE=1 (the 2.81.2
REM               workaround). LEAVE IT OFF for the decisive test below.
REM ===================================================================

set "COMFY="
set "WANTSTART=ask"
set "QUIET=0"

for %%A in (%*) do (
  if /i "%%~A"=="/start"   ( set "WANTSTART=yes"
  ) else if /i "%%~A"=="/nostart" ( set "WANTSTART=no"
  ) else if /i "%%~A"=="/quiet"   ( set "QUIET=1"
  ) else ( set "COMFY=%%~A" )
)

echo.
echo ================= bitGen Studio : clear ComfyUI =================

REM ---- 1. Find ComfyUI -------------------------------------------------
REM The app already knows where it is (Settings -^> ComfyUI writes it to
REM custom.settings; default.settings is the default layer; config.json is
REM the pre-2.99 file), so ask those, in that order, before guessing.
if not defined COMFY (
  for /f "usebackq delims=" %%D in (`powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$d=''; foreach ($f in @('custom.settings','misc\default.settings','config.json')) { try { $v=(Get-Content -Raw ('%~dp0..\'+$f) | ConvertFrom-Json).engine.comfy.dir; if ($v) { $d=$v; break } } catch {} }; $d"`) do set "COMFY=%%D"
)
if not defined COMFY (
  for %%G in ("%~dp0..\..\ComfyUI" "C:\ComfyUI" "D:\ComfyUI" "E:\ComfyUI") do (
    if not defined COMFY if exist "%%~G\main.py" set "COMFY=%%~G"
    if not defined COMFY if exist "%%~G\ComfyUI\main.py" set "COMFY=%%~G"
  )
)
if defined COMFY (
  echo   folder : !COMFY!
) else (
  echo   folder : NOT FOUND - processes and the port will still be cleared.
  echo            Pass it explicitly to clear caches too:
  echo              clear-comfy.bat E:\ComfyUI
)

REM ---- 2. Kill every ComfyUI process -----------------------------------
REM Matched on the COMMAND LINE, not on "python.exe": a blind
REM `taskkill /IM python.exe` would also kill bitGen Studio's own render worker
REM (and any other Python you happen to be running), which is a far worse
REM outcome than leaving one stray process alive. The second -notmatch is
REM belt and braces for exactly that.
echo.
echo [1/4] stopping ComfyUI processes...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'python' -and $_.CommandLine -match 'ComfyUI' -and $_.CommandLine -notmatch 'image_worker|worker\.py|bitgen-studio|h3-studio|clear-comfy' };" ^
  "if (-not $p) { Write-Host '      none running' } else { foreach ($x in $p) { Write-Host ('      killing PID ' + $x.ProcessId); try { Stop-Process -Id $x.ProcessId -Force -ErrorAction Stop } catch { Write-Host ('      could not kill ' + $x.ProcessId + ' - run this as Administrator') } } }"

REM ---- 3. Free port 8188 -----------------------------------------------
REM A process can hold the port without matching above (a launcher .bat, a
REM shell wrapper, an embedded build under a different name). Whoever is
REM LISTENING on 8188 is the thing bitGen Studio would talk to, so it goes.
echo.
echo [2/4] freeing port 8188...
set "PORTBUSY=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":8188 .*LISTENING"') do (
  if not "%%P"=="0" (
    echo       port held by PID %%P - stopping it and its children
    taskkill /PID %%P /T /F >nul 2>&1
    set "PORTBUSY=1"
  )
)
if "!PORTBUSY!"=="0" echo       already free

REM ---- 4. Clear the caches ---------------------------------------------
echo.
echo [3/4] clearing caches...
if not defined COMFY (
  echo       skipped - no ComfyUI folder
) else (
  if exist "!COMFY!\temp" (
    rd /s /q "!COMFY!\temp" >nul 2>&1
    echo       temp\ removed
  )
  REM Compiled bytecode. Harmless normally, but a half-updated custom node
  REM pack that imports stale .pyc is a genuine source of "it worked
  REM yesterday", and this is the cheap way to rule it out.
  set "NPY=0"
  for /d /r "!COMFY!" %%D in (__pycache__) do (
    if exist "%%D" ( rd /s /q "%%D" >nul 2>&1 & set /a NPY+=1 >nul )
  )
  echo       !NPY! __pycache__ folder(s) removed
  for %%M in ("!COMFY!\custom_nodes\ComfyUI-Manager\cache" "!COMFY!\user\default\ComfyUI-Manager\cache") do (
    if exist "%%~M" ( rd /s /q "%%~M" >nul 2>&1 & echo       ComfyUI-Manager cache removed )
  )
  echo       models, output, input, workflows and settings left untouched
)

REM ---- 5. Verify --------------------------------------------------------
echo.
echo [4/4] checking...
netstat -ano | findstr /r /c:":8188 .*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo       :8188 is free - ComfyUI is fully stopped
) else (
  echo       *** :8188 IS STILL HELD. Re-run this as Administrator, or find
  echo       *** the owner with:  netstat -ano ^| findstr :8188
)

REM ---- 6. Offer a clean start ------------------------------------------
if /i "!WANTSTART!"=="no" goto :done
if /i "!WANTSTART!"=="ask" (
  echo.
  echo Start ComfyUI now in a real console window?
  echo   This is THE test for the [Errno 22] sampler crash: a console window
  echo   gives ComfyUI a real stderr, which the crash needs in order not to
  echo   happen. If a render works from this window and fails when started
  echo   from bitGen Studio's button, the fault is our stdio. If it fails BOTH
  echo   ways, it is upstream - update ComfyUI-Manager.
  set /p "ANS=  [Y/n] "
  if /i "!ANS!"=="n" goto :done
)
if not defined COMFY (
  echo.
  echo Cannot start it: no ComfyUI folder was found. Start it yourself.
  goto :done
)

echo.
if "!QUIET!"=="1" (
  echo Starting with TQDM_DISABLE=1 ^(the workaround, NOT the clean test^)...
  set "TQDM_DISABLE=1"
) else (
  echo Starting in a real console window...
)
REM Launch order mirrors lib/comfy.js start(): a portable build's own .bat
REM knows about its venv, and a bare main.py without one fails immediately.
REM `start` opens a NEW window on purpose - that window IS the point.
if exist "!COMFY!\run_nvidia_gpu.bat" (
  start "ComfyUI" cmd /k "cd /d "!COMFY!" && run_nvidia_gpu.bat"
) else if exist "!COMFY!\run.bat" (
  start "ComfyUI" cmd /k "cd /d "!COMFY!" && run.bat"
) else if exist "!COMFY!\..\python_embeded\python.exe" (
  start "ComfyUI" cmd /k "cd /d "!COMFY!\.." && python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build"
) else if exist "!COMFY!\python_embeded\python.exe" (
  start "ComfyUI" cmd /k "cd /d "!COMFY!" && python_embeded\python.exe -s ComfyUI\main.py --windows-standalone-build"
) else if exist "!COMFY!\venv\Scripts\python.exe" (
  start "ComfyUI" cmd /k "cd /d "!COMFY!" && venv\Scripts\python.exe main.py"
) else (
  start "ComfyUI" cmd /k "cd /d "!COMFY!" && python main.py"
)
echo Launched. Wait for "To see the GUI go to..." before pressing Generate.

:done
echo.
echo ============================================================
if /i not "!WANTSTART!"=="no" echo Leave that window OPEN while you render.
echo.
pause
endlocal
