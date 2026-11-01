@echo off
:: bitGen Studio - INSTALL ALL for Windows 10 / 11 (2.616.0).
::
:: Tim (verbatim): "is it possible to create an install_all file that will install git and nodejs if they are not
:: installed then run start for all our supported os?" + "so user can use this file only, it will also clone our repo".
::
:: This ONE file is enough: put it in the folder you want bitGen Studio in (a big, fast drive - ComfyUI and the models
:: need about 100 GB) and double-click it.
::   1. Git          installed when missing (winget; without winget the newest Git for Windows from GitHub)
::   2. Node.js 18+  installed when missing (winget Node.js LTS; without winget the LTS .msi from nodejs.org)
::   3. Python 3.10+ installed when missing - start.bat needs it (winget Python 3.12; else python.org, just for you)
::   4. the app      this folder when it is a bitGen Studio folder; otherwise git clone into .\Bitgen-Studio
::   5. start.bat    installs the rest the first time (packages, the app window, the setup wizard) and starts it
:: Windows may ask "allow this app to make changes" for Git / Node.js - say Yes.
:: Switches: set BITGEN_REPO=<another clone URL>   set BITGEN_NO_START=1 (install, do not start)   set NO_COLOR=1 (plain text)
setlocal EnableExtensions

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
title bitGen Studio - install all
pushd "%~dp0"
set "REPO=https://github.com/Tim-byte-dev/Bitgen-Studio"
if defined BITGEN_REPO set "REPO=%BITGEN_REPO%"
set "PS=powershell -NoProfile -ExecutionPolicy Bypass -Command"
set "WG="
where winget >nul 2>nul && set "WG=1"

echo ============================================
echo  bitGen Studio - install all
echo ============================================
echo.

:: ---------- 1. Git ----------
call :refresh
where git >nul 2>nul && goto :gitok
echo %C_RUN%[..] Git is not installed - installing it%C_0%
call :long "a minute or two - Windows may ask to allow it"
if defined WG (
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --silent
) else (
    %PS% "[Net.ServicePointManager]::SecurityProtocol='Tls12'; $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {'arm64'} else {'64-bit'}; $r = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest'; $a = $r.assets | Where-Object { $_.name -match ('^Git-[0-9.]+-' + $arch + '\.exe$') } | Select-Object -First 1; $f = Join-Path $env:TEMP 'bitgen-git-setup.exe'; Invoke-WebRequest $a.browser_download_url -OutFile $f -UseBasicParsing; Start-Process $f -ArgumentList '/VERYSILENT','/NORESTART','/NOCANCEL','/SP-' -Verb RunAs -Wait"
)
call :refresh
where git >nul 2>nul || (
    echo %C_ERR%[ERROR] Git did not install. Install it from https://git-scm.com/download/win and run this file again.%C_0%
    goto :fail
)
:gitok
for /f "delims=" %%v in ('git --version') do echo %C_OK%[ok] %%v%C_0%

:: ---------- 2. Node.js 18+ ----------
call :nodeok && goto :nodeok2
echo %C_RUN%[..] Node.js 18+ is not installed - installing Node.js LTS%C_0%
call :long "a minute or two - Windows may ask to allow it"
if defined WG (
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements --silent
) else (
    %PS% "[Net.ServicePointManager]::SecurityProtocol='Tls12'; $i = Invoke-RestMethod 'https://nodejs.org/dist/index.json'; $v = ($i | Where-Object { $_.lts } | Select-Object -First 1).version; $a = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {'arm64'} else {'x64'}; $f = Join-Path $env:TEMP 'bitgen-node.msi'; Invoke-WebRequest ('https://nodejs.org/dist/' + $v + '/node-' + $v + '-' + $a + '.msi') -OutFile $f -UseBasicParsing; Start-Process msiexec.exe -ArgumentList ('/i ' + [char]34 + $f + [char]34 + ' /qn /norestart') -Verb RunAs -Wait"
)
call :refresh
call :nodeok || (
    echo %C_ERR%[ERROR] Node.js did not install. Install the LTS version from https://nodejs.org and run this file again.%C_0%
    goto :fail
)
:nodeok2
for /f "delims=" %%v in ('node --version') do echo %C_OK%[ok] Node.js %%v%C_0%

