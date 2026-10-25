@echo off
setlocal EnableExtensions
rem ===========================================================================
rem  bitGen Studio - push this folder to GitHub (2.540.6, 2.540.9; 2.591.2: in the app folder, never in the repo itself)
rem
rem  DOUBLE-CLICK: commits everything that changed in this folder and pushes
rem  it to GitHub (origin, branch main).
rem
rem  DRAG A REPO ZIP ONTO IT (bitgen-studio-v<version>-repo.zip): this folder's
rem  files are replaced by the zip's - files a release removed are removed
rem  from GitHub too - then it commits and pushes. Files git does not track
rem  (node_modules, models, projects ...) are not touched.
rem
rem  It sets the folder up the first time (git init + the GitHub address), asks
rem  for your git name and e-mail once if they are not set, never force-pushes,
rem  and stops with a clear message if GitHub has changes it cannot merge.
rem  Needs Git for Windows: https://git-scm.com/download/win
rem  The first push opens a GitHub sign-in window - that is Git, not this file.
rem ===========================================================================
set "URL=https://github.com/Tim-byte-dev/bitgen-studio.git"
set "BRANCH=main"
title bitGen Studio - push to GitHub

rem -- with a zip: run from a copy in TEMP (the zip step replaces this file too)
if /i "%~2"=="--from-temp" goto :fromtemp
set "REPO=%~dp0"
set "ZIP="
if "%~1"=="" goto :start
copy /Y "%~f0" "%TEMP%\bitgen-push.bat" >nul
"%TEMP%\bitgen-push.bat" "%~f1" --from-temp "%~dp0"
exit /b

:fromtemp
set "ZIP=%~1"
set "REPO=%~3"

:start
cd /d "%REPO%"
echo.
echo  bitGen Studio - push to GitHub
echo  ------------------------------
echo  Folder: %CD%

where git >nul 2>nul
if errorlevel 1 goto :nogit

rem -- 2.540.9: the right folder? a .git or the app's package.json says this is the repository
rem    (a bitgen-studio folder inside this one first: the bat was put one folder too high)
if exist "bitgen-studio\.git" goto :wrongplace
if exist "bitgen-studio\package.json" goto :wrongplace
if exist ".git" goto :placeok
if exist "package.json" goto :placeok
echo.
echo  This folder has no git repository and no bitGen Studio files.
echo  This file belongs IN your bitgen-studio folder - the one with package.json.
choice /C YN /M " Make THIS folder the repository anyway"
if errorlevel 2 goto :stopped
:placeok

rem -- the first time: make this folder a git repository linked to GitHub
if exist ".git" goto :hasgit
echo  This folder is not a git repository yet - setting it up for
echo    %URL%
git init -q -b %BRANCH%
if errorlevel 1 goto :fail
:hasgit
call :trustdir
git remote get-url origin >nul 2>nul
if errorlevel 1 git remote add origin %URL%
set "ORIGIN="
for /f "delims=" %%r in ('git remote get-url origin') do set "ORIGIN=%%r"
rem a broken address (for example "https" typed where a name belongs) - put the right one back
echo %ORIGIN%| findstr /b /c:"https://github.com/" /c:"git@github.com:" >nul
if errorlevel 1 (
  echo  The GitHub address was "%ORIGIN%" - setting it to %URL%
  git remote set-url origin %URL%
  set "ORIGIN=%URL%"
)
echo  GitHub: %ORIGIN%
echo.
echo  Checking GitHub...
git fetch -q origin
if errorlevel 1 goto :nofetch
set "REMOTE=1"
git rev-parse -q --verify origin/%BRANCH% >nul 2>nul
if errorlevel 1 set "REMOTE="
rem a new folder: take GitHub's history without touching the files here
git rev-parse -q --verify HEAD >nul 2>nul
if errorlevel 1 if defined REMOTE git reset -q origin/%BRANCH%

