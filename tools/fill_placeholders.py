#!/usr/bin/env python3
"""Replace global [[KEY]] placeholders in every .html file with the values in data/site.json.

Usage (from the repository root):
    python3 tools/fill_placeholders.py            # apply
    python3 tools/fill_placeholders.py --dry-run  # show what would change

Keys with empty values are skipped. Placeholders that remain afterwards are listed
so you can find what still needs editing by hand.
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
values = {k: v for k, v in json.loads((root / "data/site.json").read_text()).items()
          if not k.startswith("_") and str(v).strip()}
dry = "--dry-run" in sys.argv
remaining = {}
for path in sorted(root.rglob("*.html")):
    if ".git" in path.parts:
        continue
    text = original = path.read_text(encoding="utf-8")
    for key, val in values.items():
        text = text.replace(f"[[{key}]]", str(val))
    if text != original:
        print(("would update " if dry else "updated ") + str(path.relative_to(root)))
        if not dry:
            path.write_text(text, encoding="utf-8")
    for m in re.findall(r"\[\[([^\]]+)\]\]", text):
        remaining.setdefault(m.split(" — ")[0], set()).add(str(path.relative_to(root)))
if remaining:
    print("\nPlaceholders still to fill in by hand:")
    for k in sorted(remaining):
        print(f"  [[{k}]]  in {', '.join(sorted(remaining[k]))}")
