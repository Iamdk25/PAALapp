"""
main.py — PAAL FastAPI Server
Wraps the CrewAI multi-agent system behind a single /api/chat endpoint.
"""

import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

load_dotenv()

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


# ── Endpoint ──────────────────────────────────────────────────────────────────
@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Accept a student action and return the AI-generated response.
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

    # Build the task list for this action
    builder = TASK_BUILDERS[action]
    if action == "progress":
        tasks = builder(chat_history=req.chat_history)
    else:
        tasks = builder(
            topic=req.topic,
            course=req.course,
            chat_history=req.chat_history,
        )

    # Assemble and kick off the crew
    crew = Crew(
        agents=AGENT_ROSTER,
        tasks=tasks,
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()

    return ChatResponse(action=action, answer=str(result))


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "paal-api"}
