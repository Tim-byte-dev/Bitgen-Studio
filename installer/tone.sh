# bitGen Studio - installer/tone.sh (2.634.0): THE INSTALLERS' COLOURS + "STILL WORKING" LINES (sourced by bootstrap.sh;
# install_all.sh carries the same block - it runs on its own, before the app is there).
# Tim: "in the setup file report completed in green, currently installing in a lighter green, warnings in orange and errors
# in red. when waiting installing, let the user know so they don't think the setup stalled"
#   done = green, working = light green, warnings = orange, errors = red - only on a terminal (a log gets plain text);
#   NO_COLOR=1 turns the colours off.
#   tone_of LINE   -> the colour for a line: "[ok] ..." / "... done" green, "[..] ..." light green, "WARNING ..." / "[warn] ..."
#                     orange, "ERROR ..." red
#   busy LABEL CMD ...  runs CMD in the foreground (it keeps the terminal - sudo can ask for the password) and every 20 s
#                     prints "... still LABEL (1m 20s) - it has not stalled" (TONE_EVERY=<seconds> changes the 20)
C_OK=""; C_RUN=""; C_WARN=""; C_ERR=""; C_0=""
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != dumb ]; then
  _e="$(printf '\033')"; C_OK="${_e}[38;5;40m"; C_RUN="${_e}[38;5;157m"; C_WARN="${_e}[38;5;208m"; C_ERR="${_e}[38;5;196m"; C_0="${_e}[0m"
fi
tone_of() {
  case "$1" in
    "[ok]"*|*" done"|*" done "*) printf '%s' "$C_OK";;
    "[..]"*|"     "*) printf '%s' "$C_RUN";;
    WARNING*|"[warn]"*|"[WARN]"*) printf '%s' "$C_WARN";;
    ERROR*|"[ERROR]"*|"[error]"*) printf '%s' "$C_ERR";;
  esac
}
busy() {
  _l="$1"; shift
  ( _s=0; while sleep "${TONE_EVERY:-20}" >/dev/null 2>&1 </dev/null; do _s=$((_s + ${TONE_EVERY:-20})); printf '%s\n' "${C_RUN}${TONE_TAG:-[bitgen]}      ... still ${_l} ($((_s / 60))m $((_s % 60))s) - it has not stalled${C_0}"; done ) &
  _hb=$!
  "$@"; _rc=$?
  kill "$_hb" 2>/dev/null; wait "$_hb" 2>/dev/null
  return $_rc
}
