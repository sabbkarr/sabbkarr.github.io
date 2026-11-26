# sabbkarr.github.io

Personal academic site. Plain HTML, one stylesheet, one small script. No framework and no build step; GitHub Pages serves the files as they are.

Design: a minimal Swiss-style layout (Geist type, large name and research question, hairline list rows, light/dark toggle), modeled on the look of ndrsn0208.github.io and written from scratch.

Live at **https://sabbkarr.github.io**

## File tree

```
.
├── index.html              Home: name, research question, topic tabs, intro, news, selected papers, recent posts
├── research.html           Research directions        ← data/research.json
├── bio.html                Biography + summary box     (edit the HTML directly)
├── news.html               Dated news list             ← data/news.json
├── projects.html           Project entries             ← data/projects.json
├── publications.html       Papers, year/type filters   ← data/publications.json
├── contact.html            Email (scrape-resistant), profiles, CV
├── 404.html                Not-found page
├── .nojekyll               Tells GitHub Pages to serve files as-is (no Jekyll)
├── assets/
│   ├── css/style.css       All styling; colors, fonts, spacing are CSS variables at the top
│   ├── js/site.js          Theme toggle, email, and renderers for every data-driven list
│   ├── fonts/              Geist variable font (self-hosted, SIL OFL)
│   ├── img/                favicon.svg, headshot (optional)
│   └── cv/                 put cv.pdf here
├── data/
│   ├── site.json           Global placeholders (name, links, email) → tools/fill_placeholders.py
│   ├── research.json
│   ├── news.json
│   ├── projects.json
│   └── publications.json
├── blog/
│   ├── index.html          Post list with tag filter
│   ├── index.json          Which posts are published (list of slugs)
│   ├── content/            One Markdown file per post (+ images/)
│   │   └── _template.md
│   └── posts/              One small HTML shell per post
│       └── _template.html
└── tools/                  Optional helpers (Python 3, standard library only)
    ├── fill_placeholders.py
    ├── new_post.py
    └── scholar_to_json.py
```

## Preview locally

The lists are loaded with `fetch()`, which browsers block for files opened straight from disk. From the repository root run:

```bash
python3 -m http.server 8000
```

then open http://localhost:8000.

## Editing content

Every placeholder looks like `[[SOMETHING]]`. To see what's left:

```bash
python3 tools/fill_placeholders.py --dry-run
```

**1. Global details (once).** Fill in `data/site.json` (name, short title, affiliation, profile URLs, and your email split at the `@`), then run:

```bash
python3 tools/fill_placeholders.py
```

This replaces those placeholders in every page header, footer and link.

**2. Prose pages.** Edit the HTML directly; each editable block has an `<!-- EDIT: ... -->` comment.
- `index.html`: research question and the two intro paragraphs (topic tabs and the "Research interests" line come from `data/research.json`)
- `research.html`: the overview sentence (the directions themselves are in `data/research.json`: `short` is the home-page tab label, `summary` the one line shown under it)
- `bio.html`: the large statement sentence, bio paragraphs, education, experience, service. To add a photo, save it as `assets/img/headshot.jpg`, uncomment the `<img>` line and write real alt text.
- `contact.html`: contact note and location

**3. Lists.** Edit the JSON files in `data/`. Each has a `_comment` describing its fields. Entries are sorted automatically, so add new items anywhere. Links left empty or as `[[...]]` are hidden. JSON is strict: use double quotes and no trailing commas. `python3 -m json.tool data/news.json` will tell you if a file is broken.

**4. CV.** Save it as `assets/cv/cv.pdf`, then uncomment the CV links in each page's footer and in `contact.html` (search for `cv.pdf`).

**Blog on the home page.** The Blog section on the home page hides itself until there is at least one published post.

**Publications on the home page.** Set `"selected": true` on the papers to feature under "Selected papers" (if none are marked, the newest are shown). Optional `topics` (list) become filters on the Papers page alongside the type, and `abstract` is shown when a paper's + is opened.

**Theme.** All colors, fonts and spacing are CSS variables at the top of `assets/css/style.css`. The dark palette is in the `prefers-color-scheme: dark` block (and repeated under `[data-theme="dark"]`). The ◐ button switches light/dark and remembers the choice in the visitor's browser. The accent blue is `--accent`. To change the font, edit `--font-sans`.

## Adding a blog post

Quick way:

```bash
python3 tools/new_post.py my-post-slug "My post title"
```

By hand (three steps):

1. Copy `blog/content/_template.md` to `blog/content/my-post-slug.md` and write the post. The front matter at the top sets `title`, `date` (YYYY-MM-DD), `tags` (`[a, b]`), `summary`, and optional `draft: true` to hide it.
2. Copy `blog/posts/_template.html` to `blog/posts/my-post-slug.html` and change `data-slug="_template"` to `data-slug="my-post-slug"`.
3. Add `"my-post-slug"` to the `posts` list in `blog/index.json`.

Images: put them in `blog/content/images/` and reference them as `![alt text](images/file.png)`.

Posts are rendered in the browser with [marked.js](https://marked.js.org) from jsDelivr, the only third-party resource on the site (the Geist font is self-hosted). Post HTML is not sanitized, which is fine because only you write posts; don't paste untrusted HTML into them.

## Updating publications from Google Scholar

1. Open your Google Scholar profile while signed in.
2. Tick the checkbox at the top of the article list to select all (use "Show more" first if the list is paged).
3. Click **Export** and choose **BibTeX** (preferred) or **CSV**. Save the file, e.g. `citations.bib`.
4. From the repository root:

   ```bash
   python3 tools/scholar_to_json.py citations.bib --me "Your Name As In Author Lists"
   ```

The script rewrites `data/publications.json` and keeps a `.bak` copy. For papers already in the file it keeps the links, notes and type you set by hand, and it keeps papers you added manually that aren't in the export. It guesses each paper's `type` (conference, journal, workshop, preprint, thesis, other) from the venue, so check those, and add `links` (paper, arXiv, code, slides) yourself, since Scholar's export doesn't include them.

You can also skip the script and edit `data/publications.json` by hand.

## Deployment (GitHub Pages)

The repository must be named exactly `sabbkarr.github.io` under the `sabbkarr` account for the site to be served at the root URL.

First time:

```bash
git init -b main
git add .
git commit -m "Initial site"
git remote add origin https://github.com/sabbkarr/sabbkarr.github.io.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.** The first deploy takes a minute or two; the Actions tab shows its progress.

After that, every push to `main` redeploys:

```bash
git add -A && git commit -m "Update news" && git push
```

All internal links are relative, so the same files also work from a subpath (e.g. a project site at `/<repo>/`). The one exception is `404.html`, which uses root-absolute links because GitHub serves it at whatever URL was missing.

## Accessibility and privacy notes

- Skip-to-content link, semantic landmarks, visible focus outlines, `aria-current` on the active nav item, arrow-key topic tabs, labelled expand buttons.
- Text contrast meets WCAG AA in both light and dark modes.
- No analytics, trackers or cookies. The only stored value is the light/dark choice (localStorage).
- Your email address never appears whole in the HTML; it's assembled by JavaScript when the page loads.
