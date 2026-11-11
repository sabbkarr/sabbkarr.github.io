#!/usr/bin/env python3
"""Convert a Google Scholar export (BibTeX or CSV) into data/publications.json.

Usage (from the repository root):
    python3 tools/scholar_to_json.py citations.bib
    python3 tools/scholar_to_json.py citations.csv --me "A. B. Lastname"

What it does:
  - Reads every entry (title, authors, venue, year).
  - Guesses `type` (conference / journal / workshop / preprint / thesis / other)
    from the BibTeX entry type and venue name. Check and correct these by hand.
  - KEEPS any links, notes, or types you already edited in data/publications.json
    for papers with the same title, so re-importing never erases your work.
  - Writes the merged list back to data/publications.json (a .bak copy is saved).

Only the Python standard library is used.
"""
import argparse, csv, json, pathlib, re, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/publications.json"


def norm(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())


def clean(s):
    s = re.sub(r"\\[a-zA-Z]+\s*", "", s or "")    # LaTeX commands
    s = s.replace("{", "").replace("}", "").replace("\\&", "&")
    return re.sub(r"\s+", " ", s).strip()


def split_authors(s):
    parts = re.split(r"\s+and\s+", s) if " and " in s else s.split(";") if ";" in s else s.split(",")
    out = []
    for p in parts:
        p = clean(p)
        if not p or p.lower() in ("others", "..."):
            continue
        if "," in p:  # "Last, First" -> "First Last"
            last, first = [x.strip() for x in p.split(",", 1)]
            p = f"{first} {last}".strip()
        out.append(p)
    return out


def guess_type(entry_type, venue):
    v = (venue or "").lower()
    if "arxiv" in v or "biorxiv" in v or "preprint" in v or "ssrn" in v:
        return "preprint"
    if "workshop" in v:
        return "workshop"
    if entry_type in ("phdthesis", "mastersthesis") or "thesis" in v or "dissertation" in v:
        return "thesis"
    if entry_type == "article" or "journal" in v or "transactions" in v:
        return "journal"
    if entry_type == "inproceedings" or any(k in v for k in ("proceedings", "conference", "neurips", "icml", "iclr", "cvpr", "iccv", "eccv", "aaai", "acl", "emnlp")):
        return "conference"
    return "other"


def read_bib(text):
    entries = []
    for m in re.finditer(r"@(\w+)\s*\{\s*[^,]*,(.*?)\n\}", text, re.S):
        etype, body = m.group(1).lower(), m.group(2)
        fields = {k.lower(): v for k, v in re.findall(r"(\w+)\s*=\s*[{\"](.*?)[}\"]\s*,?\s*$", body, re.M)}
        venue = fields.get("journal") or fields.get("booktitle") or fields.get("school") or fields.get("publisher") or ""
        entries.append({"title": clean(fields.get("title")), "authors": split_authors(fields.get("author", "")),
                        "venue": clean(venue), "year": fields.get("year", ""), "_etype": etype})
    return entries


def read_csv(text):
    rows = csv.DictReader(text.splitlines())
    out = []
    for r in rows:
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        out.append({"title": r.get("title", ""), "authors": split_authors(r.get("authors", "")),
                    "venue": r.get("publication", "") or r.get("publisher", ""), "year": r.get("year", ""), "_etype": ""})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", help="Scholar export: .bib or .csv")
    ap.add_argument("--me", help="your name as it appears in author lists (bolded on the page)")
    a = ap.parse_args()

    src = pathlib.Path(a.file)
    text = src.read_text(encoding="utf-8-sig")
    new = read_bib(text) if src.suffix.lower() in (".bib", ".bibtex", ".txt") else read_csv(text)

    existing = json.loads(OUT.read_text()) if OUT.exists() else {"publications": []}
    old = {norm(p.get("title")): p for p in existing.get("publications", []) if "[[" not in p.get("title", "")}

    merged = []
    for e in new:
        if not e["title"]:
            continue
        prev = old.pop(norm(e["title"]), {})
        merged.append({
            "title": e["title"],
            "authors": e["authors"] or prev.get("authors", []),
            "venue": e["venue"] or prev.get("venue", ""),
            "year": int(e["year"]) if str(e["year"]).isdigit() else (e["year"] or prev.get("year", "")),
            "type": prev.get("type") or guess_type(e["_etype"], e["venue"]),
            "note": prev.get("note", ""),
            "links": prev.get("links", []),
        })
    merged += list(old.values())  # keep hand-added papers that aren't in the export
    merged.sort(key=lambda p: (-(int(p["year"]) if str(p["year"]).isdigit() else 0), p["title"].lower()))

    out = {"_comment": existing.get("_comment", ""),
           "highlight_author": a.me or existing.get("highlight_author", ""),
           "publications": merged}
    if OUT.exists():
        shutil.copy(OUT, OUT.with_suffix(".json.bak"))
    OUT.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(merged)} publications to {OUT.relative_to(ROOT)}. Check the 'type' and add 'links' by hand.")


if __name__ == "__main__":
    main()
