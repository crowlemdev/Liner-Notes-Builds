# Liner Notes builds

The built apps of Liner Notes, a personal music player, as releases: the Mac app (`mac-build-N`, Liner-Notes.zip), the Android app (`android-build-N`, Liner-Notes.apk) and the Linux app (`linux-build-N`, Liner-Notes-linux-x86_64.tar.gz and liner-notes_<version>_amd64.deb), each with its update.json. Each app updates itself from here. No source code is kept here.

## Liner Notes for Linux

For Linux Mint 21 and 22, Ubuntu 22.04 and later, and Debian 12 and 13, on x86_64. From the newest `linux-build-N` release, either:

- for every user of the computer: `sudo apt install ./liner-notes_<version>_amd64.deb` (apt fetches what it needs), or
- for yourself alone, with no password: unpack `Liner-Notes-linux-x86_64.tar.gz` and run `liner-notes/install.sh`.

Either way it updates itself from then on, with no password asked.
