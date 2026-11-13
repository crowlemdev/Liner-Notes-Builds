/*
  Liner Notes site.
  Finds the newest published Mac and Android builds in this repository's
  releases (tags mac-build-N and android-build-N; prereleases and drafts are
  skipped) and points the download buttons at their files. Without JavaScript,
  or if GitHub cannot be reached, each button keeps its link to a list of its
  own platform's builds; the page links to no other list of builds.
*/
(function () {
  "use strict";

  var REPO = "crowlemdev/Liner-Notes-Builds";
  var API = "https://api.github.com/repos/" + REPO + "/releases?per_page=100";
  var CACHE_KEY = "ln-builds-v1";
  var CACHE_MS = 10 * 60 * 1000; // GitHub allows 60 unauthenticated calls an hour per visitor
  var PLATFORMS = {
    mac: { prefix: "mac-build-", asset: "Liner-Notes.zip" },
    android: { prefix: "android-build-", asset: "Liner-Notes.apk" }
  };

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
  }

  /* A Mac visitor gets the Mac first: the page is laid out Android first */
  function preferPlatform() {
    var ua = navigator.userAgent || "";
    var touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // an iPad asking for the desktop site
    if (!/Macintosh/.test(ua) || touchMac) return;

    var actions = document.querySelector(".hero-actions");
    var mac = actions && actions.querySelector('[data-download="mac"]');
    var android = actions && actions.querySelector('[data-download="android"]');
    if (mac && android) {
      android.classList.replace("ln-btn-primary", "ln-btn-secondary");
      mac.classList.replace("ln-btn-secondary", "ln-btn-primary");
      actions.insertBefore(mac, android);
    }
    var platforms = document.querySelector(".platforms");
    var panel = platforms && platforms.querySelector('[data-platform="mac"]');
    if (panel) platforms.insertBefore(panel, platforms.firstElementChild);
  }

  /* The newest build per platform, by build number */
  function pick(releases) {
    var out = {};
    Object.keys(PLATFORMS).forEach(function (key) {
      var p = PLATFORMS[key];
      var best = null;
      (releases || []).forEach(function (r) {
        if (!r || r.draft || r.prerelease || typeof r.tag_name !== "string") return;
        if (r.tag_name.indexOf(p.prefix) !== 0) return;
        var build = Number(r.tag_name.slice(p.prefix.length));
        if (!Number.isInteger(build)) return;
        var file = (r.assets || []).filter(function (a) {
          return a.name === p.asset && a.state === "uploaded";
        })[0];
        if (!file || (best && best.build >= build)) return;
        var version = /\b(\d+\.\d+\.\d+)\b/.exec(r.name || "");
        best = {
          build: build,
          version: version ? version[1] : null,
          url: file.browser_download_url,
          size: file.size,
          sha256: typeof file.digest === "string" ? file.digest.replace(/^sha256:/, "") : null,
          date: r.published_at
        };
      });
      if (best) out[key] = best;
    });
    return out;
  }

  function readCache() {
    try {
      var saved = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (saved && Date.now() - saved.at < CACHE_MS) return saved.builds;
    } catch (e) { /* storage blocked or empty */ }
    return null;
  }
  function writeCache(builds) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), builds: builds })); } catch (e) { /* ignore */ }
  }

  function ask() {
    return fetch(API, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("GitHub answered " + res.status);
        return res.json();
      });
  }

  function load() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return ask()
      .catch(function () { // one more try after a short pause, for a passing network blip
        return new Promise(function (resolve) { setTimeout(resolve, 1500); }).then(ask);
      })
      .then(function (releases) {
        var builds = pick(releases);
        if (builds.mac || builds.android) writeCache(builds);
        return builds;
      });
  }

  function megabytes(bytes) {
    return typeof bytes === "number" ? (bytes / 1e6).toFixed(1) + " MB" : null;
  }
  function day(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return null;
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
  }

  function showFallback(key) {
    each('[data-spec="' + key + '"]', function (el) {
      el.textContent = "Build details unavailable just now";
    });
  }

  function render(builds) {
    Object.keys(PLATFORMS).forEach(function (key) {
      var b = builds[key];
      if (!b) return showFallback(key);
      each('[data-download="' + key + '"]', function (a) { a.href = b.url; });
      each('[data-spec="' + key + '"]', function (el) {
        el.textContent = [b.version && "Version " + b.version, megabytes(b.size), day(b.date)]
          .filter(Boolean).join(" · ");
      });
      if (b.sha256) {
        each('[data-sha="' + key + '"]', function (el) {
          el.querySelector("code").textContent = b.sha256;
          el.hidden = false;
        });
      }
    });
  }

  /* Gallery: the apps' page names switch the screenshot, as in the apps */
  function setupScreens() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.screen-tabs [role="tab"]'));
    if (!tabs.length) return;

    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, false); });
      tab.addEventListener("keydown", function (e) {
        var next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });

    select(tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0], false);

    // Fetch the other screenshots once the page has loaded, so switching is instant
    var warm = function () { each(".screen img", function (img) { img.loading = "eager"; }); };
    if (document.readyState === "complete") warm();
    else window.addEventListener("load", warm);
  }

  function start() {
    setupScreens();
    preferPlatform();
    var fallBack = function () { Object.keys(PLATFORMS).forEach(showFallback); };
    if (!window.fetch || !window.Promise) return fallBack();
    load().then(render, fallBack);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