:: ---------- 3. Python 3.10+ (start.bat needs it) ----------
call :pyok && goto :pyok2
echo %C_RUN%[..] Python 3.10+ is not installed - installing Python 3.12%C_0%
call :long "a minute or two"
if defined WG (
    winget install --id Python.Python.3.12 -e --source winget --scope user --accept-package-agreements --accept-source-agreements --silent
) else (
    %PS% "[Net.ServicePointManager]::SecurityProtocol='Tls12'; $a = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {'arm64'} else {'amd64'}; $f = Join-Path $env:TEMP 'bitgen-python.exe'; Invoke-WebRequest ('https://www.python.org/ftp/python/3.12.10/python-3.12.10-' + $a + '.exe') -OutFile $f -UseBasicParsing; Start-Process $f -ArgumentList '/quiet','InstallAllUsers=0','PrependPath=1','Include_launcher=1' -Wait"
)
call :refresh
call :pyok || (
    echo %C_ERR%[ERROR] Python did not install. Install Python 3.12 from https://www.python.org/downloads/%C_0%
    echo %C_ERR%        with "Add python.exe to PATH" ticked, then run this file again.%C_0%
    goto :fail
)
:pyok2
echo %C_OK%[ok] Python found%C_0%

:: ---------- 4. The app: this folder, or a clone next to this file ----------
set "APP=%~dp0"
if exist "%~dp0misc\server.js" goto :haveapp
set "APP=%~dp0Bitgen-Studio\"
if not exist "%APP%misc\server.js" goto :clone
echo %C_OK%[ok] bitGen Studio found in "%APP%"%C_0%
goto :haveapp
:clone
echo %C_RUN%[..] Getting bitGen Studio: git clone %REPO%%C_0%
call :long "a few minutes on a slow connection"
git clone "%REPO%" "%~dp0Bitgen-Studio"
if errorlevel 1 (
    echo %C_ERR%[ERROR] git clone failed - check your internet connection and run this file again.%C_0%
    goto :fail
)
:haveapp

:: ---------- 5. Start (start.bat installs the rest the first time) ----------
if not defined BITGEN_NO_START goto :start
echo %C_OK%[ok] Installed in "%APP%" - run start.bat there to open bitGen Studio.%C_0%
popd
exit /b 0
:start
echo %C_RUN%[..] Running start.bat in "%APP%"%C_0%
echo %C_RUN%     The first start installs the rest - it takes a while; each step says when it is done.%C_0%
echo.
popd
cd /d "%APP%"
call "%APP%start.bat"
exit /b %errorlevel%

:: ---------- helpers ----------
:long
:: 2.634.0: a long, quiet step - say so, so nobody thinks setup stalled
echo %C_RUN%     This can take %~1. The window may look still while it works - it has not stalled.%C_0%
exit /b 0

:refresh
:: the PATH as Windows has it now (an installer just changed it) + where Git / Node.js / Python usually land
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P;%PATH%"
for %%D in ("%ProgramFiles%\Git\cmd" "%ProgramFiles%\nodejs" "%LOCALAPPDATA%\Programs\Python\Python312" "%LOCALAPPDATA%\Programs\Python\Python312\Scripts" "%LOCALAPPDATA%\Programs\Python\Launcher") do (
    if exist "%%~D" call set "PATH=%%~D;%%PATH%%"
)
exit /b 0

:nodeok
where node >nul 2>nul || exit /b 1
node -e "process.exit(+process.versions.node.split('.')[0] >= 18 ? 0 : 1)" >nul 2>nul
exit /b %errorlevel%

:pyok
:: (the Microsoft Store's "python" stand-in fails the check, so it does not count)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && exit /b 0
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul && exit /b 0
exit /b 1

:fail
echo.
pause
popd
exit /b 1
