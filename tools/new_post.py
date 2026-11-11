#!/usr/bin/env python3
"""Create a new blog post skeleton.

Usage (from the repository root):
    python3 tools/new_post.py my-post-slug "My post title"

Creates blog/content/<slug>.md and blog/posts/<slug>.html, and adds the slug to
blog/index.json. Edit the Markdown file afterwards. Doing these three steps by
hand works just as well (see README).
"""
import datetime, json, pathlib, re, sys

if len(sys.argv) < 2:
    sys.exit(__doc__)
slug = sys.argv[1].strip().lower()
if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
    sys.exit("Slug must use lowercase letters, digits and hyphens only.")
title = sys.argv[2] if len(sys.argv) > 2 else slug.replace("-", " ").capitalize()
root = pathlib.Path(__file__).resolve().parent.parent
md = root / "blog/content" / f"{slug}.md"
page = root / "blog/posts" / f"{slug}.html"
if md.exists() or page.exists():
    sys.exit(f"{slug} already exists.")

md.write_text(f"""---
title: {title}
date: {datetime.date.today().isoformat()}
tags: []
summary:
draft: true
---

Write your post here in Markdown. Set draft: false when it's ready.
""", encoding="utf-8")
template = (root / "blog/posts/_template.html").read_text(encoding="utf-8")
page.write_text(template.replace('data-slug="_template"', f'data-slug="{slug}"')
                        .replace("_template.md", f"{slug}.md")
                        .replace("../content/_template", f"../content/{slug}"), encoding="utf-8")
idx_path = root / "blog/index.json"
idx = json.loads(idx_path.read_text())
if slug not in idx["posts"]:
    idx["posts"].append(slug)
idx_path.write_text(json.dumps(idx, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Created {md.relative_to(root)} (draft) and {page.relative_to(root)}; added to blog/index.json.")
