"""
One-shot: build outline.json for each raw_pdfs/<Course>/ from _cache/*.md (no Pinecone re-upload).

Run from repo root after PDFs were processed at least once (so _cache/*.md exists):
  python build_outlines.py
"""

from __future__ import annotations

import json
from pathlib import Path

from outline import extract_outline_from_markdown, load_outline_json, merge_outline_json, write_outline_json

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw_pdfs"


def main() -> None:
    if not RAW.is_dir():
        print(f"No {RAW}")
        return
    for d in sorted(RAW.iterdir()):
        if not d.is_dir():
            continue
        cache = d / "_cache"
        if not cache.is_dir():
            print(f"⏭  {d.name}: no _cache/, skip")
            continue
        md_files = sorted(cache.glob("*.md"))
        if not md_files:
            print(f"⏭  {d.name}: no .md in _cache/, skip")
            continue
        merged = None
        for md_path in md_files:
            text = md_path.read_text(encoding="utf-8", errors="replace")
            piece = extract_outline_from_markdown(text)
            prev = merged if merged is not None else load_outline_json(d)
            merged = merge_outline_json(prev, piece)
        if merged:
            write_outline_json(d, merged)
            n = len(merged.get("chapters") or [])
            print(f"✅  {d.name}: outline.json ({n} chapter(s))")


if __name__ == "__main__":
    main()
