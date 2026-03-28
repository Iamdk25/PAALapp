"""
pipeline.py — PAAL ETL Script
Parses USF PDFs with LlamaParse, chunks them, embeds with Google Gemini,
and uploads to Pinecone.
"""

import asyncio
import os

from dotenv import load_dotenv
from llama_parse import LlamaParse
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()

LLAMA_CLOUD_API_KEY = os.getenv("LLAMA_CLOUD_API_KEY")
GOOGLE_API_KEY      = os.getenv("GOOGLE_API_KEY")
PINECONE_API_KEY    = os.getenv("PINECONE_API_KEY")

PDF_PATH    = "./raw_pdfs/Chap 1 AI.pdf"
INDEX_NAME  = "paal-index"
COURSE_META = "test_course_101"


# ── Step 1: Parse PDF → Markdown ─────────────────────────────────────────────
async def parse_pdf(pdf_path: str) -> str:
    """Use LlamaParse to convert a PDF into clean Markdown."""
    print(f"📄  Parsing '{pdf_path}' with LlamaParse ...")
    parser = LlamaParse(
        api_key=LLAMA_CLOUD_API_KEY,
        result_type="markdown",
    )
    documents = await parser.aload_data(pdf_path)
    # Combine all pages into one Markdown string
    markdown = "\n\n".join(doc.text for doc in documents)
    print(f"✅  Parsing complete — {len(markdown):,} characters extracted.\n")
    return markdown


# ── Step 2: Chunk the Markdown ────────────────────────────────────────────────
def chunk_text(markdown: str) -> list:
    """Split Markdown into overlapping chunks for embedding."""
    print("✂️   Chunking text ...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = splitter.create_documents([markdown])
    print(f"✅  Chunking complete — {len(chunks)} chunks created.\n")
    return chunks


# ── Step 3: Ensure Pinecone index exists ──────────────────────────────────────
def ensure_index(pc: Pinecone):
    """Create the serverless Pinecone index if it doesn't already exist."""
    existing = [idx.name for idx in pc.list_indexes()]
    if INDEX_NAME not in existing:
        print(f"📌  Creating Pinecone index '{INDEX_NAME}' ...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=3072,          # gemini-embedding-001 outputs 3072-d vectors
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1",
            ),
        )
        print(f"✅  Index '{INDEX_NAME}' created.\n")
    else:
        print(f"ℹ️   Index '{INDEX_NAME}' already exists — skipping creation.\n")


# ── Step 4: Embed + Upload to Pinecone (batched for rate limits) ──────────────
import time

BATCH_SIZE = 50   # chunks per batch — stays well under 100 req/min free-tier limit
BATCH_DELAY = 62  # seconds to wait between batches


def upload_to_pinecone(chunks: list):
    """Embed chunks with Google Gemini and upsert into Pinecone in batches."""
    print("🚀  Embedding chunks & uploading to Pinecone ...")

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=GOOGLE_API_KEY,
    )

    pc = Pinecone(api_key=PINECONE_API_KEY)
    ensure_index(pc)

    # Attach course metadata to every chunk
    for chunk in chunks:
        chunk.metadata = {"course": COURSE_META}

    total = len(chunks)
    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"   📦  Uploading batch {batch_num}/{total_batches} "
              f"({len(batch)} chunks) ...")

        PineconeVectorStore.from_documents(
            documents=batch,
            embedding=embeddings,
            index_name=INDEX_NAME,
        )

        print(f"   ✅  Batch {batch_num} uploaded.")

        # Pause between batches to avoid rate-limit (skip after last batch)
        if i + BATCH_SIZE < total:
            print(f"   ⏳  Waiting {BATCH_DELAY}s for rate-limit cooldown ...")
            time.sleep(BATCH_DELAY)

    print(f"\n✅  Uploaded all {total} chunks to Pinecone!\n")


# ── Main ──────────────────────────────────────────────────────────────────────
async def main():
    print("=" * 60)
    print("  PAAL Pipeline — PDF → Pinecone")
    print("=" * 60 + "\n")

    markdown = await parse_pdf(PDF_PATH)
    chunks   = chunk_text(markdown)
    upload_to_pinecone(chunks)

    print("🎉  Pipeline finished successfully!")


if __name__ == "__main__":
    asyncio.run(main())
