"""
main.py — PAAL FastAPI Server
Wraps the CrewAI multi-agent system behind a single /api/chat endpoint.
"""

import os
import re
from dotenv import load_dotenv

# Default: Vite dev server (explicit list works reliably with credentialed / credentialed-like requests)
_default_cors = "http://localhost:5173,http://127.0.0.1:5173"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", _default_cors).split(",") if o.strip()]
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from crewai import Crew, Process

from agents import tutor_agent, assessment_agent, analytics_agent
from tasks import TASK_BUILDERS
import models
from database import engine, get_db
from auth import get_current_user
from course_catalog import allowed_pinecone_courses, get_course_by_id, load_courses

load_dotenv()

# CrewAI stringifies console output with Unicode box-drawing; strip column "│" so JSON/Markdown parses.
_CREW_LEAD_PIPE = re.compile(r"^[\s\u2500-\u257F]*\u2502")
_CREW_TRAIL_PIPE = re.compile(r"\u2502[\s\u2500-\u257F]*$")


def strip_crew_console_formatting(text: str) -> str:
    if not text:
        return text
    lines = []
    for line in text.splitlines():
        s = _CREW_LEAD_PIPE.sub("", line)
        s = _CREW_TRAIL_PIPE.sub("", s)
        lines.append(s)
    return "\n".join(lines)


# Chat actions that still send a course string but are not tied to textbook folders
_COURSE_CHECK_SKIP = frozenset({"analytics", "test_course_101"})

# Initialize Database Tables
models.Base.metadata.create_all(bind=engine)

# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="PAAL API",
    description="Promptless AI Assisted Learning — USF Freshman Study Assistant",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────────────────────
class QuizOptions(BaseModel):
    """Structured quiz preferences (action=quiz). Ignored for other actions."""

    num_questions: int = 10
    multiple_choice: bool = True
    true_false: bool = False
    short_answer: bool = False
    difficulty: str = "Medium"


class ChatRequest(BaseModel):
    action: str                          # "explain" | "quiz" | "summarize" | "progress"
    topic: str = ""                      # e.g. "derivatives", "photosynthesis"
    course: str = "test_course_101"      # course code
    chat_history: list[dict] = []        # [{"role": "user", "content": "..."}]
    quiz_options: QuizOptions | None = None


class ChatResponse(BaseModel):
    action: str
    answer: str


# ── Agent roster (must include every agent referenced in tasks.py) ─────────────
AGENT_ROSTER = [
    tutor_agent,
    assessment_agent,
    analytics_agent,
]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.get("/api/courses")
def api_list_courses():
    """
    Courses with uploaded PDFs under raw_pdfs/<FolderName>/.
    ChatRequest.course must equal 'pineconeCourse' here (same string as Pinecone metadata filter).
    """
    return load_courses()


@app.get("/api/courses/{course_id}/outline")
def api_course_outline(course_id: str):
    """Chapter/topic dropdown data: from outline.json (pipeline) when present, else meta/defaults."""
    c = get_course_by_id(course_id)
    if not c:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"chapters": c.get("chapters") or []}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept a student action, verify their Clerk JWT token, return the AI response,
    and automatically log the interaction to the SQLite database.
    """
    action = req.action.lower().strip()

    if action not in TASK_BUILDERS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown action '{action}'. "
                f"Supported actions: {', '.join(TASK_BUILDERS.keys())}"
            ),
        )

    # Require course id to match indexed materials (when any exist)
    if action != "progress":
        allowed = allowed_pinecone_courses()
        if (
            allowed
            and req.course not in allowed
            and req.course not in _COURSE_CHECK_SKIP
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"No uploaded materials are registered for course '{req.course}'. "
                    f"Use GET /api/courses and send 'pineconeCourse' as ChatRequest.course. "
                    f"Available: {sorted(allowed)}."
                ),
            )

    # 1. Ensure user exists in our local DB
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        new_user = models.User(id=user_id)
        db.add(new_user)
        db.commit()

    # 2. Save User Query to Chat History
    user_msg = models.ChatHistory(
        user_id=user_id,
        course=req.course,
        role="user",
        content=f"Action: {action} | Topic: {req.topic}"
    )
    db.add(user_msg)
    db.commit()

    # 3. Build CrewAI tasks
    builder = TASK_BUILDERS[action]
    if action == "progress":
        tasks = builder(chat_history=req.chat_history)
    elif action == "quiz":
        tasks = builder(
            topic=req.topic,
            course=req.course,
            chat_history=req.chat_history,
            quiz_options=(
                req.quiz_options.model_dump() if req.quiz_options is not None else None
            ),
        )
    else:
        tasks = builder(
            topic=req.topic,
            course=req.course,
            chat_history=req.chat_history,
        )

    # 4. Kick off the crew
    crew = Crew(
        agents=AGENT_ROSTER,
        tasks=tasks,
        process=Process.sequential,
        verbose=False,
    )

    result = strip_crew_console_formatting(str(crew.kickoff()))

    # 5. Save AI Response to Chat History
    ai_msg = models.ChatHistory(
        user_id=user_id,
        course=req.course,
        role="assistant",
        content=result
    )
    db.add(ai_msg)
    db.commit()

    return ChatResponse(action=action, answer=result)


@app.get("/api/history/{course}")
async def get_history(
    course: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Fetch past chat messages for a specific user and course."""
    history = db.query(models.ChatHistory)\
                .filter(models.ChatHistory.user_id == user_id, models.ChatHistory.course == course)\
                .order_by(models.ChatHistory.timestamp.asc())\
                .all()
    
    return [
        {"role": msg.role, "content": msg.content, "timestamp": msg.timestamp}
        for msg in history
    ]

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "paal-api"}
