#!/bin/bash
# Installs Liner Notes on a Chromebook, in ChromeOS's Linux (Settings > About ChromeOS > Developers > Linux development
# environment), or on any other Debian-based Linux: Debian 12 or later, Ubuntu 22.04 or later, Linux Mint 21 or later.
# In the Terminal app (its "penguin" tab):
#
#   curl -fsSL https://crowlemdev.github.io/Liner-Notes-Builds/install-chromebook.sh | bash
#
# It checks this Linux can run it (an Intel or AMD processor, Debian 12 or later), downloads the newest Linux build from
# crowlemdev/Liner-Notes-Builds, checks its SHA-256, and installs it with apt. On a Chromebook it also makes ~/Music the
# Music folder you share with Linux, where it can. From then on Liner Notes updates itself, with no password.
#
#   --release     the newest full release (by default the newest build, Beta's included, as the app's Beta channel)
#   --uninstall   takes Liner Notes away (your library, settings and listening history stay)
set -euo pipefail

repo="crowlemdev/Liner-Notes-Builds"
channel=beta
case "${1:-}" in
    "") ;;
    --release) channel=release ;;
    --uninstall)
        sudo apt-get remove -y liner-notes </dev/null
        echo "Liner Notes is gone. Your library, settings and listening history stay in ~/.local/share/liner-notes."
        exit 0
        ;;
    *)
        echo "usage: install-chromebook.sh [--release | --uninstall]" >&2
        exit 2
        ;;
esac

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
stop() {
    printf '\n\033[1mLiner Notes cannot be installed here.\033[0m\n' >&2
    printf '%s\n' "$@" >&2
    exit 1
}

chromebook=false
if [ -d /opt/google/cros-containers ] || [ -d /mnt/chromeos ]; then chromebook=true; fi
here="this computer"
if $chromebook; then here="this Chromebook"; fi

say "Liner Notes for Linux"

if ! command -v apt-get >/dev/null 2>&1 || ! command -v dpkg >/dev/null 2>&1; then
    stop "It needs a Debian-based Linux, with apt: Debian, Ubuntu, Linux Mint, or ChromeOS's Linux."
fi

arch=$(dpkg --print-architecture)
if [ "$arch" != amd64 ]; then
    stop "The processor in $here is an ARM one ($arch). Liner Notes for Linux is built for Intel and AMD" \
        "processors (amd64) only, for now."
fi

glibc=$(getconf GNU_LIBC_VERSION 2>/dev/null | awk '{print $2}')
if ! dpkg --compare-versions "${glibc:-0}" ge 2.35; then
    system=$( (. /etc/os-release && echo "${PRETTY_NAME:-}") 2>/dev/null || true)
    if $chromebook; then
        stop "ChromeOS's Linux here is ${system:-an older Debian}, and Liner Notes needs Debian 12 (bookworm) or later." \
            "In ChromeOS: Settings > About ChromeOS > Developers > Linux development environment. Choose Upgrade if it" \
            "is offered. If not, back up what you keep in Linux, remove Linux and turn it on again: it is set up with" \
            "Debian 12. Then run this again."
    else
        stop "This Linux is ${system:-too old} (glibc ${glibc:-unknown}). Liner Notes needs Debian 12, Ubuntu 22.04 or" \
            "Linux Mint 21, or later."
    fi
fi

for tool in curl sudo; do
    command -v "$tool" >/dev/null 2>&1 || stop "It needs $tool: sudo apt-get install $tool, then run this again."
done

say "Finding the newest build"
releases=$(curl -fsSL -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$repo/releases?per_page=100") ||
    stop "GitHub could not be reached. Check the network, and run this again."

# The newest linux-build-N with its .deb: its address, its SHA-256 and its name.
if command -v python3 >/dev/null 2>&1; then
    found=$(printf '%s' "$releases" | python3 -c '
import json, re, sys
channel, best = sys.argv[1], None
for r in json.load(sys.stdin):
    m = re.fullmatch(r"linux-build-(\d+)", r.get("tag_name") or "")
    if not m or r.get("draft") or (channel == "release" and r.get("prerelease")):
        continue
    for a in r.get("assets") or []:
        if re.fullmatch(r"liner-notes_[0-9.]+_amd64\.deb", a.get("name") or "") and a.get("state") == "uploaded":
            if best is None or int(m.group(1)) > best[0]:
                digest = (a.get("digest") or "").replace("sha256:", "") or "-"
                best = (int(m.group(1)), a["browser_download_url"], digest, a["name"])
if best:
    print(best[1], best[2], best[3])
' "$channel")
else
    # Without Python: the newest .deb GitHub lists (any channel), its SHA-256 left unchecked.
    url=$(printf '%s' "$releases" | grep -o '"browser_download_url": *"[^"]*/linux-build-[0-9]*/liner-notes_[0-9.]*_amd64\.deb"' |
        head -1 | sed 's/.*"\(https[^"]*\)"$/\1/')
    found=${url:+"$url - ${url##*/}"}
fi
[ -n "$found" ] || stop "No Linux build is published yet$([ $channel = release ] && echo " as a full release; run this without --release for the newest Beta build")."
read -r url sha name <<<"$found"
version=$(printf '%s' "$name" | sed 's/^liner-notes_\(.*\)_amd64\.deb$/\1/')

say "Downloading Liner Notes $version"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
chmod 755 "$work"  # apt reads the package as its own user
curl -fL --progress-bar -o "$work/$name" "$url" || stop "The download stopped. Run this again."
chmod 644 "$work/$name"
if [ "$sha" != "-" ]; then
    echo "$sha  $work/$name" | sha256sum -c --quiet - >/dev/null 2>&1 ||
        stop "The download is not the build GitHub lists (its SHA-256 differs). Run this again."
    note "SHA-256 checked"
fi

say "Installing (apt may ask for your password)"
# Their input from nowhere: piped into bash, a command that reads its input would read the rest of this script.
sudo apt-get update -qq </dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "$work/$name" </dev/null

if $chromebook; then
    say "Your music"
    shared=/mnt/chromeos/MyFiles
    if [ -d "$shared/Music" ] && [ ! -e "$HOME/Music" ]; then
        ln -s "$shared/Music" "$HOME/Music"
        note "Liner Notes reads your Chromebook's Music folder (shared with Linux) as ~/Music."
    elif [ -d "$shared/Music" ]; then
        note "Your Chromebook's Music folder is shared with Linux: add /mnt/chromeos/MyFiles/Music in Liner Notes"
        note "(its first steps, or Settings > Library > Folders)."
    else
        note "In the Files app, right-click the folder your music is in and choose Share with Linux."
        note "It shows in Liner Notes under /mnt/chromeos/MyFiles: add it in its first steps,"
        note "or in Settings > Library > Folders."
    fi
fi

say "Liner Notes $version is installed"
if $chromebook; then
    note "Open it from the launcher: it is in the Linux apps folder."
else
    note "Open it from the applications menu, or run: liner-notes"
fi
note "It updates itself from now on, with no password."
