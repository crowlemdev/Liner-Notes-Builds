/*
  Liner Notes site.
  Finds the newest published Mac and Android builds in this repository's
  releases (tags mac-build-N and android-build-N; prereleases and drafts are
  skipped) and points the download buttons at their files. Without JavaScript,
  or if GitHub cannot be reached, the Android buttons keep their link to a list
  of the Android builds alone; the page links to no other list of builds.

  The same releases fill the Release notes section: published releases (not
  prereleases or drafts) from version 1.1 on, newest first, a page at a time.
  The section stays hidden until there is a note to show.
*/
(function () {
  "use strict";

  var REPO = "crowlemdev/Liner-Notes-Builds";
  var PER_PAGE = 100;
  var API = "https://api.github.com/repos/" + REPO + "/releases?per_page=" + PER_PAGE;
  var MAX_PAGES = 5; // of releases asked for, at most, to find older release notes
  var CACHE_KEY = "ln-site-v2";
  var CACHE_MS = 10 * 60 * 1000; // GitHub allows 60 unauthenticated calls an hour per visitor
  var PLATFORMS = {
    // The Mac app is coming soon: the page has no Mac download buttons yet,
    // so this entry fills nothing until they return to index.html.
    mac: { prefix: "mac-build-", asset: "Liner-Notes.zip", label: "Mac" },
    android: { prefix: "android-build-", asset: "Liner-Notes.apk", label: "Android" }
  };
  var NOTES = {
    // Add "mac" when the Mac download goes live, and name both platforms in
    // the section header in index.html; each note then names its platform.
    platforms: ["android"],
    from: [1, 1], // the first major and minor version with notes on the page
    perPage: 10
  };

  function each(selector, fn) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), fn);
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

  /* Published releases with notes, from NOTES.from on, newest first */
  function pickNotes(releases) {
    var out = [];
    (releases || []).forEach(function (r) {
      if (!r || r.draft || r.prerelease || typeof r.tag_name !== "string") return;
      NOTES.platforms.forEach(function (key) {
        var p = PLATFORMS[key];
        if (r.tag_name.indexOf(p.prefix) !== 0) return;
        var build = Number(r.tag_name.slice(p.prefix.length));
        var v = /\b(\d+)\.(\d+)\.(\d+)\b/.exec(r.name || "");
        if (!Number.isInteger(build) || !v) return;
        var major = Number(v[1]), minor = Number(v[2]);
        if (major < NOTES.from[0] || (major === NOTES.from[0] && minor < NOTES.from[1])) return;
        out.push({
          platform: key,
          build: build,
          version: v[0],
          date: r.published_at,
          html: typeof r.body_html === "string" ? r.body_html : null,
          text: typeof r.body === "string" ? r.body : ""
        });
      });
    });
    return out.sort(function (a, b) {
      return String(b.date || "").localeCompare(String(a.date || "")) || b.build - a.build;
    });
  }

  function readCache() {
    try {
      var saved = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (saved && Date.now() - saved.at < CACHE_MS && saved.data) return saved.data;
    } catch (e) { /* storage blocked or empty */ }
    return null;
  }
  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* ignore */ }
  }

  function ask(page) {
    // "full" adds each release's notes as HTML (body_html) beside the Markdown
    return fetch(API + "&page=" + page, { headers: { Accept: "application/vnd.github.full+json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("GitHub answered " + res.status);
        return res.json();
      })
      .then(function (releases) {
        if (!Array.isArray(releases)) throw new Error("GitHub answered with no list");
        return releases;
      });
  }

  /* The first page of releases, then older pages for as long as each one still
     brings release notes, is full, and MAX_PAGES is not reached. A later page
     that fails keeps what is in hand. */
  function askAll() {
    var all = [];
    function next(page) {
      return ask(page).then(function (releases) {
        all = all.concat(releases);
        if (releases.length < PER_PAGE || page >= MAX_PAGES || !pickNotes(releases).length) return all;
        return next(page + 1).catch(function () { return all; });
      });
    }
    return next(1);
  }

  function load() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return askAll()
      .catch(function () { // one more try after a short pause, for a passing network blip
        return new Promise(function (resolve) { setTimeout(resolve, 1500); }).then(askAll);
      })
      .then(function (releases) {
        var data = { builds: pick(releases), notes: pickNotes(releases) };
        if (data.builds.mac || data.builds.android) writeCache(data);
        return data;
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

  /* ---- Release notes ---- */

  // Elements a note keeps, and what each becomes. Headings become bold
  // paragraphs, under the page's own headings. Any other element gives up its
  // text and keeps none of its attributes; those in DROP give up nothing.
  var KEEP = {
    P: "p", UL: "ul", OL: "ol", LI: "li", BR: "br", BLOCKQUOTE: "blockquote",
    PRE: "pre", CODE: "code", STRONG: "strong", B: "strong", EM: "em", I: "em",
    DEL: "del", S: "del", A: "a",
    H1: "p", H2: "p", H3: "p", H4: "p", H5: "p", H6: "p"
  };
  var DROP = /^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT|IFRAME|FRAME|OBJECT|EMBED|SVG|MATH|IMG|PICTURE|VIDEO|AUDIO|CANVAS|INPUT|BUTTON|SELECT|TEXTAREA|FORM|LINK|META|HEAD|TITLE)$/;
  // The build's last line ("Commit 480bca4238 on release/1.1.") is for the developer
  var BUILD_LINE = /^Commit [0-9a-f]{7,40} on \S+$/;

  function clean(from, into) {
    Array.prototype.forEach.call(from.childNodes, function (node) {
      if (node.nodeType === 3) { into.appendChild(document.createTextNode(node.nodeValue)); return; }
      if (node.nodeType !== 1) return;
      var tag = node.nodeName.toUpperCase();
      if (DROP.test(tag)) return;
      var name = KEEP[tag];
      var href = name === "a" ? node.getAttribute("href") || "" : "";
      if (!name || (name === "a" && !/^https?:\/\//i.test(href))) { clean(node, into); return; }
      var el = document.createElement(name);
      if (/^H[1-6]$/.test(tag)) el.className = "note-heading";
      if (name === "a") {
        el.href = href;
        el.className = "ln-link is-accent";
        el.rel = "noopener noreferrer";
      }
      clean(node, el);
      into.appendChild(el);
    });
  }

  function noteBody(note) {
    var doc = document.implementation.createHTMLDocument("");
    var src = doc.body;
    if (note.html) {
      src = new DOMParser().parseFromString(note.html, "text/html").body;
    } else { // Markdown shown as plain text, a paragraph per block
      note.text.split(/\n\s*\n/).forEach(function (block) {
        var p = doc.createElement("p");
        p.textContent = block.trim();
        if (p.textContent) src.appendChild(p);
      });
    }
    Array.prototype.slice.call(src.children).forEach(function (el) {
      if (BUILD_LINE.test(el.textContent.trim().replace(/\.$/, ""))) src.removeChild(el);
    });
    var out = document.createDocumentFragment();
    clean(src, out);
    if (!out.textContent.trim()) {
      var none = document.createElement("p");
      none.className = "meta";
      none.textContent = "No notes for this release.";
      out = document.createDocumentFragment();
      out.appendChild(none);
    }
    return out;
  }

  function setupNotes(notes) {
    var section = document.querySelector("[data-notes]");
    if (!section || !notes || !notes.length) return;
    var list = section.querySelector("[data-notes-list]");
    var pager = section.querySelector("[data-notes-pager]");
    var newer = section.querySelector("[data-notes-newer]");
    var older = section.querySelector("[data-notes-older]");
    var status = section.querySelector("[data-notes-status]");
    var pages = Math.ceil(notes.length / NOTES.perPage);
    var named = NOTES.platforms.length > 1;
    var current = 0;

    function show(page, fromPager) {
      var focused = document.activeElement;
      current = page;
      var rows = document.createDocumentFragment();
      notes.slice(page * NOTES.perPage, (page + 1) * NOTES.perPage).forEach(function (note) {
        var dt = document.createElement("dt");
        var version = document.createElement("span");
        version.className = "note-version";
        version.textContent = (named ? PLATFORMS[note.platform].label + " " : "") + note.version;
        dt.appendChild(version);
        var when = day(note.date);
        if (when) {
          var time = document.createElement("time");
          time.className = "note-date";
          time.dateTime = note.date;
          time.textContent = when;
          dt.appendChild(time);
        }
        var dd = document.createElement("dd");
        dd.appendChild(noteBody(note));
        rows.appendChild(dt);
        rows.appendChild(dd);
      });
      list.textContent = "";
      list.appendChild(rows);

      pager.hidden = pages < 2;
      newer.disabled = page === 0;
      older.disabled = page === pages - 1;
      status.textContent = "Page " + (page + 1) + " of " + pages;

      if (!fromPager) return;
      // A button that has just turned off hands the focus to the other one
      if (focused === newer && newer.disabled) older.focus();
      if (focused === older && older.disabled) newer.focus();
      // Start the new page at its top when the old one was scrolled past
      if (section.getBoundingClientRect().top < 0) {
        var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        section.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      }
    }

    newer.addEventListener("click", function () { if (current > 0) show(current - 1, true); });
    older.addEventListener("click", function () { if (current < pages - 1) show(current + 1, true); });
    show(0, false);
    section.hidden = false;
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
    var fallBack = function () { Object.keys(PLATFORMS).forEach(showFallback); };
    if (!window.fetch || !window.Promise) return fallBack();
    load().then(function (data) {
      render(data.builds || {});
      try { setupNotes(data.notes); } catch (e) { /* the notes stay hidden; the downloads still work */ }
    }, fallBack);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
