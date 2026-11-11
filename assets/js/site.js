/* =====================================================================
   site.js — the only script the site needs.
   ---------------------------------------------------------------------
   - Mobile nav toggle
   - Scrape-resistant email links
   - Renders the list pages from the JSON files in /data and /blog
   - Renders blog posts from Markdown (needs marked.js on post pages)

   Each page tells this script two things on <body>:
     data-root  relative path back to the site root ("" or "../../")
     data-page  which renderer to run (home, research, news, ...)
   Data is loaded with fetch(), so preview the site through a local web
   server (see README) rather than by double-clicking the HTML files.
   ===================================================================== */
(function () {
  "use strict";

  var body = document.body;
  var ROOT = body.getAttribute("data-root") || "";

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // Allow only http(s), mailto and relative URLs in data-driven links.
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ""; // javascript:, data:, etc.
    return u.charAt(0) === "/" || u.charAt(0) === "#" ? u : ROOT + u;
  }
  function isPlaceholder(v) { return !v || /^\[\[.*\]\]$/.test(String(v).trim()); }
  function getJSON(path) {
    return fetch(ROOT + path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " (" + r.status + ")");
      return r.json();
    });
  }
  function getText(path) {
    return fetch(ROOT + path, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(path + " (" + r.status + ")");
      return r.text();
    });
  }
  // "2026-03-07" -> Date in local time (avoids the UTC off-by-one).
  function parseDate(s) {
    var m = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(String(s || ""));
    if (!m) return null;
    return new Date(+m[1], (m[2] || 1) - 1, m[3] || 1);
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(s, withDay) {
    var d = parseDate(s);
    if (!d) return esc(s);
    var hasDay = /^\d{4}-\d{1,2}-\d{1,2}/.test(s);
    var hasMonth = /^\d{4}-\d{1,2}/.test(s);
    if (!hasMonth) return String(d.getFullYear());
    return (withDay !== false && hasDay ? MONTHS[d.getMonth()] + " " + d.getDate() + ", " : MONTHS[d.getMonth()] + " ") + d.getFullYear();
  }
  function linksHTML(links) {
    if (!links) return "";
    // Accept [{label, url}] or {label: url}
    var arr = Array.isArray(links) ? links : Object.keys(links).map(function (k) { return { label: k, url: links[k] }; });
    var items = arr.filter(function (l) { return l && l.url && !isPlaceholder(l.url) && safeUrl(l.url); })
      .map(function (l) { return '<li><a href="' + esc(safeUrl(l.url)) + '">' + esc(l.label) + "</a></li>"; });
    return items.length ? '<ul class="entry-links">' + items.join("") + "</ul>" : "";
  }
  function tagsHTML(tags, tagHref) {
    if (!tags || !tags.length) return "";
    return '<ul class="tags" aria-label="Tags">' + tags.map(function (t) {
      return tagHref
        ? '<li><a class="tag" href="' + esc(tagHref(t)) + '">' + esc(t) + "</a></li>"
        : '<li><span class="tag">' + esc(t) + "</span></li>";
    }).join("") + "</ul>";
  }
  function showError(el, err) {
    el.innerHTML = '<p class="notice">Could not load this list (' + esc(err.message) +
      "). If you opened the file directly from disk, preview the site through a local web server instead (see README).</p>";
    if (window.console) console.error(err);
  }
  function chips(container, values, current, onPick, allLabel) {
    var html = '<button type="button" class="chip" data-v="" aria-pressed="' + (!current) + '">' + esc(allLabel || "All") + "</button>";
    values.forEach(function (v) {
      html += '<button type="button" class="chip" data-v="' + esc(v) + '" aria-pressed="' + (current === v) + '">' + esc(v) + "</button>";
    });
    container.innerHTML = html;
    container.onclick = function (e) {
      var b = e.target.closest("button.chip");
      if (!b) return;
      container.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", String(c === b)); });
      onPick(b.getAttribute("data-v"));
    };
  }
  function uniq(arr) { return arr.filter(function (v, i) { return v != null && v !== "" && arr.indexOf(v) === i; }); }

  /* ---------- nav toggle ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("is-open", !open);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        toggle.setAttribute("aria-expanded", "false");
        nav.classList.remove("is-open");
        toggle.focus();
      }
    });
  }

  /* ---------- email (assembled at runtime so it isn't in the HTML) ---------- */
  document.querySelectorAll("[data-email-user][data-email-domain]").forEach(function (el) {
    var addr = el.getAttribute("data-email-user") + "@" + el.getAttribute("data-email-domain");
    var a = document.createElement("a");
    a.href = "mailto:" + addr;
    a.textContent = addr;
    el.replaceChildren(a);
  });

  /* ---------- footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- research (data/research.json) ---------- */
  function renderResearch(el) {
    getJSON("data/research.json").then(function (data) {
      var items = data.directions || [];
      el.innerHTML = '<ul class="entries">' + items.map(function (d) {
        return '<li class="entry"><h2 class="entry-title">' + esc(d.name) + "</h2>" +
          "<p>" + esc(d.description) + "</p>" + tagsHTML(d.keywords) + linksHTML(d.links) + "</li>";
      }).join("") + "</ul>";
    }).catch(function (e) { showError(el, e); });
  }

  /* ---------- news (data/news.json) ---------- */
  function renderNews(el) {
    var limit = parseInt(el.getAttribute("data-limit"), 10) || 0;
    getJSON("data/news.json").then(function (data) {
      var items = (data.news || []).slice().sort(function (a, b) { return (parseDate(b.date) || 0) - (parseDate(a.date) || 0); });
      if (limit) items = items.slice(0, limit);
      if (!items.length) { el.innerHTML = '<p class="muted">No news yet.</p>'; return; }
      el.innerHTML = '<ul class="entries news-list">' + items.map(function (n) {
        var headline = n.url && !isPlaceholder(n.url) && safeUrl(n.url)
          ? '<a href="' + esc(safeUrl(n.url)) + '">' + esc(n.headline) + "</a>" : esc(n.headline);
        return '<li class="entry"><time datetime="' + esc(n.date) + '">' + fmtDate(n.date, false) + "</time><span>" + headline + "</span></li>";
      }).join("") + "</ul>";
    }).catch(function (e) { showError(el, e); });
  }

  /* ---------- projects (data/projects.json) ---------- */
  function renderProjects(el) {
    getJSON("data/projects.json").then(function (data) {
      var items = (data.projects || []).slice().sort(function (a, b) {
        return (parseDate(b.end || "9999") - parseDate(a.end || "9999")) || (parseDate(b.start) - parseDate(a.start));
      });
      el.innerHTML = '<ul class="entries">' + items.map(function (p) {
        var dates = p.start ? fmtDate(p.start, false) + " – " + (p.end ? fmtDate(p.end, false) : "present") : "";
        return '<li class="entry"><h2 class="entry-title">' + esc(p.title) + "</h2>" +
          (dates ? '<p class="entry-meta">' + dates + "</p>" : "") +
          "<p>" + esc(p.description) + "</p>" +
          (p.methods && p.methods.length ? '<p class="small muted">Methods &amp; tools: ' + p.methods.map(esc).join(", ") + "</p>" : "") +
          linksHTML(p.links) + "</li>";
      }).join("") + "</ul>";
    }).catch(function (e) { showError(el, e); });
  }

  /* ---------- publications (data/publications.json) ---------- */
  function renderPublications(el) {
    var yearSel = document.getElementById("pub-year");
    var typeBox = document.getElementById("pub-types");
    var count = document.getElementById("pub-count");
    getJSON("data/publications.json").then(function (data) {
      var me = data.highlight_author && !isPlaceholder(data.highlight_author) ? data.highlight_author : "";
      var pubs = (data.publications || []).slice().sort(function (a, b) {
        return (+b.year || 0) - (+a.year || 0) || String(a.title).localeCompare(String(b.title));
      });
      var state = { year: "", type: "" };
      var years = uniq(pubs.map(function (p) { return String(p.year || ""); }));
      var types = uniq(pubs.map(function (p) { return p.type || ""; })).sort();

      yearSel.innerHTML = '<option value="">All years</option>' + years.map(function (y) { return '<option value="' + esc(y) + '">' + esc(y) + "</option>"; }).join("");
      yearSel.onchange = function () { state.year = yearSel.value; draw(); };
      chips(typeBox, types, "", function (v) { state.type = v; draw(); });

      function authors(list) {
        var arr = Array.isArray(list) ? list : String(list || "").split(/\s+and\s+|,\s*(?=[A-Z])/);
        return arr.map(function (a) {
          a = String(a).trim();
          return me && a.toLowerCase() === me.toLowerCase() ? '<span class="me">' + esc(a) + "</span>" : esc(a);
        }).join(", ");
      }
      function draw() {
        var shown = pubs.filter(function (p) {
          return (!state.year || String(p.year) === state.year) && (!state.type || p.type === state.type);
        });
        count.textContent = shown.length + (shown.length === 1 ? " publication" : " publications");
        if (!shown.length) { el.innerHTML = '<p class="muted">No publications match this filter.</p>'; return; }
        var html = "", lastYear = null;
        shown.forEach(function (p) {
          if (String(p.year) !== lastYear) {
            if (lastYear !== null) html += "</ul>";
            lastYear = String(p.year);
            html += '<h2 class="year-heading">' + esc(p.year || "Undated") + '</h2><ul class="entries">';
          }
          html += '<li class="entry"><p class="entry-title">' + esc(p.title) + "</p>" +
            '<p class="pub-authors">' + authors(p.authors) + "</p>" +
            '<p class="entry-meta"><span class="pub-venue">' + esc(p.venue) + "</span>" +
            (p.year ? ", " + esc(p.year) : "") + (p.note ? ' · <span class="pub-note">' + esc(p.note) + "</span>" : "") + "</p>" +
            linksHTML(p.links) + "</li>";
        });
        el.innerHTML = html + "</ul>";
      }
      draw();
    }).catch(function (e) { showError(el, e); });
  }

  /* ---------- blog: front matter ---------- */
  // Parses a small YAML subset: `key: value`, `tags: [a, b]` or `tags: a, b`.
  function parsePost(text) {
    var meta = {}, bodyText = text;
    var m = /^﻿?---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/.exec(text);
    if (m) {
      bodyText = text.slice(m[0].length);
      m[1].split(/\r?\n/).forEach(function (line) {
        var kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
        if (!kv) return;
        var v = kv[2].trim().replace(/^["'](.*)["']$/, "$1");
        meta[kv[1]] = v;
      });
    }
    var t = meta.tags || "";
    meta.tags = t.replace(/^\[|\]$/g, "").split(",").map(function (s) { return s.trim().replace(/^["']|["']$/g, ""); }).filter(Boolean);
    meta.draft = /^(true|yes)$/i.test(meta.draft || "");
    return { meta: meta, body: bodyText };
  }

  function renderBlogIndex(el) {
    var tagBox = document.getElementById("tag-filter");
    var count = document.getElementById("post-count");
    getJSON("blog/index.json").then(function (idx) {
      var slugs = idx.posts || [];
      return Promise.all(slugs.map(function (slug) {
        return getText("blog/content/" + slug + ".md").then(function (t) {
          var p = parsePost(t); p.slug = slug; return p;
        }).catch(function () { return null; });
      }));
    }).then(function (posts) {
      posts = posts.filter(function (p) { return p && !p.meta.draft; })
        .sort(function (a, b) { return (parseDate(b.meta.date) || 0) - (parseDate(a.meta.date) || 0); });
      var allTags = uniq([].concat.apply([], posts.map(function (p) { return p.meta.tags; }))).sort();
      var current = new URLSearchParams(location.search).get("tag") || "";
      if (allTags.indexOf(current) < 0) current = "";

      chips(tagBox, allTags, current, function (v) {
        current = v;
        var url = new URL(location.href);
        if (v) url.searchParams.set("tag", v); else url.searchParams.delete("tag");
        history.replaceState(null, "", url);
        draw();
      }, "All posts");

      function draw() {
        var shown = posts.filter(function (p) { return !current || p.meta.tags.indexOf(current) >= 0; });
        count.textContent = shown.length + (shown.length === 1 ? " post" : " posts") + (current ? " tagged “" + current + "”" : "");
        if (!shown.length) { el.innerHTML = '<p class="muted">No posts yet.</p>'; return; }
        el.innerHTML = '<ul class="entries">' + shown.map(function (p) {
          return '<li class="entry"><h2 class="entry-title"><a href="posts/' + esc(p.slug) + '.html">' + esc(p.meta.title || p.slug) + "</a></h2>" +
            '<p class="entry-meta"><time datetime="' + esc(p.meta.date) + '">' + fmtDate(p.meta.date) + "</time></p>" +
            (p.meta.summary ? "<p>" + esc(p.meta.summary) + "</p>" : "") +
            tagsHTML(p.meta.tags, function (t) { return "?tag=" + encodeURIComponent(t); }) + "</li>";
        }).join("") + "</ul>";
      }
      draw();
    }).catch(function (e) { showError(el, e); });
  }

  function renderBlogPost(el) {
    var slug = body.getAttribute("data-slug");
    getText("blog/content/" + slug + ".md").then(function (text) {
      var p = parsePost(text), m = p.meta;
      document.title = (m.title || slug) + " · " + (document.title.split(" · ").pop());
      document.getElementById("post-title").textContent = m.title || slug;
      var meta = document.getElementById("post-meta");
      meta.innerHTML = '<time datetime="' + esc(m.date) + '">' + fmtDate(m.date) + "</time>";
      document.getElementById("post-tags").innerHTML =
        tagsHTML(m.tags, function (t) { return ROOT + "blog/index.html?tag=" + encodeURIComponent(t); });
      if (window.marked) {
        el.innerHTML = window.marked.parse(p.body);
        // Rewrite relative image/link paths in posts so they resolve from blog/content/
        el.querySelectorAll("img[src], a[href]").forEach(function (n) {
          var attr = n.tagName === "IMG" ? "src" : "href";
          var v = n.getAttribute(attr);
          if (v && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(v)) n.setAttribute(attr, ROOT + "blog/content/" + v);
          if (n.tagName === "IMG" && !n.hasAttribute("alt")) n.setAttribute("alt", "");
        });
      } else {
        el.innerHTML = "<pre>" + esc(p.body) + "</pre>";
      }
    }).catch(function (e) { showError(el, e); });
  }

  /* ---------- dispatch ---------- */
  document.querySelectorAll("[data-render]").forEach(function (el) {
    switch (el.getAttribute("data-render")) {
      case "research": renderResearch(el); break;
      case "news": renderNews(el); break;
      case "projects": renderProjects(el); break;
      case "publications": renderPublications(el); break;
      case "blog-index": renderBlogIndex(el); break;
      case "blog-post": renderBlogPost(el); break;
    }
  });
})();