rem -- a zip dropped on this file: put its files in place
if not defined ZIP goto :commit
if /i not "%ZIP:~-4%"==".zip" goto :notzip
set "TMPX=%TEMP%\bitgen-push-x"
if exist "%TMPX%" rmdir /S /Q "%TMPX%"
echo  Unpacking %ZIP% ...
powershell -NoProfile -Command "Expand-Archive -LiteralPath $env:ZIP -DestinationPath $env:TMPX -Force"
if errorlevel 1 goto :badzip
set "SRC=%TMPX%"
if exist "%TMPX%\bitgen-studio\package.json" set "SRC=%TMPX%\bitgen-studio"
if not exist "%SRC%\package.json" goto :badzip
if exist "%SRC%\FOLDER-STRUCTURE.md" goto :fullzip
if exist "%SRC%\HANDOVER.md" goto :fullzip
if exist "%SRC%\misc\FOLDER-STRUCTURE.md" goto :fullzip
if exist "%SRC%\misc\HANDOVER.md" goto :fullzip
set "ZVER="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content -Raw -LiteralPath (Join-Path $env:SRC 'package.json') | ConvertFrom-Json).version"`) do set "ZVER=%%v"
echo.
echo  The zip holds bitGen Studio %ZVER%.
choice /C YN /M " Replace this folder's repo files with it"
if errorlevel 2 goto :stopped
rem only the files git tracks are removed - then the zip's are copied in
rem 2.591.2: this file stays in the folder but out of the repo - untracked first, so the next line leaves it on disk
git rm -q --cached --ignore-unmatch -- push-to-github.bat >nul
git rm -r -q -f --ignore-unmatch -- . >nul
robocopy "%SRC%" "%REPO%." /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail
rmdir /S /Q "%TMPX%" 2>nul
echo  The files of %ZVER% are in place.

