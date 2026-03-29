"""
Build course chapter/topic outlines from textbook Markdown (same source as chunking).

Pipeline writes _cache/*.md and outline.json under each raw_pdfs/<Course>/ folder.
"""

from __future__ import annotations

import json
import re
from pathlib import Path


def extract_outline_from_markdown(md: str, max_chapters: int = 50) -> dict:
    """
    Parse Markdown headings into chapters (#) and topics (## under each chapter).
    Falls back to ##-only structure if no top-level # exists.
    """
    if not md or not md.strip():
        return _fallback_outline()

    lines = md.splitlines()
    chapters: list[dict] = []
    current: dict | None = None

    for line in lines:
        raw = line.strip()
        if not raw:
            continue
        # ### as extra topics under same chapter
        m_h1 = re.match(r"^#\s+([^#].*)$", raw)
        m_h2 = re.match(r"^##\s+(.+)$", raw)
        m_h3 = re.match(r"^###\s+(.+)$", raw)

        if m_h1:
            title = _clean_heading(m_h1.group(1))
            if not title or len(title) > 200:
                continue
            if current:
                chapters.append(current)
            if len(chapters) >= max_chapters:
                break
            current = {
                "id": f"ch{len(chapters) + 1}",
                "title": title,
                "topics": [],
            }
        elif m_h2 and current is not None:
            sub = _clean_heading(m_h2.group(1))
            if sub and len(sub) <= 200 and len(current["topics"]) < 40:
                current["topics"].append(sub)
        elif m_h3 and current is not None:
            sub = _clean_heading(m_h3.group(1))
            if sub and len(sub) <= 200 and len(current["topics"]) < 40:
                current["topics"].append(sub)

    if current:
        chapters.append(current)

    # No H1: group under ## as pseudo-chapters
    if not chapters:
        for line in lines:
            raw = line.strip()
            m2 = re.match(r"^##\s+(.+)$", raw)
            if m2:
                title = _clean_heading(m2.group(1))
                if title and len(title) <= 200:
                    chapters.append(
                        {
                            "id": f"ch{len(chapters) + 1}",
                            "title": title,
                            "topics": [
                                "Key ideas",
                                "Examples",
                                "You should know",
                            ],
                        }
                    )
                if len(chapters) >= max_chapters:
                    break

    if not chapters:
        return _fallback_outline()

    for ch in chapters:
        if not ch["topics"]:
            ch["topics"] = [
                "Introduction",
                "Main ideas",
                "Summary",
            ]

    return {"chapters": chapters}


def _clean_heading(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\*{2,}", "", s)
    return s.strip()


def _fallback_outline() -> dict:
    return {
        "chapters": [
            {
                "id": "ch1",
                "title": "Course materials",
                "topics": [
                    "Introduction",
                    "Core concepts",
                    "Review and practice",
                ],
            }
        ]
    }


def merge_outline_json(existing: dict | None, new: dict) -> dict:
    """Merge chapters when multiple PDFs contribute to one course folder."""
    if not existing or not existing.get("chapters"):
        return new
    ec = existing["chapters"]
    nc = new.get("chapters") or []
    base = len(ec)
    for i, ch in enumerate(nc):
        ch = dict(ch)
        ch["id"] = f"ch{base + i + 1}"
        ec.append(ch)
    return {"chapters": ec}


def write_outline_json(course_dir: Path, data: dict) -> None:
    path = course_dir / "outline.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def load_outline_json(course_dir: Path) -> dict | None:
    path = course_dir / "outline.json"
    if not path.is_file():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None
