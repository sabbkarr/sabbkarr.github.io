/* =====================================================================
   site.js — the only script the site needs (no framework, no build).
   ---------------------------------------------------------------------
   - Mobile menu, light/dark toggle (remembered per browser)
   - Scrape-resistant email links
   - Renders research, news, projects, publications and blog from the
     JSON files in data/ and the Markdown posts in blog/content/

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
  function fmtMonth(s) {
    var d = parseDate(s);
    if (!d) return esc(s);
    if (!/^\d{4}-\d{1,2}/.test(s)) return String(d.getFullYear());
    return MON[d.getMonth()] + " " + d.getFullYear();
  }
  function byDateDesc(key) { return function (a, b) { return (parseDate(b[key]) || 0) - (parseDate(a[key]) || 0); }; }
  function uniq(a) { return a.filter(function (v, i) { return v != null && v !== "" && a.indexOf(v) === i; }); }
  function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function linkItems(links) {
    var arr = !links ? [] : Array.isArray(links) ? links : Object.keys(links).map(function (k) { return { label: k, url: links[k] }; });
    return arr.filter(function (l) { return l && safeUrl(l.url); })
      .map(function (l) { return '<a href="' + esc(safeUrl(l.url)) + '">' + esc(l.label) + "</a>"; });
  }
  function firstUrl(links) {
    var arr = Array.isArray(links) ? links : [];
    for (var i = 0; i < arr.length; i++) if (safeUrl(arr[i].url)) return safeUrl(arr[i].url);
    return "";
  }
  function tagList(words, plain) {
    words = (words || []).filter(function (w) { return !isPlaceholder(w); });
    return words.length ? '<ul class="taglist">' + words.map(function (w) { return '<li><span class="tag' + (plain ? " plain" : "") + '">' + esc(w) + "</span></li>"; }).join("") + "</ul>" : "";
  }
  function fail(el, err) {
    el.innerHTML = '<p class="notice">Could not load this list (' + esc(err.message) + "). If you opened the file from disk, preview through a local web server instead (see README).</p>";
    if (window.console) console.error(err);
  }
  function filterButtons(box, values, current, onPick, allLabel) {
    box.innerHTML = ['<button type="button" class="filter" data-v="" aria-pressed="' + !current + '">' + esc(allLabel || "all") + "</button>"]
      .concat(values.map(function (v) { return '<button type="button" class="filter" data-v="' + esc(v) + '" aria-pressed="' + (current === v) + '">' + esc(v) + "</button>"; })).join("");
    box.addEventListener("click", function (e) {
      var b = e.target.closest(".filter");
      if (!b) return;
      box.querySelectorAll(".filter").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      onPick(b.getAttribute("data-v"));
    });
  }

  /* ---------- mobile menu ---------- */
  var sidebar = document.querySelector(".sidebar");
  var menuBtn = document.querySelector(".nav-toggle");
  if (sidebar && menuBtn) {
    menuBtn.addEventListener("click", function () {
      var open = menuBtn.getAttribute("aria-expanded") === "true";
      menuBtn.setAttribute("aria-expanded", String(!open));
      sidebar.classList.toggle("is-open", !open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menuBtn.getAttribute("aria-expanded") === "true") {
        menuBtn.setAttribute("aria-expanded", "false");
        sidebar.classList.remove("is-open");
        menuBtn.focus();
      }
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
    var label = btn.querySelector(".theme-label");
    function sync() {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      btn.setAttribute("aria-label", "Switch to " + next + " appearance");
      if (label) label.textContent = next;
    }
    sync();
    btn.addEventListener("click", function () {
      var next = effectiveTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* storage unavailable: still switches for this page */ }
      sync();
    });
  });

  /* ---------- email (assembled at runtime; not in the HTML source) ---------- */
  document.querySelectorAll("[data-email-user][data-email-domain]").forEach(function (el) {
    var u = el.getAttribute("data-email-user"), d = el.getAttribute("data-email-domain");
    if (isPlaceholder(u) || isPlaceholder(d)) return;
    var a = document.createElement("a");
    a.href = "mailto:" + u + "@" + d;
    a.textContent = el.hasAttribute("data-email-label") ? el.getAttribute("data-email-label") : u + "@" + d;
    el.replaceChildren(a);
  });
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- renderers ---------- */
  var R = {};

  // Home: numbered research directions + interests line
  R.directions = function (el) {
    var interests = document.getElementById("interests");
    getJSON("data/research.json").then(function (data) {
      if (interests && data.interests && data.interests.length) interests.textContent = data.interests.join(" · ");
      el.innerHTML = (data.directions || []).map(function (d) {
        return '<li class="direction"><div><h3><a href="research.html#' + esc(slug(d.name)) + '">' + esc(d.name) + "</a></h3>" +
          "<p>" + esc(d.summary || d.description) + "</p></div></li>";
      }).join("");
    }).catch(function (e) { fail(el, e); });
  };

  R.research = function (el) {
    getJSON("data/research.json").then(function (data) {
      el.innerHTML = '<ol class="directions">' + (data.directions || []).map(function (d) {
        var links = linkItems(d.links);
        return '<li class="direction" id="' + esc(slug(d.name)) + '"><div><h2 class="entry-title">' + esc(d.name) + "</h2>" +
          '<p class="entry-text">' + esc(d.description) + "</p>" + tagList(d.keywords) +
          (links.length ? '<div class="actions">' + links.join("") + "</div>" : "") + "</div></li>";
      }).join("") + "</ol>";
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
    }).catch(function (e) { fail(el, e); });
  };

  R.news = function (el) {
    var limit = parseInt(el.getAttribute("data-limit"), 10) || 0;
    getJSON("data/news.json").then(function (data) {
      var items = (data.news || []).slice().sort(byDateDesc("date"));
      if (limit) items = items.slice(0, limit);
      if (!items.length) { el.innerHTML = '<p class="notice">No news yet.</p>'; return; }
      el.innerHTML = '<ul class="timeline">' + items.map(function (n) {
        var u = safeUrl(n.url);
        var head = u ? '<a href="' + esc(u) + '">' + esc(n.headline) + "</a>" : esc(n.headline);
        return '<li class="tl-item"><time datetime="' + esc(n.date) + '">' + fmtMonth(n.date) + "</time><span>" + head + (n.detail ? " " + esc(n.detail) : "") + "</span></li>";
      }).join("") + "</ul>";
    }).catch(function (e) { fail(el, e); });
  };

  R.projects = function (el) {
    getJSON("data/projects.json").then(function (data) {
      var items = (data.projects || []).slice().sort(function (a, b) {
        return ((parseDate(b.end) || new Date(9999, 0)) - (parseDate(a.end) || new Date(9999, 0))) || ((parseDate(b.start) || 0) - (parseDate(a.start) || 0));
      });
      el.innerHTML = '<ul class="entries">' + items.map(function (p) {
        var dates = p.start ? fmtMonth(p.start) + " – " + (p.end ? fmtMonth(p.end) : "present") : "";
        var ongoing = p.start && !p.end ? '<span class="tag">ongoing</span>' : "";
        var u = firstUrl(p.links), links = linkItems(p.links);
        var title = u ? '<a href="' + esc(u) + '">' + esc(p.title) + "</a>" : esc(p.title);
        return '<li class="entry"><p class="entry-kicker"><span>' + dates + "</span>" + ongoing + "</p>" +
          '<h2 class="entry-title">' + title + "</h2>" +
          '<p class="entry-text">' + esc(p.description) + "</p>" + tagList(p.methods, true) +
          (links.length ? '<div class="actions">' + links.join("") + "</div>" : "") + "</li>";
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
      return me && a.replace(/[*†]/g, "").toLowerCase() === me ? '<span class="me">' + esc(a) + "</span>" : esc(a);
    }).join(", ");
  }
  var uid = 0;
  function pubHTML(p, me, opts) {
    var u = firstUrl(p.links), links = linkItems(p.links);
    var title = u ? '<a href="' + esc(u) + '">' + esc(p.title) + "</a>" : esc(p.title);
    var abs = p.abstract && !isPlaceholder(p.abstract) && !opts.compact ? p.abstract : "";
    var id = "abs-" + (++uid);
    var actions = [];
    if (abs) actions.push('<button type="button" class="toggle-abs" aria-expanded="false" aria-controls="' + id + '">abstract</button>');
    actions = actions.concat(opts.compact ? [] : links);
    var kicker = [esc(p.venue || "")].concat(p.year && opts.showYear ? [esc(p.year)] : []).join(" · ");
    return '<li class="entry"><p class="entry-kicker"><span>' + kicker + "</span>" + (p.note ? '<span class="tag">' + esc(p.note) + "</span>" : "") + "</p>" +
      '<h3 class="entry-title">' + title + "</h3>" +
      '<p class="entry-authors">' + authorsHTML(p.authors, me) + "</p>" +
      (actions.length ? '<div class="actions">' + actions.join("") + "</div>" : "") +
      (abs ? '<p class="abstract" id="' + id + '" hidden>' + esc(abs) + "</p>" : "") + "</li>";
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".toggle-abs");
    if (!b) return;
    var open = b.getAttribute("aria-expanded") === "true";
    b.setAttribute("aria-expanded", String(!open));
    document.getElementById(b.getAttribute("aria-controls")).hidden = open;
  });

  R["selected-papers"] = function (el) {
    var limit = parseInt(el.getAttribute("data-limit"), 10) || 5;
    loadPubs().then(function (d) {
      var sel = d.pubs.filter(function (p) { return p.selected; });
      if (!sel.length) sel = d.pubs;
      sel = sel.slice(0, limit);
      if (!sel.length) { el.innerHTML = '<p class="notice">No papers yet.</p>'; return; }
      el.innerHTML = '<ul class="entries">' + sel.map(function (p) { return pubHTML(p, d.me, { compact: true, showYear: true }); }).join("") + "</ul>";
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
      function draw() {
        var shown = pubs.filter(function (p) {
          if (state.f && p.type !== state.f && (p.topics || []).indexOf(state.f) < 0) return false;
          if (!state.q) return true;
          return [p.title, p.venue, p.year, p.abstract, [].concat(p.authors || []).join(" ")].join(" ").toLowerCase().indexOf(state.q) >= 0;
        });
        count.textContent = shown.length + (shown.length === 1 ? " paper" : " papers");
        if (!shown.length) { el.innerHTML = '<p class="notice">No papers match.</p>'; return; }
        var html = "", last = null;
        shown.forEach(function (p) {
          var y = String(p.year || "Upcoming");
          if (y !== last) { html += (last === null ? "" : "</ul>") + '<h2 class="year-head">' + esc(y) + '</h2><ul class="entries">'; last = y; }
          html += pubHTML(p, d.me, {});
        });
        el.innerHTML = html + "</ul>";
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
  function postItem(p, href) {
    return '<li class="tl-item"><time datetime="' + esc(p.meta.date) + '">' + fmtMonth(p.meta.date) + "</time><div>" +
      '<h3 class="tl-title"><a href="' + href + '">' + esc(p.meta.title || p.slug) + "</a></h3>" +
      (p.meta.summary ? "<p>" + esc(p.meta.summary) + "</p>" : "") + "</div></li>";
  }

  R["recent-posts"] = function (el) {
    var limit = parseInt(el.getAttribute("data-limit"), 10) || 3;
    loadPosts().then(function (posts) {
      posts = posts.slice(0, limit);
      if (!posts.length) { var sec = el.closest("section"); if (sec) sec.hidden = true; return; }
      el.innerHTML = '<ul class="timeline">' + posts.map(function (p) { return postItem(p, ROOT + "blog/posts/" + esc(p.slug) + ".html"); }).join("") + "</ul>";
    }).catch(function (e) { fail(el, e); });
  };

  R["blog-index"] = function (el) {
    var bar = document.getElementById("tag-filter");
    var count = document.getElementById("post-count");
    loadPosts().then(function (posts) {
      var tags = uniq([].concat.apply([], posts.map(function (p) { return p.meta.tags; }))).sort();
      var cur = new URLSearchParams(location.search).get("tag") || "";
      if (tags.indexOf(cur) < 0) cur = "";
      if (tags.length) filterButtons(bar, tags, cur, function (v) {
        cur = v;
        var url = new URL(location.href);
        if (v) url.searchParams.set("tag", v); else url.searchParams.delete("tag");
        history.replaceState(null, "", url);
        draw();
      });
      function draw() {
        var shown = posts.filter(function (p) { return !cur || p.meta.tags.indexOf(cur) >= 0; });
        count.textContent = shown.length + (shown.length === 1 ? " post" : " posts");
        if (!shown.length) { el.innerHTML = '<p class="notice">No posts yet. Check back soon.</p>'; return; }
        el.innerHTML = '<ul class="timeline">' + shown.map(function (p) { return postItem(p, "posts/" + esc(p.slug) + ".html"); }).join("") + "</ul>";
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
      document.getElementById("post-meta").innerHTML = '<time datetime="' + esc(m.date) + '">' + fmtMonth(m.date) + "</time>" +
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
