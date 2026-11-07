# Liner Notes builds

The built apps of Liner Notes, a personal music player, as releases: the Mac app (`mac-build-N`, Liner-Notes.zip) and the Android app (`android-build-N`, Liner-Notes.apk), each with its update.json.

## Download page

[crowlemdev.github.io/Liner-Notes-Builds](https://crowlemdev.github.io/Liner-Notes-Builds/) is the download page, served by GitHub Pages from `docs/` on `main`. Its buttons look up the newest `mac-build-N` and `android-build-N` releases (prereleases skipped), so a new build shows up there with nothing to change. The page is set in the Liner Notes design system: `docs/assets/liner-notes.css` holds its tokens and components, `docs/assets/site.css` the layout. Its display type is Newsreader, as in the apps. The app screenshots in the gallery under the hero are in `docs/assets/screens/`, each as WebP at 640 and 1280 px tall; to swap one, keep its name and update its `width`, `height` and `--r` in `docs/index.html`. The minimum systems on the page (macOS 14, Android 9) come from each build's `update.json`; change them in `docs/index.html` if a build raises them.
