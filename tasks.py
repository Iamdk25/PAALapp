"""
tasks.py — PAAL CrewAI Task Definitions
Maps each user action to a sequence of agent tasks.

RAG: sync_retrieve_passages() runs deterministic Pinecone queries with the exact
course filter so answers are grounded in textbook chunks (not dependent on the
LLM calling a tool with the correct parameters).
"""

from crewai import Task

from agents import (
    tutor_agent,
    assessment_agent,
    analytics_agent,
    sync_retrieve_passages,
)


def _format_history(chat_history: list) -> str:
    return (
        "\n".join(f"{msg['role']}: {msg['content']}" for msg in chat_history)
        if chat_history
        else "No prior conversation."
    )


def _search_query(action: str, topic: str, chat_history: list) -> str:
    """Build embedding query text for vector search."""
    t = (topic or "").strip() or "course materials"
    if action == "ask" and chat_history:
        tail = _format_history(chat_history[-8:])
        return f"{t}\n\nConversation context:\n{tail}"[:8000]
    if action in ("summarize", "generate_notes"):
        return f"{t} key concepts definitions summary main ideas"
    if action == "quiz":
        return f"{t} concepts problems practice learning objectives"
    return t


def _rag_block(course: str, action: str, topic: str, chat_history: list) -> str:
    q = _search_query(action, topic, chat_history)
    passages = sync_retrieve_passages(course, q)
    return (
        f"=== RETRIEVED TEXTBOOK MATERIAL FOR COURSE '{course}' "
        f"(you MUST base your answer only on this; do not invent other sources) ===\n"
        f"{passages}\n"
        f"=== END OF RETRIEVED MATERIAL ==="
    )


def _no_source_json_guard() -> str:
    return (
        "\n\nIf the retrieved material above states that no relevant content was found, "
        "say so honestly in 'response' and suggest trying another topic; do not fabricate textbook content."
    )


def _json_followups_guard() -> str:
    return (
        "\n\nCRITICAL: Output ONLY valid JSON with keys 'response' (string, markdown ok) and "
        "'suggested_prompts' (array of exactly 4 or 5 short follow-up questions tailored to this conversation "
        "and the course material; each question on its own, no numbering prefix in the strings)."
    )


def _formatting_instruction() -> str:
    return (
        "\n\nFORMATTING for the 'response' field: Use clear Markdown (GFM). "
        "Begin with a ## heading naming the topic. Use short paragraphs (at most 3–5 sentences each). "
        "Use bullet lists for steps, definitions, or lists of facts. **Bold** important terms on first mention. "
        "Leave a blank line between sections. Never output a single unreadable wall of text. "
        "Do not apologize, hedge about being an AI, or add filler."
    )


# ── 1. Explain ───────────────────────────────────────────────────────────────
def build_explain_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    rag = _rag_block(course, "explain", topic, chat_history)
    explain_task = Task(
        description=(
            f"{rag}\n\n"
            f"Task: Explain this focus area for a first-year student: {topic}\n\n"
            f"Conversation so far:\n{history_str}\n\n"
            f"Ground every claim in the retrieved material. If something is not in the passages, say so.\n"
            f"{_json_followups_guard()}"
            f"{_no_source_json_guard()}"
        ),
        expected_output="JSON with response and suggested_prompts.",
        agent=tutor_agent,
    )
    return [explain_task]


# ── 2. Ask (custom question) ─────────────────────────────────────────────────
def build_ask_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    rag = _rag_block(course, "ask", topic, chat_history)
    ask_task = Task(
        description=(
            f"{rag}\n\n"
            f"The student's question: {topic}\n\n"
            f"Earlier messages (for context):\n{history_str}\n\n"
            f"Answer using ONLY the retrieved material above. Cite ideas from the passages.\n"
            f"{_formatting_instruction()}"
            f"{_json_followups_guard()}"
            f"{_no_source_json_guard()}"
        ),
        expected_output="JSON with response and suggested_prompts.",
        agent=tutor_agent,
    )
    return [ask_task]


# ── 3. Summarize ─────────────────────────────────────────────────────────────
def build_summarize_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    rag = _rag_block(course, "summarize", topic, chat_history)
    summarize_task = Task(
        description=(
            f"{rag}\n\n"
            f"Task: Produce a concise TL;DR / bullet summary of: {topic}\n\n"
            f"Context:\n{history_str}\n\n"
            f"Use only the retrieved textbook material.\n"
            f"{_formatting_instruction()}"
            f"{_json_followups_guard()}"
            f"{_no_source_json_guard()}"
        ),
        expected_output="JSON with response and suggested_prompts.",
        agent=tutor_agent,
    )
    return [summarize_task]


# ── 4. Generate Notes ────────────────────────────────────────────────────────
def build_generate_notes_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    rag = _rag_block(course, "generate_notes", topic, chat_history)
    notes_task = Task(
        description=(
            f"{rag}\n\n"
            f"Task: Create a printable study guide focused ONLY on this chapter/topic: {topic}\n\n"
            f"The document title (first line as # heading) MUST include the chapter/topic above so students can file it.\n"
            f"Session context:\n{history_str}\n\n"
            f"Output professional Markdown only (no JSON). Include: title, core concepts, definitions, "
            f"any formulas from the passages, and a short review section.\n"
            f"If retrieval found no usable content, write a short Markdown note explaining that and what to try next."
        ),
        expected_output="Markdown study guide.",
        agent=tutor_agent,
    )
    return [notes_task]


def _quiz_type_counts(total: int, mc: bool, tf: bool, sa: bool) -> dict[str, int]:
    flags = [("mc", mc), ("tf", tf), ("sa", sa)]
    enabled = [k for k, on in flags if on]
    if not enabled:
        enabled = ["mc"]
    n_types = len(enabled)
    base, rem = divmod(total, n_types)
    counts = {"mc": 0, "tf": 0, "sa": 0}
    for i, key in enumerate(enabled):
        counts[key] = base + (1 if i < rem else 0)
    return counts


