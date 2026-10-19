; bitGen Studio - Windows installer (2.331.0), NSIS 3 / Modern UI 2.
;
; Tim: "create a windows 11 type installer for the package ... do number 1
; but make it crossplatform". This is the Windows half (the Linux / macOS
; self-extracting installers share installer/bootstrap.sh). It:
;   1. copies the app to %LOCALAPPDATA%\Programs\bitGenStudio (per user, no
;      admin rights; the folder can be changed - pick a big drive, the models
;      and ComfyUI live next to the app by default)
;   2. runs installer\bootstrap.ps1: portable Node.js, Python 3.12 (uv), git,
;      ffmpeg, Electron, the Python packages, shortcuts, .setup-pending
;   3. starts bitGen Studio, which opens the setup wizard first (ComfyUI, node
;      packs, OmniVoice, Hugging Face models, GPU tuning) and then the studio.
;
; Built by scripts/build-installers.sh:
;   makensis -DVERSION=2.331.0 -DSRC=<staged app> -DOUT=<Setup.exe> bitgen-setup.nsi

Unicode true
ManifestDPIAware true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!ifndef SRC
  !error "pass -DSRC=<the staged app folder>"
!endif
!ifndef OUT
  !define OUT "bitGen-Studio-Setup-${VERSION}.exe"
!endif
!define APPNAME "bitGen Studio"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\bitGenStudio"

Name "${APPNAME}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\bitGenStudio"
InstallDirRegKey HKCU "Software\bitGenStudio" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "${APPNAME} ${VERSION}"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "FileDescription" "${APPNAME} Setup"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Tiger Art"

!define MUI_ICON "${SRC}\installer\bitgen.ico"
!define MUI_UNICON "${SRC}\installer\bitgen.ico"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "Welcome to ${APPNAME} ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "This installs bitGen Studio, the local AI film studio.$\r$\n$\r$\nSetup copies the app, then downloads what it runs on (Node.js, Python, the app window) into the app folder - nothing is installed system-wide and no administrator rights are needed.$\r$\n$\r$\nWhen it finishes, bitGen Studio opens its setup wizard: ComfyUI (new, or your existing one), the custom nodes, OmniVoice, and the Hugging Face models, tuned for your graphics card.$\r$\n$\r$\nClick Next to continue."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${SRC}\LICENSE"
!define MUI_DIRECTORYPAGE_TEXT_TOP "ComfyUI and the models (about 50-120 GB) go next to the app unless you choose another folder in the setup wizard, so a large, fast drive is best."
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "${APPNAME} is installed"
!define MUI_FINISHPAGE_TEXT "Next, bitGen Studio opens its setup wizard to install ComfyUI, the nodes and the models for your hardware. After that the studio is ready to use."
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Start ${APPNAME} now"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchApp
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "${APPNAME}" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"
  DetailPrint "Copying bitGen Studio ${VERSION}..."
  File /r "${SRC}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall bitGen Studio.exe"

  WriteRegStr HKCU "Software\bitGenStudio" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "Tiger Art"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\installer\bitgen.ico"
  WriteRegStr HKCU "${UNKEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall bitGen Studio.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${UNKEY}" "EstimatedSize" $0

  DetailPrint "Setting up Node.js, Python and the app window - a few minutes on a first install..."
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\installer\bootstrap.ps1"'
  Pop $0
  ${If} $0 != 0
    DetailPrint "bootstrap exit code: $0"
    MessageBox MB_ICONEXCLAMATION|MB_OK "Part of the runtime setup did not finish (code $0) - the details are in this window.$\r$\n$\r$\nCheck the internet connection and run the installer again; it picks up where it stopped."
  ${EndIf}
SectionEnd

Function LaunchApp
  ${If} ${FileExists} "$SMPROGRAMS\${APPNAME}.lnk"
    ExecShell "open" "$SMPROGRAMS\${APPNAME}.lnk"
  ${Else}
    ExecShell "open" "$INSTDIR\start.bat"
  ${EndIf}
FunctionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\${APPNAME}.lnk"
  Delete "$DESKTOP\${APPNAME}.lnk"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegKey HKCU "Software\bitGenStudio"
  MessageBox MB_YESNO|MB_ICONQUESTION "Keep your projects, ComfyUI, downloaded models and settings?$\r$\n$\r$\nYes: remove only the program (reinstalling picks them up again).$\r$\nNo: delete everything in $INSTDIR." IDYES keep
  RMDir /r "$INSTDIR"
  Goto done
keep:
  ; the program itself; user data stays. runtime\ stays too - ComfyUI's
  ; venv is built on runtime\pythons, and a reinstall reuses it all
  RMDir /r "$INSTDIR\node_modules"
  RMDir /r "$INSTDIR\electron"
  RMDir /r "$INSTDIR\lib"
  RMDir /r "$INSTDIR\routes"
  RMDir /r "$INSTDIR\static"
  RMDir /r "$INSTDIR\scripts"
  RMDir /r "$INSTDIR\installer"
  RMDir /r "$INSTDIR\ext"
  RMDir /r "$INSTDIR\docs"
  Delete "$INSTDIR\*.js"
  Delete "$INSTDIR\*.py"
  Delete "$INSTDIR\*.bat"
  Delete "$INSTDIR\*.ps1"
  Delete "$INSTDIR\*.sh"
  Delete "$INSTDIR\Uninstall bitGen Studio.exe"
done:
SectionEnd
