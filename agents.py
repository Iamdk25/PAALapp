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
        "Take raw textbook content and rewrite it as a clear, simple "
        "explanation that a freshman can understand."
    ),
    backstory=(
        "You are a patient and enthusiastic university tutor who specialises "
        "in explaining complex topics to first-year students.  You use "
        "analogies, bullet points, and examples.  You never use jargon "
        "without defining it first."
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
        "You are a university teaching assistant who writes fair but "
        "challenging multiple-choice quizzes.  Each quiz has 5 questions. "
        "For every question you provide 4 options, the correct answer, and "
        "a short explanation of why it is correct."
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
