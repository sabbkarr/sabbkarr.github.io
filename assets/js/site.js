/* =====================================================================
   site.js — the only script the site needs (no framework, no build).
   ---------------------------------------------------------------------
   - Light/dark toggle (remembered per browser)
   - Scrape-resistant email links
   - Home: research-topic tabs, news, selected papers, recent posts
   - Renders research, news, projects, publications and blog from JSON/Markdown

   Each page tells this script where the site root is with
   <body data-root="..."> ("" at the root, "../" in blog/, "../../" in posts).
   Data is loaded with fetch(), so preview through a local web server
   (python3 -m http.server) rather than opening the files directly.
   ===================================================================== */
(function () {
  "use strict";

  var ROOT = document.body.getAttribute("data-root") || "";

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function isPlaceholder(v) { return !v || /^\[\[[\s\S]*\]\]$/.test(String(v).trim()); }
  // Only http(s), mailto and relative URLs are allowed in data-driven links.
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!u || isPlaceholder(u)) return "";
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return /^[\/#]/.test(u) ? u : ROOT + u;
  }
  function getJSON(p) { return fetch(ROOT + p, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(p + " (" + r.status + ")"); return r.json(); }); }
  function getText(p) { return fetch(ROOT + p, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(p + " (" + r.status + ")"); return r.text(); }); }
  function parseDate(s) {
    var m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(String(s || ""));
    return m ? new Date(+m[1], (m[2] || 1) - 1, m[3] || 1) : null;
  }
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function fmtMonth(s, long) {
    var d = parseDate(s);
    if (!d) return esc(s);
    if (!/^\d{4}-\d{1,2}/.test(s)) return String(d.getFullYear());
    return (long ? MONTH : MON)[d.getMonth()] + " " + d.getFullYear();
  }
  function byDateDesc(key) { return function (a, b) { return (parseDate(b[key]) || 0) - (parseDate(a[key]) || 0); }; }
  function uniq(a) { return a.filter(function (v, i) { return v != null && v !== "" && a.indexOf(v) === i; }); }
  function linkList(links) {
    if (!links) return "";
    var arr = Array.isArray(links) ? links : Object.keys(links).map(function (k) { return { label: k, url: links[k] }; });
    var items = arr.filter(function (l) { return l && safeUrl(l.url); })
      .map(function (l) { return '<li><a href="' + esc(safeUrl(l.url)) + '">' + esc(l.label) + "</a></li>"; });
    return items.length ? '<ul class="links">' + items.join("") + "</ul>" : "";
  }
  function firstUrl(links) {
    var arr = Array.isArray(links) ? links : [];
    for (var i = 0; i < arr.length; i++) if (safeUrl(arr[i].url)) return safeUrl(arr[i].url);
    return "";
  }
  function chipList(words) {
    words = (words || []).filter(function (w) { return !isPlaceholder(w); });
    return words.length ? '<ul class="chips">' + words.map(function (w) { return '<li class="chip">' + esc(w) + "</li>"; }).join("") + "</ul>" : "";
  }
  function fail(el, err) {
    el.innerHTML = '<p class="notice">Could not load this list (' + esc(err.message) + "). If you opened the file from disk, preview through a local web server instead (see README).</p>";
    if (window.console) console.error(err);
  }
  function filterButtons(box, values, current, onPick, allLabel) {
    box.innerHTML = ['<button type="button" class="filter" data-v="" aria-pressed="' + !current + '">' + esc(allLabel || "All") + "</button>"]
      .concat(values.map(function (v) { return '<button type="button" class="filter" data-v="' + esc(v) + '" aria-pressed="' + (current === v) + '">' + esc(v) + "</button>"; })).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".filter");
      if (!b) return;
      box.querySelectorAll(".filter").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      onPick(b.getAttribute("data-v"));
    });
  }

  /* ---------- theme toggle ---------- */
  var root = document.documentElement;
  function effectiveTheme() {
    var t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    function label() { btn.setAttribute("aria-label", effectiveTheme() === "dark" ? "Switch to light appearance" : "Switch to dark appearance"); }
    label();
    btn.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* storage unavailable: still switches for this page */ }
      label();
      document.dispatchEvent(new CustomEvent("themechange"));
    });
  });

  /* ---------- email (assembled at runtime; not in the HTML source) ---------- */
  document.querySelectorAll("[data-email-user][data-email-domain]").forEach(function (el) {
    var u = el.getAttribute("data-email-user"), d = el.getAttribute("data-email-domain");
    if (isPlaceholder(u) || isPlaceholder(d)) return;
    var a = document.createElement("a");
    a.href = "mailto:" + u + "@" + d;
    a.textContent = u + "@" + d;
    el.replaceChildren(a);
  });
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- renderers ---------- */
  var R = {};

  R.topics = function (el) {
    var note = document.getElementById("topic-note");
    var interests = document.getElementById("interests");
    getJSON("data/research.json").then(function (data) {
      var dirs = data.directions || [];
      if (interests && data.interests && data.interests.length) interests.textContent = data.interests.join(", ") + ".";
      if (!dirs.length) return;
      el.innerHTML = dirs.map(function (d, i) {
        return '<li role="presentation"><button type="button" class="topic" role="tab" id="topic-' + i + '" aria-controls="topic-note" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '">' + esc(d.short || d.name) + "</button></li>";
      }).join("");
      var tabs = [].slice.call(el.querySelectorAll(".topic"));
      function select(i, focus) {
        tabs.forEach(function (b, j) { b.setAttribute("aria-selected", String(i === j)); b.tabIndex = i === j ? 0 : -1; });
        if (focus) tabs[i].focus();
        var d = dirs[i];
        note.setAttribute("aria-labelledby", "topic-" + i);
        note.innerHTML = esc(d.summary || d.description) + ' <a href="research.html#' + esc(slug(d.name)) + '">More</a>';
      }
      el.addEventListener("click", function (e) { var b = e.target.closest(".topic"); if (b) select(tabs.indexOf(b)); });
      el.addEventListener("keydown", function (e) {
        var i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        if (e.key === "ArrowRight") { e.preventDefault(); select((i + 1) % tabs.length, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
      });
      select(0);
    }).catch(function (e) { if (window.console) console.error(e); });
  };
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  R.news = function (el) {
    var limit = parseInt(el.getAttribute("data-limit"), 10) || 0;
    getJSON("data/news.json").then(function (data) {
      var items = (data.news || []).slice().sort(byDateDesc("date"));
      if (limit) items = items.slice(0, limit);
      if (!items.length) { el.innerHTML = '<p class="notice">No news yet.</p>'; return; }
      el.innerHTML = '<ul class="rows news">' + items.map(function (n) {
        var u = safeUrl(n.url);
        var head = u ? '<a href="' + esc(u) + '">' + esc(n.headline) + "</a>" : esc(n.headline);
        return '<li class="row"><span>' + head + (n.detail ? " " + esc(n.detail) : "") + '</span><time class="row-meta" datetime="' + esc(n.date) + '">' + fmtMonth(n.date) + "</time></li>";
      }).join("") + "</ul>";
    }).catch(function (e) { fail(el, e); });
  };

  R.research = function (el) {
    getJSON("data/research.json").then(function (data) {
      el.innerHTML = '<ul class="rows">' + (data.directions || []).map(function (d) {
        return '<li class="row" id="' + esc(slug(d.name)) + '"><h2 class="row-title">' + esc(d.name) + "</h2><span></span>" +
          '<div class="row-body"><p>' + esc(d.description) + "</p>" + chipList(d.keywords) + linkList(d.links) + "</div></li>";
      }).join("") + "</ul>";
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }).catch(function (e) { fail(el, e); });
  };

  R.projects = function (el) {
    getJSON("data/projects.json").then(function (data) {
      var items = (data.projects || []).slice().sort(function (a, b) {
        return ((parseDate(b.end) || new Date(9999, 0)) - (parseDate(a.end) || new Date(9999, 0))) || ((parseDate(b.start) || 0) - (parseDate(a.start) || 0));
      });
      el.innerHTML = '<ul class="rows">' + items.map(function (p) {
        var dates = p.start ? fmtMonth(p.start) + " – " + (p.end ? fmtMonth(p.end) : "present") : "";
        var u = firstUrl(p.links);
        var title = u ? '<a href="' + esc(u) + '">' + esc(p.title) + "</a>" : esc(p.title);
        return '<li class="row"><h2 class="row-title">' + title + '</h2><span class="row-meta">' + dates + "</span>" +
          '<div class="row-body"><p>' + esc(p.description) + "</p>" + chipList(p.methods) + linkList(p.links) + "</div></li>";
      }).join("") + "</ul>";
    }).catch(function (e) { fail(el, e); });
  };

  function loadPubs() {
    return getJSON("data/publications.json").then(function (data) {
      var me = isPlaceholder(data.highlight_author) ? "" : String(data.highlight_author || "").toLowerCase();
      // Papers without a year (in preparation / under review) are listed first.
      var pubs = (data.publications || []).slice().sort(function (a, b) { return (+b.year || 9999) - (+a.year || 9999) || String(a.title).localeCompare(String(b.title)); });
      return { me: me, pubs: pubs };
    });
  }
  function authorsHTML(list, me) {
    var arr = Array.isArray(list) ? list : String(list || "").split(/\s+and\s+|,\s*/);
    return arr.map(function (a) {
      a = String(a).trim();
      var mine = me && a.replace(/[*†]/g, "").toLowerCase() === me;
      return mine ? '<span class="me">' + esc(a) + "</span>" : esc(a);
    }).join(", ");
  }
  function venueLine(p) { return esc([p.venue, p.year].filter(Boolean).join(" ")); }

  R["selected-papers"] = function (el) {
    var limit = parseInt(el.getAttribute("data-limit"), 10) || 6;
    loadPubs().then(function (d) {
      var sel = d.pubs.filter(function (p) { return p.selected; });
      if (!sel.length) sel = d.pubs;
      sel = sel.slice(0, limit);
      if (!sel.length) { el.innerHTML = '<p class="notice">No papers yet.</p>'; return; }
      el.innerHTML = '<ul class="rows">' + sel.map(function (p) {
        var u = firstUrl(p.links) || ROOT + "publications.html";
        return '<li class="row"><h3 class="row-title"><a href="' + esc(u) + '">' + esc(p.title) + '</a></h3><span class="row-meta">' + venueLine(p) + "</span></li>";
      }).join("") + "</ul>";
    }).catch(function (e) { fail(el, e); });
  };

  R.publications = function (el) {
    var search = document.getElementById("pub-search");
    var bar = document.getElementById("pub-filters");
    var count = document.getElementById("pub-count");
    loadPubs().then(function (d) {
      var pubs = d.pubs, state = { q: "", f: "" };
      // Filter row = topics (falls back to types if no paper has topics).
      var facets = uniq([].concat.apply([], pubs.map(function (p) { return p.topics || []; }))).filter(function (v) { return !isPlaceholder(v); });
      if (!facets.length) facets = uniq(pubs.map(function (p) { return p.type; }));
      filterButtons(bar, facets, "", function (v) { state.f = v; draw(); });
      search.addEventListener("input", function () { state.q = search.value.trim().toLowerCase(); draw(); });
      el.addEventListener("click", function (e) {
        var b = e.target.closest(".expand");
        if (!b) return;
        var open = b.getAttribute("aria-expanded") === "true";
        b.setAttribute("aria-expanded", String(!open));
        document.getElementById(b.getAttribute("aria-controls")).hidden = open;
      });
      var PLUS = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>';
      function draw() {
        var shown = pubs.filter(function (p) {
          if (state.f && p.type !== state.f && (p.topics || []).indexOf(state.f) < 0) return false;
          if (!state.q) return true;
          var hay = [p.title, p.venue, p.year, p.abstract, [].concat(p.authors || []).join(" ")].join(" ").toLowerCase();
          return hay.indexOf(state.q) >= 0;
        });
        count.textContent = shown.length + (shown.length === 1 ? " paper" : " papers");
        if (!shown.length) { el.innerHTML = '<p class="notice">No papers match.</p>'; return; }
        var groups = [], byYear = {};
        shown.forEach(function (p) { var y = String(p.year || "In prep."); if (!byYear[y]) { byYear[y] = []; groups.push(y); } byYear[y].push(p); });
        el.innerHTML = groups.map(function (y) {
          return '<section class="year-group" aria-label="' + esc(y) + '"><div class="year-label">' + esc(y) + '</div><ul class="rows">' +
            byYear[y].map(function (p) {
              var i = pubs.indexOf(p), u = firstUrl(p.links);
              var title = u ? '<a href="' + esc(u) + '">' + esc(p.title) + "</a>" : esc(p.title);
              var hasDetail = (p.abstract && !isPlaceholder(p.abstract)) || linkList(p.links);
              return '<li class="row"><h2 class="row-title">' + title + "</h2>" +
                '<span class="row-meta">' + esc(p.venue || "") + (p.note ? '<span class="pub-note">' + esc(p.note) + "</span>" : "") + "</span>" +
                (hasDetail ? '<button type="button" class="expand" aria-expanded="false" aria-controls="pub-' + i + '" aria-label="Details for ' + esc(p.title) + '">' + PLUS + "</button>" : "<span></span>") +
                '<div class="row-body"><p class="who">' + authorsHTML(p.authors, d.me) + "</p></div>" +
                (hasDetail ? '<div class="pub-detail" id="pub-' + i + '" hidden>' + (p.abstract && !isPlaceholder(p.abstract) ? "<p>" + esc(p.abstract) + "</p>" : "") + linkList(p.links) + "</div>" : "") +
                "</li>";
            }).join("") + "</ul></section>";
        }).join("");
      }
      draw();
    }).catch(function (e) { fail(el, e); });
  };

  /* ---------- blog ---------- */
  function parsePost(text) {
    var meta = {}, body = text;
    var m = /^﻿?---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(text);
    if (m) {
      body = text.slice(m[0].length);
      m[1].split(/\r?\n/).forEach(function (line) {
        var kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (kv) meta[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, "$1");
      });
    }
    meta.tags = (meta.tags || "").replace(/^\[|\]$/g, "").split(",").map(function (s) { return s.trim().replace(/^["']|["']$/g, ""); }).filter(Boolean);
    meta.draft = /^(true|yes)$/i.test(meta.draft || "");
    return { meta: meta, body: body };
  }
  function loadPosts() {
    return getJSON("blog/index.json").then(function (idx) {
      return Promise.all((idx.posts || []).map(function (s) {
        return getText("blog/content/" + s + ".md").then(function (t) { var p = parsePost(t); p.slug = s; return p; }).catch(function () { return null; });
      }));
    }).then(function (posts) {
      return posts.filter(function (p) { return p && !p.meta.draft; }).sort(function (a, b) { return (parseDate(b.meta.date) || 0) - (parseDate(a.meta.date) || 0); });
    });
  }

  R["recent-posts"] = function (el) {
    var limit = parseInt(el.getAttribute("data-limit"), 10) || 4;
    loadPosts().then(function (posts) {
      posts = posts.slice(0, limit);
      if (!posts.length) { var sec = el.closest("section"); if (sec) sec.hidden = true; return; }
      el.innerHTML = '<ul class="rows">' + posts.map(function (p) {
        return '<li class="row"><h3 class="row-title"><a href="' + ROOT + "blog/posts/" + esc(p.slug) + '.html">' + esc(p.meta.title || p.slug) + '</a></h3><time class="row-meta" datetime="' + esc(p.meta.date) + '">' + fmtMonth(p.meta.date, true) + "</time></li>";
      }).join("") + "</ul>";
    }).catch(function (e) { fail(el, e); });
  };

  R["blog-index"] = function (el) {
    var bar = document.getElementById("tag-filter");
    var count = document.getElementById("post-count");
    loadPosts().then(function (posts) {
      var tags = uniq([].concat.apply([], posts.map(function (p) { return p.meta.tags; }))).sort();
      var cur = new URLSearchParams(location.search).get("tag") || "";
      if (tags.indexOf(cur) < 0) cur = "";
      filterButtons(bar, tags, cur, function (v) {
        cur = v;
        var url = new URL(location.href);
        if (v) url.searchParams.set("tag", v); else url.searchParams.delete("tag");
        history.replaceState(null, "", url);
        draw();
      });
      function draw() {
        var shown = posts.filter(function (p) { return !cur || p.meta.tags.indexOf(cur) >= 0; });
        count.textContent = shown.length + (shown.length === 1 ? " post" : " posts");
        if (!shown.length) { el.innerHTML = '<p class="notice">No posts yet.</p>'; return; }
        el.innerHTML = '<ul class="rows">' + shown.map(function (p) {
          return '<li class="row"><h2 class="row-title"><a href="posts/' + esc(p.slug) + '.html">' + esc(p.meta.title || p.slug) + '</a></h2><time class="row-meta" datetime="' + esc(p.meta.date) + '">' + fmtMonth(p.meta.date, true) + "</time>" +
            '<div class="row-body">' + (p.meta.summary ? "<p>" + esc(p.meta.summary) + "</p>" : "") + chipList(p.meta.tags) + "</div></li>";
        }).join("") + "</ul>";
      }
      draw();
    }).catch(function (e) { fail(el, e); });
  };

  R["blog-post"] = function (el) {
    var s = document.body.getAttribute("data-slug");
    getText("blog/content/" + s + ".md").then(function (text) {
      var p = parsePost(text), m = p.meta;
      document.title = (m.title || s) + " · " + document.title.split(" · ").pop();
      document.getElementById("post-title").textContent = m.title || s;
      document.getElementById("post-meta").innerHTML = '<time datetime="' + esc(m.date) + '">' + fmtMonth(m.date, true) + "</time>" +
        (m.tags.length ? " · " + m.tags.map(function (t) { return '<a href="' + ROOT + "blog/index.html?tag=" + encodeURIComponent(t) + '">' + esc(t) + "</a>"; }).join(", ") : "");
      if (window.marked) {
        el.innerHTML = window.marked.parse(p.body);
        el.querySelectorAll("img[src], a[href]").forEach(function (n) {
          var attr = n.tagName === "IMG" ? "src" : "href", v = n.getAttribute(attr);
          if (v && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(v)) n.setAttribute(attr, ROOT + "blog/content/" + v);
          if (n.tagName === "IMG" && !n.hasAttribute("alt")) n.setAttribute("alt", "");
        });
      } else {
        el.innerHTML = "<pre>" + esc(p.body) + "</pre>";
      }
    }).catch(function (e) { fail(el, e); });
  };

  document.querySelectorAll("[data-render]").forEach(function (el) {
    var fn = R[el.getAttribute("data-render")];
    if (fn) fn(el);
  });
})();
