@echo off
setlocal
title bitGen Studio
pushd "%~dp0"

:: 2.331.0: the installer's portable tools (runtime\ - Node, Python, git,
:: ffmpeg) come first, so an installed copy needs nothing on the system PATH
for %%D in ("%~dp0runtime\uv" "%~dp0runtime\ffmpeg\bin" "%~dp0runtime\git\cmd" "%~dp0runtime\python\Scripts" "%~dp0runtime\python" "%~dp0runtime\node") do (
    if exist "%%~D" call set "PATH=%%~D;%%PATH%%"
)

echo ============================================
echo  bitGen Studio - install ^& run
echo ============================================
echo.

:: ---------- 1. Check Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found on PATH.
    echo         Install it from https://nodejs.org ^(18+^) and re-run this file.
    goto :fail
)
for /f "delims=" %%v in ('node --version') do echo [ok] Node.js %%v

:: ---------- 2. Check Python ----------
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py -3"
if not defined PY (
    echo [ERROR] Python not found on PATH.
    echo         Install Python 3.10+ from https://python.org and tick "Add to PATH".
    goto :fail
)
for /f "delims=" %%v in ('%PY% --version') do echo [ok] %%v

:: ---------- 3. Node dependencies ----------
if exist node_modules\express (
    echo [ok] Node dependencies already installed.
) else (
    echo [..] Installing Node dependencies ^(express, multer^)...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check the output above.
        goto :fail
    )
)

:: ---------- 4. Python dependencies ----------
:: The worker itself is stdlib-only. huggingface_hub is only needed by
:: download-models.ps1 to fetch the model files; numpy + OpenCV by the
:: character swap in stereo VR video (2.330.0, scripts\vr_swap.py).
echo [..] Installing Python dependencies ^(huggingface_hub, numpy, OpenCV^)...
%PY% -m pip install --upgrade --quiet -r misc\requirements.txt
if errorlevel 1 (
    echo [WARN] pip install failed. The app will still run, but
    echo        misc\download-models.ps1 needs huggingface_hub to fetch models.
)

:: ---------- 5. sd-cli check ----------
if exist "%~dp0sd-cpp\sd-cli.exe" (
    echo [ok] sd-cli found in sd-cpp\
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
    echo [ok] ComfyUI found in comfy\
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
echo [..] Installing the app shell (Electron, ~150 MB, one time)...
echo      This runs once; later starts go straight to the app window.
echo      Set H3_NO_SHELL=1 to skip it and use your browser instead.
powershell -ExecutionPolicy Bypass -File "%~dp0misc\get-electron.ps1"
call :findelectron
if not defined ELEXE (
    echo [WARN] App shell not available - falling back to the browser.
    goto :browser
)

:shell
echo [..] Starting bitGen Studio ^(app window^)
echo      ^(keep this window open; closing it stops the server^)
echo.
"%ELEXE%" "%~dp0electron"
goto :done

:browser
echo [..] Starting bitGen Studio at http://127.0.0.1:8311
echo      ^(keep this window open; close it or press Ctrl+C to stop^)
echo.
start "" "http://127.0.0.1:8311"
node misc\server.js

:done

popd
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
