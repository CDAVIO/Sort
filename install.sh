#!/bin/bash
# SORT for macOS, installed from the Terminal:
#   curl -fsSL https://sortcdav.netlify.app/install.sh | bash
#
# A file fetched with curl carries no quarantine flag, so macOS opens SORT
# without the "unidentified developer" block. Only tools that ship with
# macOS are used: curl, plutil, shasum, hdiutil, ditto.
set -euo pipefail

BASE="${SORT_BASE:-https://sortcdav.netlify.app}"
say(){ printf '\033[1;33m›\033[0m %s\n' "$1"; }
die(){ printf '\033[1;31m✕\033[0m %s\n' "$1" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "This installer is for macOS. On Windows, run in PowerShell:  irm $BASE/install.ps1 | iex"
case "$(uname -m)" in arm64) KEY="mac-arm" ;; *) KEY="mac-intel" ;; esac

say "Asking $BASE for the newest SORT"
JSON="$(curl -fsSL "$BASE/latest.json")" || die "Could not reach $BASE. Check the internet and try again."
field(){ printf '%s' "$JSON" | plutil -extract "$1" raw -o - - 2>/dev/null; }
VER="$(field version)"
NAME="$(field "files.$KEY.name")"
SHA="$(field "files.$KEY.sha256" || true)"
[ -n "$VER" ] && [ -n "$NAME" ] || die "The site did not say which file to download."

TMP="$(mktemp -d)"; MNT=""
cleanup(){ [ -n "$MNT" ] && hdiutil detach "$MNT" -quiet 2>/dev/null || true; rm -rf "$TMP"; }
trap cleanup EXIT

say "Downloading SORT $VER ($( [ "$KEY" = mac-arm ] && echo 'Apple chip' || echo 'Intel' ))"
curl -fL --progress-bar "$BASE/download/$NAME" -o "$TMP/$NAME" || die "The download failed."

if [ -n "$SHA" ]; then
  GOT="$(shasum -a 256 "$TMP/$NAME" | awk '{print $1}')"
  [ "$GOT" = "$SHA" ] || die "The download does not match the published file. Nothing was installed."
fi

# a SORT that is open would keep the old copy in use
osascript -e 'quit app "SORT"' >/dev/null 2>&1 || true
sleep 1

MNT="$(hdiutil attach -nobrowse -noautoopen -readonly "$TMP/$NAME" 2>/dev/null | tail -1 | awk -F'\t' '{print $NF}')"
[ -d "$MNT/SORT.app" ] || die "The disk image has no SORT.app inside."

# /Applications when it can be written, otherwise the user's own Applications folder
DEST="${SORT_DEST:-/Applications}"
if [ -z "${SORT_DEST:-}" ] && [ ! -w "$DEST" ]; then DEST="$HOME/Applications"; fi
mkdir -p "$DEST" || die "Could not create $DEST."

# the old copy goes to the Trash rather than being deleted in place,
# which macOS refuses for the inside of an app bundle
if [ -e "$DEST/SORT.app" ]; then
  mkdir -p "$HOME/.Trash"
  mv "$DEST/SORT.app" "$HOME/.Trash/SORT $(date +%Y%m%d-%H%M%S).app" || die "Could not move the old SORT out of the way. Quit SORT and run this again."
fi

say "Installing into $DEST"
ditto "$MNT/SORT.app" "$DEST/SORT.app"
xattr -dr com.apple.quarantine "$DEST/SORT.app" 2>/dev/null || true

say "SORT $VER is installed. Opening it now."
open "$DEST/SORT.app"
