"""
pipeline.py — PAAL ETL Script
Recursively scans the raw_pdfs/ folder, where each subfolder represents a course code.
Parses PDFs, tags chunks with the parent course code, and batch uploads to Pinecone.
"""

import asyncio
import os
import time
from pathlib import Path

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

RAW_PDF_DIR = Path("./raw_pdfs")
INDEX_NAME  = "paal-index"


# ── Step 1: Parse PDF → Markdown ─────────────────────────────────────────────
async def parse_pdf(pdf_path: Path) -> str:
    """Use LlamaParse to convert a PDF into clean Markdown."""
    print(f"📄  Parsing '{pdf_path.name}' ...")
    parser = LlamaParse(
        api_key=LLAMA_CLOUD_API_KEY,
        result_type="markdown",
    )
    documents = await parser.aload_data(str(pdf_path))
    markdown = "\n\n".join(doc.text for doc in documents)
    print(f"   ✅  {len(markdown):,} chars extracted.")
    return markdown


# ── Step 2: Chunk the Markdown ────────────────────────────────────────────────
def chunk_text(markdown: str, course_code: str) -> list:
    """Split Markdown into overlapping chunks and tag with course metadata."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = splitter.create_documents([markdown])
    for chunk in chunks:
        chunk.metadata = {"course": course_code}
    print(f"   ✂️   Split into {len(chunks)} chunks (tagged as '{course_code}').")
    return chunks


# ── Step 3: Ensure Pinecone index exists ──────────────────────────────────────
def ensure_index(pc: Pinecone):
    existing = [idx.name for idx in pc.list_indexes()]
    if INDEX_NAME not in existing:
        print(f"📌  Creating Pinecone index '{INDEX_NAME}' ...")
        pc.create_index(
            name=INDEX_NAME,
            dimension=3072,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
        print(f"✅  Index created.\n")
    else:
        print(f"ℹ️   Index '{INDEX_NAME}' already exists.\n")


# ── Step 4: Batch Upload to Pinecone ──────────────────────────────────────────
BATCH_SIZE = 50   # chunks per batch to respect rate limits
BATCH_DELAY = 62  # seconds cooldown


def upload_to_pinecone(all_chunks: list):
    """Embed chunks and upsert into Pinecone in rate-limited batches."""
    if not all_chunks:
        print("⚠️   No chunks to upload!")
        return

    print(f"\n🚀  Uploading {len(all_chunks)} total chunks to Pinecone ...")

    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/gemini-embedding-001",
        google_api_key=GOOGLE_API_KEY,
    )
    pc = Pinecone(api_key=PINECONE_API_KEY)
    ensure_index(pc)

    total = len(all_chunks)
    for i in range(0, total, BATCH_SIZE):
        batch = all_chunks[i : i + BATCH_SIZE]
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

        if i + BATCH_SIZE < total:
            print(f"   ⏳  Waiting {BATCH_DELAY}s for rate-limit cooldown ...")
            time.sleep(BATCH_DELAY)

    print(f"\n🎉  Successfully uploaded all {total} chunks!")


# ── Main Loop ─────────────────────────────────────────────────────────────────
async def main():
    print("=" * 60)
    print("  PAAL Pipeline — Batch PDF → Pinecone")
    print("=" * 60 + "\n")

    if not RAW_PDF_DIR.exists():
        print(f"❌ Directory {RAW_PDF_DIR} does not exist. Creating it.")
        RAW_PDF_DIR.mkdir()
        return

    all_chunks = []
    
    # Recursively find all PDFs
    pdf_files = list(RAW_PDF_DIR.rglob("*.pdf"))
    
    if not pdf_files:
        print(f"⚠️  No PDFs found in {RAW_PDF_DIR}")
        return

    print(f"🔍 Found {len(pdf_files)} PDF(s) to process.\n")

    for pdf_path in pdf_files:
        # The parent folder name is the course code
        # e.g. raw_pdfs/COP2510_Programming/syllabus.pdf -> COP2510_Programming
        course_code = pdf_path.parent.name
        
        # Parse and chunk
        markdown = await parse_pdf(pdf_path)
        chunks = chunk_text(markdown, course_code)
        all_chunks.extend(chunks)

    # Bulk upload everything
    upload_to_pinecone(all_chunks)


if __name__ == "__main__":
    asyncio.run(main())
