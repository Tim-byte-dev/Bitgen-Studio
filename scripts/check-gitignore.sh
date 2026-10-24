#!/usr/bin/env bash
# check-gitignore.sh — .gitignore and make_zips.sh must agree (2.123.0).
#
# Two lists of "things that are this machine's, not the project's": one decides
# what a release zip carries, the other what a commit carries. They were written
# from each other and they drift silently — the failure is a repo that ships
# somebody's projects folder, or a zip that ships 40GB of model weights, and
# neither is noticed until it is public.
#
# So the lists are compared here, and the e2e suite runs it. Adding an exclusion
# to one file without the other is a FAILURE, not a warning.
set -u
# NO GLOBBING. The lists below contain patterns like *.log, and an unquoted
# command substitution is subject to pathname expansion - so `*.log` would
# silently become whatever .log files happen to be sitting in the directory,
# and the check would fail against a file it invented. Found exactly that way.
set -f
cd "$(dirname "$0")/.."
fails=0
note() { echo "  $1"; fails=$((fails + 1)); }

[ -f .gitignore ] || { echo "check-gitignore: no .gitignore"; exit 1; }

# Directory exclusions: make_zips writes  ! -path "./NAME/*"
for d in $(grep -o '! -path "\./[^/*"]*/\*"' scripts/make_zips.sh \
           | sed 's|.*"\./||; s|/\*"||' | sort -u); do
  case "$d" in
    # git cannot ignore its own .git, and the zip must not carry it: the one
    # exclusion that is legitimately in make_zips.sh and NOT in .gitignore.
    .git) continue ;;
  esac
  grep -qE "^${d}/?$|^${d}/" .gitignore \
    || note "make_zips.sh excludes ./${d}/ from the zip but .gitignore does not ignore it"
done

# Filename exclusions: make_zips writes  ! -name "NAME"
for f in $(grep -o '! -name "[^"]*"' scripts/make_zips.sh \
           | sed 's|! -name "||; s|"$||' | sort -u); do
  case "$f" in
    "*.pyc"|"*.log"|"*.zip")
      grep -qF -- "$f" .gitignore || note "make_zips.sh excludes $f but .gitignore does not" ;;
    *)
      grep -qxF -- "$f" .gitignore || note "make_zips.sh excludes $f but .gitignore does not" ;;
  esac
done

# The one file that must NOT be ignored: without it the app has no defaults.
grep -qxF "default.settings" .gitignore \
  && note "default.settings is ignored — it is the authored default layer and MUST ship"
[ -f misc/default.settings ] || note "misc/default.settings is missing from the tree"

# The zip must not carry the repository either - a release zip with somebody's
# whole git history in it is both enormous and a leak.
grep -q '! -path "\./\.git/\*"' scripts/make_zips.sh \
  || note "make_zips.sh does not exclude ./.git/ - the release zip would carry the repo"

# A committed weights file is the mistake this whole script exists to prevent.
for big in models loras llm-models checkpoints venvs node_modules; do
  grep -qE "^${big}/?$" .gitignore || note "$big/ is not ignored"
done

if [ "$fails" -gt 0 ]; then
  echo "check-gitignore: $fails problem(s)"
  exit 1
fi
echo "check-gitignore: .gitignore and make_zips.sh agree"
