"""
Build outline.json from uploaded PDFs using the table of contents (no LlamaParse required).

Works well for textbooks whose TOC includes a block like "Contents in Brief" with lines:
  1 About Science 22
  2 Newton's First Law ... 44
and "Contents in Detail" with subsection lines:
  1.1 Scientific Measurements 23
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from pypdf import PdfReader

# First N pages usually contain Brief + start of Detailed TOC
_TOC_PAGES = 18


def _clean_title(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("\u00a0", " ")
    return s[:200] if len(s) > 200 else s


def _extract_pdf_head_text(pdf_path: Path, max_pages: int = _TOC_PAGES) -> str:
    reader = PdfReader(str(pdf_path))
    n = min(len(reader.pages), max_pages)
    parts: list[str] = []
    for i in range(n):
        t = reader.pages[i].extract_text() or ""
        parts.append(t)
    return "\n".join(parts)


def _parse_brief_contents_block(text: str) -> list[tuple[int, str]]:
    """Parse 'Contents in Brief' lines: chapter_num title page."""
    start = text.find("Contents in Brief")
    if start == -1:
        return []
    detail = text.find("Contents in Detail")
    end = detail if detail != -1 else start + 12000
    block = text[start:end]
    chapters: list[tuple[int, str]] = []
    seen: set[int] = set()

    for raw in block.splitlines():
        line = raw.strip()
        if not line or line.upper().startswith("PART "):
            continue
        # "1 About Science 22" / " 2 Newton's ... 44"
        m = re.match(r"^(\d{1,2})\s+(.+?)\s+(\d{2,4})\s*$", line)
        if not m:
            continue
        num = int(m.group(1))
        title = _clean_title(m.group(2))
        page = m.group(3)
        if num < 1 or num > 99 or not title:
            continue
        # Skip bogus lines where "title" is just a year (timeline pages)
        if re.match(r"^\d{4}$", title):
            continue
        if num in seen:
            continue
        seen.add(num)
        chapters.append((num, title))
    return chapters


def _parse_detail_subsections(text: str) -> dict[int, list[str]]:
    """Parse 'Contents in Detail' / CONTENTS: lines like '1.1 Scientific Measurements 23'."""
    start = text.find("Contents in Detail")
    if start == -1:
        start = text.find("CONTENTS")
    if start == -1:
        return {}
    block = text[start : start + 80000]
    by_ch: dict[int, list[str]] = {}

    for raw in block.splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^(\d+)\.(\d+)\s+(.+?)\s+(\d{2,4})\s*$", line)
        if not m:
            continue
        major = int(m.group(1))
        minor = int(m.group(2))
        sub_title = _clean_title(m.group(3))
        if major < 1 or major > 99 or not sub_title:
            continue
        label = f"{major}.{minor} {sub_title}"
        by_ch.setdefault(major, []).append(label)
        if len(by_ch[major]) >= 24:
            continue
    return by_ch


def outline_from_pdf_toc(pdf_path: Path) -> dict | None:
    """
    Return { "chapters": [ { id, title, topics } ] } or None if parsing fails.
    """
    try:
        head = _extract_pdf_head_text(pdf_path)
    except OSError:
        return None
    if len(head.strip()) < 200:
        return None

    brief = _parse_brief_contents_block(head)
    if not brief:
        return None

    topics_map = _parse_detail_subsections(head)
    chapters_out: list[dict] = []

    for num, title in sorted(brief, key=lambda x: x[0]):
        topics = topics_map.get(num, [])
        if not topics:
            topics = ["Overview", "Key ideas", "Review questions"]
        chapters_out.append(
            {
                "id": f"ch{num}",
                "title": f"Chapter {num}: {title}",
                "topics": topics[:24],
            }
        )

    if not chapters_out:
        return None
    return {"chapters": chapters_out}


def write_outline_if_needed(course_dir: Path, pdf_path: Path) -> bool:
    """
    If outline.json is missing or older than pdf_path, build from TOC and write.
    Returns True if outline.json was written.
    """
    outline_path = course_dir / "outline.json"
    try:
        pdf_mtime = pdf_path.stat().st_mtime
    except OSError:
        return False
    if outline_path.is_file():
        try:
            if outline_path.stat().st_mtime >= pdf_mtime:
                return False
        except OSError:
            pass

    data = outline_from_pdf_toc(pdf_path)
    if not data:
        return False
    outline_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return True
