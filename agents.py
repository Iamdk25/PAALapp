"""
agents.py — PAAL CrewAI Agent Definitions
Defines the multi-agent team: Orchestrator, Retrieval, Tutor, Assessment, Analytics.
"""

import os
from dotenv import load_dotenv
from crewai import Agent, LLM
from crewai.tools import tool
from pinecone import Pinecone
from langchain_google_genai import GoogleGenerativeAIEmbeddings

load_dotenv()

GOOGLE_API_KEY   = os.getenv("GOOGLE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME       = "paal-index"

# ── Gemini LLM for all agents ────────────────────────────────────────────────
gemini_llm = LLM(
    model="gemini/gemini-2.5-flash",
    api_key=GOOGLE_API_KEY,
)

# ── Pinecone Search Tool ─────────────────────────────────────────────────────
@tool("Search USF Knowledge Base")
def search_usf_knowledge_base(query: str, course: str = "test_course_101") -> str:
    """
    Searches the USF knowledge base in Pinecone for relevant textbook chunks.
    Use this tool when you need to find specific course material, concepts,
    formulas, or textbook content related to a student's question.
    Args:
        query: The search query describing what information to find.
        course: The course code to filter results by (default: test_course_101).
    Returns:
        A string containing the most relevant textbook passages.
    """
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=GOOGLE_API_KEY,
    )
    pc = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)

    query_vector = embeddings.embed_query(query)
    results = index.query(
        vector=query_vector,
        top_k=5,
        include_metadata=True,
        filter={"course": course},
    )

    if not results["matches"]:
        return "No relevant content found in the knowledge base for this query."

    passages = []
    for i, match in enumerate(results["matches"], 1):
        text = match.get("metadata", {}).get("text", "No text available")
        score = match.get("score", 0)
        passages.append(f"--- Passage {i} (relevance: {score:.2f}) ---\n{text}")

    return "\n\n".join(passages)


def sync_retrieve_passages(course: str, query: str, top_k: int = 8) -> str:
    """
    Deterministic Pinecone query with an exact course metadata filter.
    Used by tasks.py so RAG does not depend on the LLM calling the tool correctly.
    """
    if not course or not str(course).strip():
        return "No course id provided for retrieval."
    q = (query or "").strip() or "course materials key concepts"
    if not GOOGLE_API_KEY or not PINECONE_API_KEY:
        return (
            "Knowledge base search is unavailable (missing GOOGLE_API_KEY or PINECONE_API_KEY in environment)."
        )
    try:
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=GOOGLE_API_KEY,
        )
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(INDEX_NAME)
        query_vector = embeddings.embed_query(q[:8000])
        results = index.query(
            vector=query_vector,
            top_k=top_k,
            include_metadata=True,
            filter={"course": course},
        )
    except Exception as e:
        return f"Retrieval error: {e!s}"

    if not results.get("matches"):
        return (
            "No relevant content found in the knowledge base for this query. "
            "Try a different topic or confirm PDFs are indexed for this course."
        )

    passages = []
    for i, match in enumerate(results["matches"], 1):
        text = match.get("metadata", {}).get("text", "No text available")
        score = match.get("score", 0)
        passages.append(f"--- Passage {i} (relevance: {score:.2f}) ---\n{text}")

    combined = "\n\n".join(passages)
    max_chars = 14_000
    if len(combined) > max_chars:
        combined = combined[:max_chars] + "\n\n[...truncated for length...]"
    return combined


# ── Agent Definitions ─────────────────────────────────────────────────────────

orchestrator_agent = Agent(
    role="Orchestrator Agent",
    goal=(
        "Analyse the student's action and topic, then coordinate the other "
        "agents to produce the best possible response."
    ),
    backstory=(
        "You are the manager of a team of AI tutoring agents at the University "
        "of South Florida.  When a student clicks a button in the PAAL app, "
        "you decide which specialist agents to activate and in what order. "
        "You always make sure the final answer is clear, accurate, and "
        "tailored for a freshman student."
    ),
    llm=gemini_llm,
    verbose=True,
    allow_delegation=True,
)

retrieval_agent = Agent(
    role="Retrieval Agent (Librarian)",
    goal=(
        "Search the Pinecone vector database and return the most relevant "
        "textbook passages for the given topic and course."
    ),
    backstory=(
        "You are the university librarian.  Your only job is to search the "
        "USF knowledge base and pull out the exact paragraphs, formulas, or "
        "definitions that are relevant to the student's request.  You always "
        "return raw source material — you never rewrite or simplify it."
    ),
    tools=[search_usf_knowledge_base],
    llm=gemini_llm,
    verbose=True,
)

tutor_agent = Agent(
    role="Tutor Agent (Teacher)",
    goal=(
        "Turn retrieved course material into a clear, well-structured Markdown "
        "lesson a first-year student can follow."
    ),
    backstory=(
        "You are a patient university tutor. You explain ideas in plain language, "
        "define terms before using them, and organize every answer with headings, "
        "short paragraphs, and bullet lists—never dense unstructured prose."
    ),
    llm=gemini_llm,
    verbose=True,
)

assessment_agent = Agent(
    role="Assessment Agent (Grader)",
    goal=(
        "Create quiz questions from course material and grade student "
        "answers with detailed feedback."
    ),
    backstory=(
        "You are a university teaching assistant who writes fair quizzes. "
        "You follow the task instructions exactly for question count, difficulty, "
        "and question types (multiple choice, true/false, short answer). "
        "You output valid JSON only when asked. When grading, you compare "
        "student answers to keys and rubrics from the quiz in the conversation."
    ),
    llm=gemini_llm,
    verbose=True,
)

analytics_agent = Agent(
    role="Analytics Agent (Tracker)",
    goal=(
        "Analyse a student's interaction history and quiz performance to "
        "produce a brief progress summary with study recommendations."
    ),
    backstory=(
        "You are a data-driven academic advisor.  You look at what topics "
        "a student has studied, which quiz questions they got right or wrong, "
        "and you produce a short, encouraging progress report with concrete "
        "next steps."
    ),
    llm=gemini_llm,
    verbose=True,
)