:commit
cd /d "%REPO%"
set "VER="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "(Get-Content -Raw package.json | ConvertFrom-Json).version"`) do set "VER=%%v"
rem 2.591.0 moved the app's files into misc\ - an old copy left in the folder by an unzip over it goes, so GitHub gets the new layout
if exist "lib\miscMigrate.js" node -e "require('./lib/miscMigrate').run(process.cwd(), {repo: true})"
git add -A
rem never in the public repo: the private notes and tools (the same list as the release's repo zip)
git rm -r -q --cached --ignore-unmatch HANDOVER.md HANDOVER-ARCHIVE.md CONTINUATION-NOTES-2_137_1.md WORKING-VERSIONS.md FOLDER-STRUCTURE.md unflatten.ps1 scripts/unflatten.py _gitignore g_kf.cmd t_kf.cmd CONTINUE.md misc/HANDOVER.md misc/HANDOVER-ARCHIVE.md misc/CONTINUATION-NOTES-2_137_1.md misc/WORKING-VERSIONS.md misc/FOLDER-STRUCTURE.md misc/unflatten.ps1 misc/_gitignore misc/CONTINUE.md misc/push-to-github.bat push-to-github.bat docs/PHOTOSHOP-GAP.md docs/PREMIERE-GAP.md docs/AFTER-EFFECTS-GAP.md >nul
git diff --cached --quiet
if not errorlevel 1 goto :nochange

echo.
echo  What changed:
git diff --cached --shortstat
rem -- who the commit is from (asked once, kept for this folder)
set "GNAME="
set "GMAIL="
for /f "delims=" %%n in ('git config user.name 2^>nul') do set "GNAME=%%n"
for /f "delims=" %%m in ('git config user.email 2^>nul') do set "GMAIL=%%m"
if defined GNAME if defined GMAIL goto :msg
echo.
echo  Git needs a name and an e-mail for the commit. To keep your e-mail
echo  private, use the noreply address from GitHub - Settings - Emails
echo  ^(it looks like 12345678+Tim-byte-dev@users.noreply.github.com^).
if not defined GNAME set /p "GNAME= Your name: "
if not defined GMAIL set /p "GMAIL= Your e-mail: "
git config user.name "%GNAME%"
git config user.email "%GMAIL%"

:msg
set "MSG=bitGen Studio %VER%"
echo.
set /p "MSG= Commit message [press Enter for: bitGen Studio %VER%]: "
git commit -q -m "%MSG%"
if errorlevel 1 goto :fail
echo  Committed: %MSG%
goto :push

:nochange
echo.
echo  No changed files in this folder.

:push
set "AHEAD=1"
if defined REMOTE for /f %%a in ('git rev-list --count origin/%BRANCH%..HEAD') do set "AHEAD=%%a"
if "%AHEAD%"=="0" goto :uptodate
echo.
choice /C YN /M " Push to GitHub now"
if errorlevel 2 goto :stopped
echo  Pushing...
git push -u origin HEAD:%BRANCH%
if not errorlevel 1 goto :done
echo.
echo  GitHub has changes this folder does not have ^(an edit made on the
echo  website?^) - bringing them in first...
git pull -q --rebase origin %BRANCH%
if errorlevel 1 goto :conflict
git push -u origin HEAD:%BRANCH%
if errorlevel 1 goto :fail
goto :done

:done
echo.
echo  Done - GitHub has bitGen Studio %VER%:
echo    https://github.com/Tim-byte-dev/bitgen-studio
echo  The Updates button in the app ^(Settings - General^) now finds it.
goto :end

:uptodate
echo.
echo  GitHub already has everything in this folder - nothing to push.
goto :end

:conflict
git rebase --abort >nul 2>nul
echo.
echo  The changes on GitHub clash with the ones here, so nothing was pushed.
echo  Your commit is kept in this folder. Open Git GUI ^(or ask for help^)
echo  to merge them, then run this file again.
goto :end

:nogit
echo.
echo  Git is not installed. Get Git for Windows from
echo    https://git-scm.com/download/win
echo  then run this file again.
goto :end

:nofetch
echo.
echo  Git could not talk to GitHub - the message above says why ^(no internet,
echo  a cancelled sign-in ...^). Nothing was pushed. Try again in a moment.
goto :end

:notzip
echo.
echo  That is not a .zip file. Drag bitgen-studio-v^<version^>-repo.zip onto
echo  this file - or double-click it to push the folder as it is.
goto :end

:badzip
echo.
echo  Could not unpack that zip, or it is not a bitGen Studio zip
echo  ^(no package.json inside^). Nothing was changed.
goto :end

:fullzip
rmdir /S /Q "%TMPX%" 2>nul
echo.
echo  That is the FULL zip ^(it carries the private notes^). Use the REPO zip:
echo    bitgen-studio-v^<version^>-repo.zip
echo  Nothing was changed.
goto :end

:copyfail
echo.
echo  Copying the zip's files failed. The removed files are still in git -
echo  run:  git checkout -- .   in this folder to put them back.
goto :end

:stopped
if defined TMPX if exist "%TMPX%" rmdir /S /Q "%TMPX%" 2>nul
echo  Stopped - nothing was pushed.
goto :end

:fail
echo.
echo  Something went wrong ^(the message above is from git^). Nothing was
echo  force-pushed; your files are as they were.

:wrongplace
echo.
echo  This file is in %CD%
echo  but the repository is %CD%\bitgen-studio
echo  Move push-to-github.bat into that folder and run it from there.
if not exist ".git" goto :end
echo.
echo  This folder also has a .git folder ^(an earlier run of this file made it here^).
echo  It is not your repository - delete it with:  rmdir /s /q "%CD%\.git"
goto :end

:end
echo.
pause
endlocal
exit /b

rem -- 2.540.9: a folder Windows says belongs to another user account (an older Windows install, another PC, a
rem    copied drive): git refuses it ("detected dubious ownership") until it is trusted - do what git suggests, once
:trustdir
git rev-parse --git-dir >nul 2>"%TEMP%\bitgen-git-err.txt"
findstr /c:"dubious ownership" "%TEMP%\bitgen-git-err.txt" >nul
if errorlevel 1 goto :eof
set "SAFE=%CD:\=/%"
echo.
echo  Windows says this folder belongs to another user account ^(an older Windows
echo  install or another PC^), so git will not use it until it is trusted.
echo  Trusting it: git config --global --add safe.directory %SAFE%
git config --global --add safe.directory "%SAFE%"
goto :eof
