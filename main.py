"""
main.py — PAAL FastAPI Server
Wraps the CrewAI multi-agent system behind a single /api/chat endpoint.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from crewai import Crew, Process

from agents import (
    orchestrator_agent,
    retrieval_agent,
    tutor_agent,
    assessment_agent,
    analytics_agent,
)
from tasks import TASK_BUILDERS
import models
from database import engine, get_db
from auth import get_current_user

load_dotenv()

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
    allow_origins=["*"],        # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────────────────────
class ChatRequest(BaseModel):
    action: str                          # "explain" | "quiz" | "summarize" | "progress"
    topic: str = ""                      # e.g. "derivatives", "photosynthesis"
    course: str = "test_course_101"      # course code
    chat_history: list[dict] = []        # [{"role": "user", "content": "..."}]


class ChatResponse(BaseModel):
    action: str
    answer: str


# ── Agent roster (used by the Crew) ──────────────────────────────────────────
AGENT_ROSTER = [
    orchestrator_agent,
    retrieval_agent,
    tutor_agent,
    assessment_agent,
    analytics_agent,
]


# ── Endpoints ─────────────────────────────────────────────────────────────────

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
        verbose=True,
    )

    result = str(crew.kickoff())

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
