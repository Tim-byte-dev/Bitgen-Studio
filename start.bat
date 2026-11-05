@echo off
setlocal
title bitGen Studio
pushd "%~dp0"

:: 2.331.0: the installer's portable tools (runtime\ - Node, Python, git,
:: ffmpeg) come first, so an installed copy needs nothing on the system PATH
for %%D in ("%~dp0runtime\uv" "%~dp0runtime\ffmpeg\bin" "%~dp0runtime\git\cmd" "%~dp0runtime\python\Scripts" "%~dp0runtime\python" "%~dp0runtime\node") do (
    if exist "%%~D" call set "PATH=%%~D;%%PATH%%"
)

:: 2.634.0 (Tim: "report completed in green, currently installing in a lighter green, warnings in orange and errors in
:: red. when waiting installing, let the user know so they don't think the setup stalled"): VT colours (Windows 10+);
:: set NO_COLOR=1 for plain text
set "C_OK=" & set "C_RUN=" & set "C_WARN=" & set "C_ERR=" & set "C_0=" & set "ESC="
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do set "ESC=%%b"
if not defined NO_COLOR if defined ESC (
    set "C_OK=%ESC%[38;5;40m"
    set "C_RUN=%ESC%[38;5;157m"
    set "C_WARN=%ESC%[38;5;208m"
    set "C_ERR=%ESC%[38;5;196m"
    set "C_0=%ESC%[0m"
)

echo ============================================
echo  bitGen Studio - install ^& run
echo ============================================
echo.

:: ---------- 1. Check Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo %C_ERR%[ERROR] Node.js not found on PATH.%C_0%
    echo %C_ERR%        Install it from https://nodejs.org ^(18+^) and re-run this file.%C_0%
    goto :fail
)
for /f "delims=" %%v in ('node --version') do echo %C_OK%[ok] Node.js %%v%C_0%

:: ---------- 2. Check Python ----------
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY (
    echo %C_ERR%[ERROR] Python not found on PATH.%C_0%
    echo %C_ERR%        Install Python 3.10+ from https://python.org and tick "Add to PATH".%C_0%
    goto :fail
)
for /f "delims=" %%v in ('%PY% --version') do echo %C_OK%[ok] %%v%C_0%

:: ---------- 3. Node dependencies ----------
if exist node_modules\express (
    echo %C_OK%[ok] Node dependencies already installed.%C_0%
) else (
    echo %C_RUN%[..] Installing Node dependencies ^(express, multer^)...%C_0%
    call :long "a minute or two"
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo %C_ERR%[ERROR] npm install failed. Check the output above.%C_0%
        goto :fail
    )
)

:: ---------- 4. Python dependencies ----------
:: The worker itself is stdlib-only. huggingface_hub is only needed by
:: download-models.ps1 to fetch the model files; numpy + OpenCV by the
:: character swap in stereo VR video (2.330.0, scripts\vr_swap.py).
echo %C_RUN%[..] Installing Python dependencies ^(huggingface_hub, numpy, OpenCV^)...%C_0%
call :long "a few minutes - pip prints nothing while it works"
%PY% -m pip install --upgrade --quiet -r misc\requirements.txt
if not errorlevel 1 echo %C_OK%[ok] Python dependencies installed.%C_0%
if errorlevel 1 (
    echo %C_WARN%[WARN] pip install failed. The app will still run, but%C_0%
    echo %C_WARN%       misc\download-models.ps1 needs huggingface_hub to fetch models.%C_0%
)

:: ---------- 5. sd-cli check ----------
if exist "%~dp0sd-cpp\sd-cli.exe" (
    echo %C_OK%[ok] sd-cli found in sd-cpp\%C_0%
) else (
    echo.
    echo [note] sd-cli.exe not found in sd-cpp\ - only needed for the sd-cli
    echo        engine. Install it from Settings ^> Paths ^> "Install sd-cli",
    echo        or run misc\get-sd-cli.ps1. ComfyUI mode does not need it.
)

:: ---------- 5b. ComfyUI ----------
:: 2.222.0, by instruction: "no need to have question in start.bat installer
:: will install everything". NO questions here any more - the Windows-11
:: setup window handles the whole install (folder choice included) when the
:: app launches. Browser-mode users run get-comfy.ps1 themselves.
if exist "%~dp0comfy\ComfyUI\main.py" (
    echo %C_OK%[ok] ComfyUI found in comfy\%C_0%
) else (
    echo [note] ComfyUI is not installed yet - the setup window will handle it
    echo        at launch ^(browser mode: run misc\get-comfy.ps1 yourself^).
    echo        Declined it before? Delete comfy\.declined to see setup again.
)

:: ---------- 6. Model check ----------
if not exist "%~dp0models\minimax_h3_ref2va_pruned-Q6_K.gguf" (
    echo.
    echo [note] No model files found in the models\ folder yet.
    echo        To download the model set now ^(~50 GB^), run:
    echo            powershell -ExecutionPolicy Bypass -File misc\download-models.ps1
    echo        Or drop your .gguf/.safetensors files into models\ yourself,
    echo        or point Settings at wherever they already live.
    echo.
)

:: ---------- 7. App shell (optional, frameless Windows 11 look) ----------
:: Set H3_NO_SHELL=1 to force the plain browser.
:: Ask node where electron actually is rather than assuming dist\electron.exe -
:: require("electron") reads the package's own path.txt, which is the supported
:: way and does not change between releases.
if defined H3_NO_SHELL goto :browser
call :findelectron
if defined ELEXE goto :shell
echo.
echo %C_RUN%[..] Installing the app shell (Electron, ~150 MB, one time)...%C_0%
echo %C_RUN%     This runs once; later starts go straight to the app window.%C_0%
echo %C_RUN%     Set H3_NO_SHELL=1 to skip it and use your browser instead.%C_0%
call :long "a few minutes on a slow connection"
powershell -ExecutionPolicy Bypass -File "%~dp0misc\get-electron.ps1"
call :findelectron
if not defined ELEXE (
    echo %C_WARN%[WARN] App shell not available - falling back to the browser.%C_0%
    goto :browser
)

:shell
echo %C_RUN%[..] Starting bitGen Studio ^(app window^)%C_0%
echo %C_RUN%     ^(keep this window open; closing it stops the server^)%C_0%
echo.
"%ELEXE%" "%~dp0electron"
goto :done

:browser
echo %C_RUN%[..] Starting bitGen Studio at http://127.0.0.1:8311%C_0%
echo %C_RUN%     ^(keep this window open; close it or press Ctrl+C to stop^)%C_0%
echo.
start "" "http://127.0.0.1:8311"
node misc\server.js

:done

popd
:: 2.669.0 (Tim: "when bitgen exits ... close the terminal window"): the app has gone (it cleared ComfyUI and ended its own
:: processes on the way out - lib\exitSweep.js), so this window closes too: exit, not exit /b
exit 0

:long
:: 2.634.0: a long, quiet step - say so, so nobody thinks setup stalled
echo %C_RUN%     This can take %~1. The window may look still while it works - it has not stalled.%C_0%
exit /b 0

:findelectron
:: require("electron") may also print progress while it fetches the runtime, so
:: accept only a line that is actually a file on disk.
set "ELEXE="
for /f "usebackq delims=" %%E in (`node -e "try{process.stdout.write(require('electron'))}catch(e){}" 2^>nul`) do (
    if exist "%%E" set "ELEXE=%%E"
)
exit /b 0

:fail
echo.
pause
popd
exit /b 1
