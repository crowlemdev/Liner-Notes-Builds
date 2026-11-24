# Liner Notes builds

The built apps of Liner Notes, a personal music player, as releases: the Mac app (`mac-build-N`, Liner-Notes.zip), the Android app (`android-build-N`, Liner-Notes.apk) and the Linux app (`linux-build-N`, a .deb for Debian, Mint and Ubuntu, `liner-notes_<version>_amd64.deb`, and Liner-Notes-linux-x86_64.tar.gz for any other distribution), each with its update.json.

## On a Chromebook

`docs/install-chromebook.sh` installs the newest Linux build in ChromeOS's Linux (Debian 12 or later, Intel or AMD), or on
any Debian-based Linux: `curl -fsSL https://crowlemdev.github.io/Liner-Notes-Builds/install-chromebook.sh | bash` in the
Terminal app. It stops with what to do where the Linux cannot run it (an ARM processor, Debian 11), checks the download's
SHA-256, installs it with apt, and makes `~/Music` the Music folder shared with Linux. `--release` takes the newest full
release rather than Beta's, and `--uninstall` takes the app away.

## Download page

[crowlemdev.github.io/Liner-Notes-Builds](https://crowlemdev.github.io/Liner-Notes-Builds/) is the download page, served by GitHub Pages from `docs/` on `main`. Its buttons look up the newest `mac-build-N`, `android-build-N` and `linux-build-N` releases (prereleases skipped), so a new build shows up there with nothing to change; for Linux, the .deb is found by its name's pattern and the tarball by its name. All three are offered; the page is laid out Android first, and a Mac or Linux visitor gets their own button and panel first. The page links to no list of builds (if GitHub cannot be reached, each button opens a search of its own platform's releases). The page is set in the Liner Notes design system: `docs/assets/liner-notes.css` holds its tokens and components, `docs/assets/site.css` the layout. Its display type is Newsreader, as in the apps. The app screenshots in the gallery under the hero are in `docs/assets/screens/`, each as WebP at 640 and 1280 px tall (the recap cards under Stats at 360 and 720); to swap one, keep its name and update its `width`, `height` and `--r` in `docs/index.html`. The minimum systems on the page (macOS 14, Android 9, and Linux Mint 21, Debian 12 and Ubuntu 22.04, which is glibc 2.35 and GTK 4.6) come from each build's `update.json`; change them in `docs/index.html` if a build raises them.
