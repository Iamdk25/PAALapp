<div align="center">
  <img src="https://via.placeholder.com/150x150.png?text=PAAL" alt="PAAL Logo" width="120" height="auto" />
  <h1>🤖 PAAL: Promptless AI Assisted Learning</h1>
  <p><strong>The ultimate, context-aware, multi-agent study assistant built for the modern student.</strong><br><em>Tailored specifically to synthesize course materials (like Physics, Programming, and AI) into bite-sized, actionable learning insights.</em></p>

  <p>
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
    <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  </p>
</div>

<br>

<div align="center">
  <blockquote>
    Built for the ambitious. An MVP designed to showcase exactly what a production-grade multi-agent autonomous framework can deliver in an EdTech context.
  </blockquote>
</div>

---

## 🎯 The Vision

Education often overwhelms students with hundreds of textbook pages and lecture slides. **PAAL App** turns static, dense coursework into a deeply interactive, dynamic tutor. 

Unlike standard "chat with your PDF" tools, PAAL is **promptless**. Students just click actions like _"Explain this"_, _"Quiz me"_, or _"Track my progress"_, and our **orchestrated multi-agent Crew** handles the heavy lifting—from RAG retrieval to targeted pedagogy.

## ✨ Key Features

- **🚀 CrewAI Multi-Agent System:** Orchestrated AI agents acting as a **Tutor**, **Assessment Evaluator**, and **Analytics Engine**. Handing off insights sequentially to ensure high-fidelity responses.
- **📚 RAG-Powered Knowledge Base:** Instantaneous querying across multiple university courses (700+ pages of PDFs) using **Pinecone** and **Google Gemini** embeddings via Langchain.
- **✨ Promptless Interactions:** No need to engineer the perfect prompt. Use structured UI actions to trigger deep, programmatic AI evaluations. 
- **🔐 Secure Authentication:** Seamless user login and access flow powered by **Clerk**.
- **📈 Study Progress Tracking:** Persistent chat history and knowledge graph metrics saved to a local **SQLite** database.
- **📄 Downloadable Study Notes:** Turn your session into a rich, structured PDF with a single click (using `jsPDF` & `html2canvas`).

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript / JavaScript (ESModules)
- **Bundler:** Vite ⚡
- **Styling:** Tailwind CSS + Typography (`@tailwindcss/typography`)
- **Key Libraries:** `react-markdown`, `html2canvas`, `jspdf`, `@clerk/clerk-react`

### Backend
- **Framework:** FastAPI / Uvicorn (Python)
- **AI Orchestration:** CrewAI (Multi-Agent framework with sequential processing)
- **Data Ingestion/RAG:** LlamaIndex, Langchain, Pinecone (Vector Database)
- **LLM Engine:** Google Gemini (`langchain-google-genai`)
- **Database:** SQLite with SQLAlchemy ORM

---

## 🧠 Under the Hood: Multi-Agent Architecture

When a student clicks "Quiz me on Derivatives":

1. **Retrieval**: System queries Pinecone for the exact pages covering "Derivatives".
2. **Orchestrator Agent**: Breaks down the request and delegates tasks.
3. **Assessment Agent**: Evaluates the retrieved material and crafts a targeted quiz matching the requested difficulty.
4. **Analytics Agent**: Processes the student's past performance in the SQLite history to personalize the questions.
5. **Output**: Delivered natively to the React frontend as clean JSON/Markdown, parsed and rendered beautifully.

---

## 🚀 Getting Started

### Prerequisites

You will need the following API keys securely placed in a `.env` file inside the root backend folder:
- `GOOGLE_API_KEY`
- `PINECONE_API_KEY`
- `CLERK_SECRET_KEY`

### 1. Start the Backend (FastAPI + AI Engine)

```bash
# Clone the repository
git clone https://github.com/your-username/paal-app.git
cd paal-app

# Create a virtual environment & install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Boot up the Uvicorn server (Default port: 8000)
uvicorn main:app --reload --port 8000
```

### 2. Start the Frontend (Vite + React)

```bash
# Navigate to the frontend directory
cd frontend

# Install Dependencies
npm install

# Start the Vite development server
npm run dev
```

Navigate to [http://localhost:5173](http://localhost:5173) in your browser, log in with Clerk, and start learning!

---

## 🌎 Directory Structure Highlights

- **`main.py`**: The central nervous system of the FastAPI endpoints and Clerk validation.
- **`agents.py` & `tasks.py`**: Defines the rigorous persona, goals, and workflow for the Tutor, Assessment, and Analytics CrewAI agents.
- **`pipeline.py` & `build_outlines.py`**: Automated pipeline for slicing, chunking, embedding, and organizing native `.pdf` course loads into Pinecone.
- **`/frontend/src`**: React codebase built dynamically around Clerk and Tailwind CSS.

---

## 🔮 What's Next?
- **Realtime Collaboration:** Allowing students to form study groups and interrogate the AI alongside peers.
- **Expanded Quiz Modalities:** Speech-to-text integration for foreign languages and short-answer grading.
- **Gamification Mechanics:** XP systems, leaderboard mechanics, and unlocking achievements based on topic mastery.

---

<p align="center">
  <br>
  Built with ❤️ for better, smarter, faster learning.
</p>
