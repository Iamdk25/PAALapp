"""
tasks.py — PAAL CrewAI Task Definitions
Maps each user action to a sequence of agent tasks.
Includes new advanced Promptless UI features: dynamic prompts, grading, and notes.
"""

from crewai import Task
from agents import (
    orchestrator_agent,
    retrieval_agent,
    tutor_agent,
    assessment_agent,
    analytics_agent,
)


def _format_history(chat_history: list) -> str:
    return "\n".join(
        f"{msg['role']}: {msg['content']}" for msg in chat_history
    ) if chat_history else "No prior conversation."


# ── 1. Explain action (Dynamic Prompts) ──────────────────────────────────────
def build_explain_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    retrieve_task = Task(
        description=f"Search the knowledge base for '{topic}' in course '{course}'. Return relevant passages.",
        expected_output="Raw textbook passages.",
        agent=retrieval_agent,
    )
    explain_task = Task(
        description=(
            f"Using the retrieved passages, write a clear, freshman-friendly explanation of '{topic}'.\n\n"
            f"History: {history_str}\n\n"
            f"Guidelines:\n"
            f"- Use analogies and define jargon.\n\n"
            f"CRITICAL: You MUST output a valid JSON object with EXACTLY two keys: 'response' and 'suggested_prompts'.\n"
            f"- 'response': Your clear explanation string (markdown supported).\n"
            f"- 'suggested_prompts': An array of 3 highly relevant follow-up question strings the student should ask next.\n"
            f"Do not include any other text outside the JSON."
        ),
        expected_output="JSON object with 'response' and 'suggested_prompts'.",
        agent=tutor_agent,
        context=[retrieve_task],
    )
    return [retrieve_task, explain_task]


# ── 2. Ask action (Custom Query + Dynamic Prompts) ───────────────────────────
def build_ask_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    retrieve_task = Task(
        description=f"The student asked a custom question: '{topic}' in course '{course}'. Search for relevant passages.",
        expected_output="Raw textbook passages.",
        agent=retrieval_agent,
    )
    ask_task = Task(
        description=(
            f"Using the retrieved passages, answer the student's custom question: '{topic}'.\n\n"
            f"History: {history_str}\n\n"
            f"CRITICAL: You MUST output a valid JSON object with EXACTLY two keys: 'response' and 'suggested_prompts'.\n"
            f"- 'response': Your detailed answer string (markdown supported).\n"
            f"- 'suggested_prompts': An array of 3 highly relevant follow-up question strings.\n"
            f"Do not include any other text outside the JSON."
        ),
        expected_output="JSON object with 'response' and 'suggested_prompts'.",
        agent=tutor_agent,
        context=[retrieve_task],
    )
    return [retrieve_task, ask_task]


# ── 3. Summarize action (Dynamic Prompts) ────────────────────────────────────
def build_summarize_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    retrieve_task = Task(
        description=f"Search the knowledge base for '{topic}' in course '{course}'.",
        expected_output="Raw textbook passages.",
        agent=retrieval_agent,
    )
    summarize_task = Task(
        description=(
            f"Using the retrieved passages, write a concise summary (TL;DR) of '{topic}'.\n"
            f"History: {history_str}\n\n"
            f"CRITICAL: You MUST output a valid JSON object with EXACTLY two keys: 'response' and 'suggested_prompts'.\n"
            f"- 'response': Your bulleted summary string (markdown supported).\n"
            f"- 'suggested_prompts': An array of 3 highly relevant follow-up question strings.\n"
            f"Do not include any other text outside the JSON."
        ),
        expected_output="JSON object with 'response' and 'suggested_prompts'.",
        agent=tutor_agent,
        context=[retrieve_task],
    )
    return [retrieve_task, summarize_task]


# ── 4. Generate Notes action (PDF-Ready Markdown) ────────────────────────────
def build_generate_notes_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    retrieve_task = Task(
        description=f"Search the knowledge base for comprehensive details on '{topic}' (Course: '{course}'). Retrieve as much detailed context as possible.",
        expected_output="Rich textbook passages.",
        agent=retrieval_agent,
    )
    notes_task = Task(
        description=(
            f"Using the retrieved passages, generate a highly structured, comprehensive Study Guide for '{topic}'.\n"
            f"Format as Professional Markdown ready to be printed to PDF.\n"
            f"Include:\n"
            f"1. A Title and Introduction\n"
            f"2. Core Concepts with Definitions\n"
            f"3. Key Formulas or Rules (if any)\n"
            f"4. A 'Quick Review' concluding section.\n"
            f"Do NOT output JSON, just pure Markdown text."
        ),
        expected_output="A structured pure Markdown document study guide.",
        agent=tutor_agent,
        context=[retrieve_task],
    )
    return [retrieve_task, notes_task]


# ── 5. Generate Quiz action (JSON Quiz) ──────────────────────────────────────
def build_quiz_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    retrieve_task = Task(
        description=f"Search the knowledge base for '{topic}' in course '{course}'.",
        expected_output="Raw textbook passages.",
        agent=retrieval_agent,
    )
    quiz_task = Task(
        description=(
            f"Using the retrieved passages, create a 5-question multiple-choice quiz about '{topic}'.\n"
            f"Format the output as valid JSON:\n"
            f'{{"quiz": [{{"question": "...", "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}}, "correct": "A", "explanation": "..."}}]}}'
        ),
        expected_output="JSON object containing the 5-question quiz.",
        agent=assessment_agent,
        context=[retrieve_task],
    )
    return [retrieve_task, quiz_task]


# ── 6. Grade Quiz action (JSON Feedback) ─────────────────────────────────────
def build_grade_quiz_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    # topic contains the student's submitted answers
    grade_task = Task(
        description=(
            f"The student has submitted the following quiz answers for grading: {topic}\n\n"
            f"Review the Chat History below to find the original quiz questions and correct answers:\n"
            f"History: {history_str}\n\n"
            f"Evaluate their answers. Provide a score (e.g., '4/5') and specific feedback on what they got wrong and what they should review.\n"
            f"CRITICAL: Output valid JSON exactly like this:\n"
            f'{{"score": "X/Y", "feedback": "Your detailed feedback string (markdown supported).", "review_topics": ["topic1", "topic2"]}}'
        ),
        expected_output="JSON object containing score, feedback, and review topics.",
        agent=assessment_agent,
    )
    return [grade_task]


# ── 7. Progress & Analytics action (JSON Outline) ────────────────────────────
def build_progress_tasks(chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    progress_task = Task(
        description=(
            f"Analyse the student's chat history and quiz performance (if any).\n"
            f"History: {history_str}\n\n"
            f"CRITICAL: Output valid JSON exactly like this:\n"
            f'{{"overall_strength": "Needs Work / Good / Excellent", "strengths": ["...", "..."], "weaknesses": ["...", "..."], "recommendations": ["...", "..."], "encouragement": "..."}}'
        ),
        expected_output="JSON object representing the student's progress and analytics.",
        agent=analytics_agent,
    )
    return [progress_task]


# ── Task Builder Registry ────────────────────────────────────────────────────
TASK_BUILDERS = {
    "explain":        build_explain_tasks,
    "ask":            build_ask_tasks,
    "summarize":      build_summarize_tasks,
    "generate_notes": build_generate_notes_tasks,
    "quiz":           build_quiz_tasks,
    "grade_quiz":     build_grade_quiz_tasks,
    "progress":       build_progress_tasks,
}
