@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem ===========================================================================
rem  bitGen Studio - reset the layout and the theme
rem  For when a docker, a panel or the whole UI has been dragged off the screen.
rem
rem  Puts back the default layout: docker positions and sizes, floating panels,
rem  the prompt docker, the workspaces, the dialog positions. It also resets the
rem  theme, the UI scale and the other look settings kept in the app's browser
rem  storage, clears the desktop app's caches (for a black or frozen window)
rem  and puts away the theme editor's unsaved working copies (themes\*.tmp).
rem
rem  NOT touched: your projects, custom.settings, styles, models, ComfyUI, quick
rem  prompts. Everything it removes is moved to backups\layout-<time>\ first, so
rem  it can be put back by copying it back.
rem
rem  It lives in bitGen Studio's misc folder (2.591.0 - start.bat is one folder up); run it
rem  with bitGen Studio CLOSED.
rem ===========================================================================
cd /d "%~dp0.."
title bitGen Studio - reset layout and theme

if not exist "misc\server.js" (
  echo This file must be in the misc folder of bitGen Studio - start.bat is one folder up.
  echo It is in: %~dp0
  pause
  exit /b 1
)

echo.
echo  bitGen Studio - reset the layout and the theme
echo  ----------------------------------------------
echo  Resets: docker and panel positions, workspaces, dialog positions,
echo          the theme, the UI scale and the look settings, the desktop
echo          app's caches ^(a black or frozen window^).
echo  Keeps:  projects, settings, styles, models, ComfyUI, quick prompts.
echo.

rem -- is it still running? (the app's server listens on 8311)
netstat -ano 2>nul | findstr /R /C:":8311 .*LISTENING" >nul
if not errorlevel 1 (
  echo  bitGen Studio is still running. Close it ^(and the start.bat window^),
  echo  then press a key to continue - or close this window to stop.
  pause >nul
  netstat -ano 2>nul | findstr /R /C:":8311 .*LISTENING" >nul
  if not errorlevel 1 (
    echo.
    echo  It is still running - the reset would be overwritten when it saves.
    echo  Close it first, then run this again.
    pause
    exit /b 1
  )
)

choice /C YN /M " Reset the layout and the theme now"
if errorlevel 2 (
  echo  Nothing changed.
  pause
  exit /b 0
)

rem -- a backup folder with the date and time
for /f "tokens=1-6 delims=/:. " %%a in ("%date% %time%") do set "STAMP=%%a%%b%%c-%%d%%e%%f"
set "STAMP=%STAMP: =0%"
set "BK=%~dp0..\backups\layout-%STAMP%"
mkdir "%BK%" 2>nul

set /a N=0
rem -- the layout files the app keeps in its own folder
for %%F in (docker_status.json docker_status.json.tmp dockers.json dockers.json.tmp docker.cfg dialog_layout.cfg panel_layout.cfg workspaces.json workspaces.json.tmp) do (
  if exist "%%F" (
    move /Y "%%F" "%BK%\" >nul && (echo  moved %%F & set /a N+=1)
  )
)

rem -- the desktop app's browser storage (the theme, the UI scale, the look)
for %%D in ("%APPDATA%\bitgen-studio-shell" "%APPDATA%\bitGen Studio" "%APPDATA%\bitgen-studio") do (
  if exist "%%~D\Local Storage" (
    mkdir "%BK%\appdata" 2>nul
    move /Y "%%~D\Local Storage" "%BK%\appdata\Local Storage" >nul && (echo  reset the theme and look ^(%%~D\Local Storage^) & set /a N+=1)
  )
  if exist "%%~D\Session Storage" (
    mkdir "%BK%\appdata" 2>nul
    move /Y "%%~D\Session Storage" "%BK%\appdata\Session Storage" >nul
  )
  rem -- 2.540.6: the desktop app caches - for a black or frozen window - only caches, rebuilt on the next start
  for %%C in ("GPUCache" "Code Cache" "Cache" "DawnCache" "DawnGraphiteCache" "Service Worker") do (
    if exist "%%~D\%%~C" (
      rmdir /S /Q "%%~D\%%~C" 2>nul && (echo  cleared %%~C ^(%%~D^) & set /a N+=1)
    )
  )
)

rem -- 2.540.6: the theme editor's unsaved working copies (themes\*.tmp) - saved themes are kept
if exist "themes\*.tmp" (
  mkdir "%BK%\themes" 2>nul
  for %%T in ("themes\*.tmp") do (
    move /Y "%%~T" "%BK%\themes\" >nul && (echo  moved %%~T & set /a N+=1)
  )
)

echo.
if %N%==0 (
  echo  Nothing to reset - the layout files were not there.
  rmdir "%BK%" 2>nul
) else (
  echo  Done. A copy of what was reset is in:
  echo    %BK%
)
echo.
echo  Start bitGen Studio again: it opens with the default layout and theme.
echo.
echo  Using it in a web browser instead of the desktop app? The theme is kept in
echo  the browser: press F12, open Console, paste this line and press Enter:
echo    Object.keys(localStorage).filter(k=^>k.startsWith("h3.")).forEach(k=^>localStorage.removeItem(k)); location.reload()
echo.
pause
endlocal
