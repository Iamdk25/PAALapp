"""
tasks.py — PAAL CrewAI Task Definitions
Maps each user action (explain, quiz, summarize, progress) to a sequence of
agent tasks that the Crew will execute.
"""

from crewai import Task
from agents import (
    orchestrator_agent,
    retrieval_agent,
    tutor_agent,
    assessment_agent,
    analytics_agent,
)


def build_explain_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    """Tasks for the 'explain' action — Retrieve context → Tutor explains."""

    history_str = "\n".join(
        f"{msg['role']}: {msg['content']}" for msg in chat_history
    ) if chat_history else "No prior conversation."

    retrieve_task = Task(
        description=(
            f"Search the USF knowledge base for content about '{topic}' "
            f"in course '{course}'.  Return the most relevant passages verbatim."
        ),
        expected_output="Raw textbook passages relevant to the topic.",
        agent=retrieval_agent,
    )

    explain_task = Task(
        description=(
            f"Using the retrieved textbook passages, write a clear and simple "
            f"explanation of '{topic}' for a USF freshman.\n\n"
            f"Chat history for context:\n{history_str}\n\n"
            f"Guidelines:\n"
            f"- Use analogies and examples\n"
            f"- Define any jargon\n"
            f"- Use bullet points for key takeaways\n"
            f"- Keep it under 300 words"
        ),
        expected_output=(
            "A clear, freshman-friendly explanation of the topic with key "
            "takeaways and examples."
        ),
        agent=tutor_agent,
        context=[retrieve_task],
    )

    return [retrieve_task, explain_task]


def build_quiz_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    """Tasks for the 'quiz' action — Retrieve context → Generate quiz."""

    retrieve_task = Task(
        description=(
            f"Search the USF knowledge base for content about '{topic}' "
            f"in course '{course}'.  Return the most relevant passages verbatim."
        ),
        expected_output="Raw textbook passages relevant to the topic.",
        agent=retrieval_agent,
    )

    quiz_task = Task(
        description=(
            f"Using the retrieved textbook passages, create a 5-question "
            f"multiple-choice quiz about '{topic}'.\n\n"
            f"For each question provide:\n"
            f"1. The question text\n"
            f"2. Four answer options (A, B, C, D)\n"
            f"3. The correct answer letter\n"
            f"4. A one-sentence explanation\n\n"
            f"Format the output as valid JSON with this structure:\n"
            f'{{"quiz": [{{"question": "...", "options": {{"A": "...", "B": "...", '
            f'"C": "...", "D": "..."}}, "correct": "A", "explanation": "..."}}]}}'
        ),
        expected_output=(
            "A JSON object containing a 5-question multiple-choice quiz."
        ),
        agent=assessment_agent,
        context=[retrieve_task],
    )

    return [retrieve_task, quiz_task]


def build_summarize_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    """Tasks for the 'summarize' action — Retrieve context → Summarize."""

    retrieve_task = Task(
        description=(
            f"Search the USF knowledge base for content about '{topic}' "
            f"in course '{course}'.  Return the most relevant passages verbatim."
        ),
        expected_output="Raw textbook passages relevant to the topic.",
        agent=retrieval_agent,
    )

    summarize_task = Task(
        description=(
            f"Using the retrieved textbook passages, write a concise summary "
            f"of '{topic}' suitable for quick revision.\n\n"
            f"Guidelines:\n"
            f"- Start with a one-sentence TL;DR\n"
            f"- List 3-5 key points\n"
            f"- Include any important formulas or definitions\n"
            f"- Keep it under 200 words"
        ),
        expected_output=(
            "A concise revision summary with key points, formulas, and definitions."
        ),
        agent=tutor_agent,
        context=[retrieve_task],
    )

    return [retrieve_task, summarize_task]


def build_progress_tasks(chat_history: list) -> list[Task]:
    """Tasks for the 'progress' action — Analyse interaction history."""

    history_str = "\n".join(
        f"{msg['role']}: {msg['content']}" for msg in chat_history
    ) if chat_history else "No prior conversation."

    progress_task = Task(
        description=(
            f"Analyse the following student interaction history and produce "
            f"a brief progress report.\n\n"
            f"History:\n{history_str}\n\n"
            f"Include:\n"
            f"- Topics the student has studied\n"
            f"- Estimated strength level per topic (strong / needs work)\n"
            f"- 2-3 concrete study recommendations\n"
            f"- An encouraging closing statement"
        ),
        expected_output=(
            "A short, encouraging progress report with topic strengths "
            "and study recommendations."
        ),
        agent=analytics_agent,
    )

    return [progress_task]


# ── Task Builder Registry ────────────────────────────────────────────────────
TASK_BUILDERS = {
    "explain":   build_explain_tasks,
    "quiz":      build_quiz_tasks,
    "summarize": build_summarize_tasks,
    "progress":  build_progress_tasks,
}
