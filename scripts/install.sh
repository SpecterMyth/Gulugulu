#!/usr/bin/env bash
set -euo pipefail

REPOSITORY="SpecterMyth/Gulugulu"
LATEST_RELEASE_API="https://api.github.com/repos/${REPOSITORY}/releases/latest"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if ! command_exists curl; then
  echo "curl is required to download Gulugulu releases." >&2
  exit 1
fi

if ! command_exists python3; then
  echo "python3 is required to parse GitHub release metadata." >&2
  exit 1
fi

OS_NAME="$(uname -s)"
TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

echo "Fetching latest Gulugulu release..."
curl -fsSL -H "User-Agent: Gulugulu-Installer" "$LATEST_RELEASE_API" -o "$TMP_JSON"

ASSET_INFO="$(python3 - "$TMP_JSON" "$OS_NAME" <<'PY'
import json
import sys

path, os_name = sys.argv[1], sys.argv[2]
with open(path, "r", encoding="utf-8") as handle:
    release = json.load(handle)

assets = release.get("assets", [])
if os_name == "Darwin":
    extensions = [".dmg"]
elif os_name == "Linux":
    extensions = [".AppImage", ".deb"]
else:
    extensions = []

for extension in extensions:
    for asset in assets:
        name = asset.get("name", "")
        if name.endswith(extension) and not name.endswith(".sig"):
            print(name)
            print(asset.get("browser_download_url", ""))
            raise SystemExit(0)

raise SystemExit(1)
PY
)" || {
  echo "No installer asset for ${OS_NAME} was found in the latest release." >&2
  echo "Open https://github.com/${REPOSITORY}/releases/latest or build from source with INSTALL.md." >&2
  exit 1
}

ASSET_NAME="$(printf '%s\n' "$ASSET_INFO" | sed -n '1p')"
ASSET_URL="$(printf '%s\n' "$ASSET_INFO" | sed -n '2p')"
DOWNLOAD_PATH="${TMPDIR:-/tmp}/${ASSET_NAME}"

echo "Downloading ${ASSET_NAME}..."
curl -fL -H "User-Agent: Gulugulu-Installer" "$ASSET_URL" -o "$DOWNLOAD_PATH"

case "$DOWNLOAD_PATH" in
  *.dmg)
    echo "Downloaded macOS installer: $DOWNLOAD_PATH"
    echo "Open the DMG and drag Gulugulu into Applications."
    if command_exists open; then
      open "$DOWNLOAD_PATH"
    fi
    ;;
  *.AppImage)
    chmod +x "$DOWNLOAD_PATH"
    echo "Downloaded Linux AppImage: $DOWNLOAD_PATH"
    echo "Run it with: $DOWNLOAD_PATH"
    ;;
  *.deb)
    echo "Downloaded Debian package: $DOWNLOAD_PATH"
    if command_exists sudo && command_exists dpkg; then
      sudo dpkg -i "$DOWNLOAD_PATH" || sudo apt-get install -f -y
    else
      echo "Install it with: sudo dpkg -i \"$DOWNLOAD_PATH\""
    fi
    ;;
  *)
    echo "Downloaded installer: $DOWNLOAD_PATH"
    ;;
esac