# ── 5. Quiz ──────────────────────────────────────────────────────────────────
def build_quiz_tasks(
    topic: str,
    course: str,
    chat_history: list,
    quiz_options: dict | None = None,
) -> list[Task]:
    opts = quiz_options or {}
    n_raw = int(opts.get("num_questions", 10) or 10)
    n = max(3, min(15, n_raw))
    mc_on = bool(opts.get("multiple_choice", True))
    tf_on = bool(opts.get("true_false", False))
    sa_on = bool(opts.get("short_answer", False))
    if not mc_on and not tf_on and not sa_on:
        mc_on = True
    difficulty = str(opts.get("difficulty", "Medium") or "Medium")
    counts = _quiz_type_counts(n, mc_on, tf_on, sa_on)
    n_mc, n_tf, n_sa = counts["mc"], counts["tf"], counts["sa"]

    rag = _rag_block(course, "quiz", topic, chat_history)
    quiz_task = Task(
        description=(
            f"{rag}\n\n"
            f"Quiz focus (chapter/topic label for search context): {topic}\n"
            f"Difficulty: {difficulty}.\n\n"
            f"You MUST create EXACTLY {n} questions in total, with these counts by type:\n"
            f"- multiple_choice: {n_mc}\n"
            f"- true_false: {n_tf}\n"
            f"- short_answer: {n_sa}\n\n"
            f"Do not add extra questions. Do not omit questions. If you cannot fulfill a type from "
            f"the passages, still output {n} items: substitute with the closest fair question from "
            f"the same material, or return JSON with an empty quiz and a short message only if "
            f"there is truly no usable content.\n\n"
            f"Use ONLY the retrieved passages above. Output a single JSON object with key 'quiz' "
            f"(array of exactly {n} objects). Each object MUST include a string field 'type': "
            f'"mc" | "tf" | "sa".\n\n'
            f'For type "mc": {{"type":"mc","question":"...","options":{{"A":"...","B":"...","C":"...","D":"..."}},'
            f'"correct":"A"|"B"|"C"|"D","explanation":"..."}}\n'
            f'For type "tf": {{"type":"tf","question":"... (a single declarative statement)",'
            f'"correct":"true"|"false","explanation":"..."}}\n'
            f'For type "sa": {{"type":"sa","question":"...","sample_answer":"... (ideal concise answer)",'
            f'"explanation":"what a good answer should include"}}'
            f"\n\nOrder: emit all multiple_choice items first (in order), then all true_false, "
            f"then all short_answer — total length must be {n}."
        ),
        expected_output="JSON quiz object.",
        agent=assessment_agent,
    )
    return [quiz_task]


# ── 6. Grade Quiz ────────────────────────────────────────────────────────────
def build_grade_quiz_tasks(topic: str, course: str, chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    grade_task = Task(
        description=(
            f"The student has submitted the following quiz answers for grading: {topic}\n\n"
            f"Review the chat history for the original quiz JSON (questions, correct keys, "
            f"sample_answer for short answer) and the submission:\n"
            f"History: {history_str}\n\n"
            f"Grade each item in order (same order as the quiz array): for type mc compare the letter; "
            f"for type tf compare true/false (accept minor casing); for type sa judge against "
            f"sample_answer and the question, allowing paraphrase if correct.\n\n"
            f"Output ONE JSON object only (no markdown fences, no commentary outside JSON). "
            f"The 'feedback' value MUST be a single JSON string. Inside that string use real newline "
            f"characters and Markdown: start with a one-line summary, then use ## headings "
            f"(e.g. ## Strengths, ## What to review), short paragraphs, and bullet lists where helpful. "
            f"Do not use literal backslash-n; use actual line breaks inside the string.\n\n"
            f"Include an 'items' array with one object per question, 0-based index matching the quiz order. "
            f'Each item: {{"index": 0, "correct": true}} or {{"index": 1, "correct": false, '
            f'"correct_answer": "..."}}. For wrong mc, correct_answer is the letter (e.g. "C"). '
            f'For wrong tf, correct_answer is "true" or "false". For wrong sa, correct_answer is a '
            f"short ideal answer (you may reuse or tighten sample_answer).\n\n"
            f"Schema:\n"
            f'{{"score": "X/Y", "feedback": "<markdown string>", "review_topics": ["...", "..."], '
            f'"items": [{{"index": 0, "correct": true}}, ...]}}'
        ),
        expected_output="JSON grade object.",
        agent=assessment_agent,
    )
    return [grade_task]


# ── 7. Progress ───────────────────────────────────────────────────────────────
def build_progress_tasks(chat_history: list) -> list[Task]:
    history_str = _format_history(chat_history)
    progress_task = Task(
        description=(
            f"Analyse the student's chat history and quiz hints (if any).\n"
            f"History: {history_str}\n\n"
            f"Output JSON:\n"
            f'{{"overall_strength": "Needs Work / Good / Excellent", "strengths": ["..."], '
            f'"weaknesses": ["..."], "recommendations": ["..."], "encouragement": "..."}}'
        ),
        expected_output="JSON progress object.",
        agent=analytics_agent,
    )
    return [progress_task]


# ── Task Builder Registry ────────────────────────────────────────────────────
TASK_BUILDERS = {
    "explain": build_explain_tasks,
    "ask": build_ask_tasks,
    "summarize": build_summarize_tasks,
    "generate_notes": build_generate_notes_tasks,
    "quiz": build_quiz_tasks,
    "grade_quiz": build_grade_quiz_tasks,
    "progress": build_progress_tasks,
}
