"""
PAAL course catalog — single source of truth aligned with pipeline.py.

Each subfolder of raw_pdfs/ becomes one course; the FOLDER NAME is the value stored
in Pinecone metadata['course'] and MUST be sent as ChatRequest.course from the frontend.

Optional per-course file: raw_pdfs/<FolderName>/meta.json
Example:
{
  "id": "conceptual-physics",
  "code": "PHY 1050",
  "title": "Conceptual Physics",
  "description": "Hewitt-style introductory physics.",
  "dept": "Physics",
  "chapters": [
    { "id": "ch1", "title": "Motion", "topics": ["Speed", "Acceleration"] }
  ]
}
"""

from __future__ import annotations

import json
from pathlib import Path

RAW_PDF_ROOT = Path(__file__).resolve().parent / "raw_pdfs"


def _ensure_outline_from_uploaded_pdf(pinecone_dir: Path) -> None:
    """
    If outline.json is missing or older than the course PDF, build it from the
    table of contents (see pdf_outline.py). Requires pypdf.
    """
    pdfs = sorted(pinecone_dir.glob("*.pdf"))
    if not pdfs:
        return
    try:
        from pdf_outline import write_outline_if_needed
    except ImportError:
        return
    pdf = max(pdfs, key=lambda p: p.stat().st_mtime)
    write_outline_if_needed(pinecone_dir, pdf)


def _default_chapters():
    return [
        {
            "id": "ch1",
            "title": "Course materials",
            "topics": ["General study"],
        }
    ]


def normalize_chapters(chapters: list) -> list[dict]:
    """Ensure each chapter has id, title, and topics as a list of strings."""
    out: list[dict] = []
    for i, ch in enumerate(chapters or []):
        if not isinstance(ch, dict):
            continue
        raw_topics = ch.get("topics") or []
        topics: list[str] = []
        for t in raw_topics:
            if isinstance(t, dict):
                label = t.get("label") or t.get("title") or t.get("id")
                if label is not None:
                    topics.append(str(label).strip())
            else:
                topics.append(str(t).strip())
        topics = [t for t in topics if t]
        title = (ch.get("title") or f"Section {i + 1}").strip() or f"Section {i + 1}"
        out.append(
            {
                "id": ch.get("id") or f"ch{i + 1}",
                "title": title[:200],
                "topics": topics or ["General"],
            }
        )
    return out


def chapters_for_course(pinecone_dir: Path, meta_chapters: list | None) -> list[dict]:
    """
    Prefer outline.json: from pipeline Markdown, or auto-built from PDF TOC
    (pdf_outline), then meta.json chapters, then defaults.
    """
    _ensure_outline_from_uploaded_pdf(pinecone_dir)
    outline_path = pinecone_dir / "outline.json"
    if outline_path.is_file():
        try:
            with open(outline_path, encoding="utf-8") as f:
                data = json.load(f)
            norm = normalize_chapters(data.get("chapters") or [])
            if norm:
                return norm
        except (json.JSONDecodeError, OSError, TypeError):
            pass
    if meta_chapters:
        norm = normalize_chapters(meta_chapters)
        if norm:
            return norm
    return _default_chapters()


def load_courses() -> list[dict]:
    """List courses that have uploaded PDFs (same labels as Pinecone filter)."""
    if not RAW_PDF_ROOT.is_dir():
        return []

    courses: list[dict] = []
    for d in sorted(RAW_PDF_ROOT.iterdir()):
        if not d.is_dir():
            continue
        pinecone_course = d.name
        meta_path = d / "meta.json"
        if meta_path.is_file():
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
            courses.append(
                {
                    "id": meta.get("id", _slug_id(pinecone_course)),
                    "pineconeCourse": pinecone_course,
                    "code": meta.get("code", pinecone_course.replace("_", " ")),
                    "title": meta.get("title", pinecone_course.replace("_", " ")),
                    "description": meta.get("description", ""),
                    "dept": meta.get("dept", "Course materials"),
                    "students": int(meta.get("students", 0)),
                    "lessons": int(meta.get("lessons", 0)),
                    "chapters": chapters_for_course(d, meta.get("chapters")),
                }
            )
        else:
            courses.append(
                {
                    "id": _slug_id(pinecone_course),
                    "pineconeCourse": pinecone_course,
                    "code": pinecone_course.replace("_", " ")[:40],
                    "title": pinecone_course.replace("_", " "),
                    "description": (
                        "Course materials are available in PAAL for study sessions, quizzes, and notes."
                    ),
                    "dept": "USF",
                    "students": 0,
                    "lessons": 0,
                    "chapters": chapters_for_course(d, None),
                }
            )
    return courses


def get_course_by_id(course_id: str) -> dict | None:
    for c in load_courses():
        if c.get("id") == course_id:
            return c
    return None


def allowed_pinecone_courses() -> set[str]:
    return {c["pineconeCourse"] for c in load_courses()}


def _slug_id(folder_name: str) -> str:
    return folder_name.lower().replace(" ", "_").replace("/", "_")
