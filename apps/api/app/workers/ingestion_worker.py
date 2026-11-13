"""
Knowledge document ingestion worker.

Processes uploaded documents:
1. Downloads file from Supabase storage
2. Extracts text (PDF, TXT, DOCX)
3. Chunks text with overlap
4. Embeds chunks via OpenAI
5. Stores vectors in knowledge_chunks table
"""
from __future__ import annotations

import logging
import math
import os
import tempfile
from pathlib import Path
from typing import AsyncIterator

import httpx
from openai import AsyncOpenAI

from app.config import get_settings
from app.services.supabase import get_admin_client

logger = logging.getLogger(__name__)

CHUNK_SIZE = 500          # tokens (approx chars / 4)
CHUNK_OVERLAP = 50        # tokens overlap between chunks
EMBED_MODEL = "text-embedding-3-small"
EMBED_BATCH = 100         # max embeddings per API call


# ── Text extraction ────────────────────────────────────────────────────────────


def _extract_text_from_pdf(path: str) -> str:
    """Extract text from PDF using pypdf."""
    try:
        from pypdf import PdfReader  # type: ignore
        reader = PdfReader(path)
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages)
    except ImportError:
        logger.warning("pypdf not installed, falling back to empty text for PDF")
        return ""


def _extract_text(path: str, filename: str) -> str:
    """Extract plain text from a file based on its extension."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        return _extract_text_from_pdf(path)
    elif suffix in {".txt", ".md", ".rst"}:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    elif suffix in {".docx", ".doc"}:
        try:
            import docx  # type: ignore
            doc = docx.Document(path)
            return "\n".join(p.text for p in doc.paragraphs)
        except ImportError:
            logger.warning("python-docx not installed; cannot parse DOCX")
            return ""
    else:
        # Try reading as UTF-8 text as a fallback
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            return ""


# ── Chunking ───────────────────────────────────────────────────────────────────


def _chunk_text(text: str, chunk_chars: int = CHUNK_SIZE * 4, overlap_chars: int = CHUNK_OVERLAP * 4) -> list[str]:
    """Split text into overlapping chunks."""
    if not text.strip():
        return []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_chars
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap_chars
        if start >= len(text):
            break

    return chunks


# ── Embeddings ─────────────────────────────────────────────────────────────────


async def _embed_chunks(chunks: list[str], client: AsyncOpenAI) -> list[list[float]]:
    """Generate embeddings for a list of text chunks in batches."""
    embeddings: list[list[float]] = []
    for i in range(0, len(chunks), EMBED_BATCH):
        batch = chunks[i : i + EMBED_BATCH]
        response = await client.embeddings.create(input=batch, model=EMBED_MODEL)
        embeddings.extend([item.embedding for item in response.data])
    return embeddings


# ── Main worker function ───────────────────────────────────────────────────────


async def ingest_document(doc_id: str, tenant_id: str, agent_id: str | None = None) -> None:
    """
    Download, chunk, embed, and index a knowledge document.

    Called as a background task after a document is uploaded.
    Updates the document status in knowledge_documents table.
    """
    settings = get_settings()
    db = get_admin_client()
    openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    # Mark as processing
    db.table("knowledge_documents").update({"status": "processing"}).eq("id", doc_id).eq("tenant_id", tenant_id).execute()

    try:
        # 1. Fetch document record
        result = (
            db.table("knowledge_documents")
            .select("*")
            .eq("id", doc_id)
            .eq("tenant_id", tenant_id)
            .single()
            .execute()
        )
        if not result.data:
            raise ValueError(f"Document {doc_id} not found for tenant {tenant_id}")

        doc = result.data
        storage_path = doc.get("storage_path") or f"{tenant_id}/{doc_id}/{doc['filename']}"
        filename = doc.get("filename", "document.txt")

        # 2. Download from Supabase storage
        logger.info("Downloading document %s from storage", doc_id)
        with tempfile.NamedTemporaryFile(suffix=Path(filename).suffix, delete=False) as tmp:
            tmp_path = tmp.name

        try:
            storage_response = db.storage.from_("knowledge-documents").download(storage_path)
            with open(tmp_path, "wb") as f:
                f.write(storage_response)

            # 3. Extract text
            logger.info("Extracting text from %s", filename)
            text = _extract_text(tmp_path, filename)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        if not text.strip():
            raise ValueError("Could not extract any text from document")

        # 4. Chunk text
        logger.info("Chunking document %s (%d chars)", doc_id, len(text))
        chunks = _chunk_text(text)
        logger.info("Created %d chunks for document %s", len(chunks), doc_id)

        # 5. Generate embeddings
        logger.info("Generating embeddings for %d chunks", len(chunks))
        embeddings = await _embed_chunks(chunks, openai)

        # 6. Delete old chunks (re-indexing case)
        db.table("knowledge_chunks").delete().eq("document_id", doc_id).eq("tenant_id", tenant_id).execute()

        # 7. Insert new chunks
        rows = []
        for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            row = {
                "tenant_id": tenant_id,
                "document_id": doc_id,
                "chunk_index": idx,
                "content": chunk,
                "embedding": embedding,
                "metadata": {"token_count": len(chunk) // 4},
            }
            if agent_id or doc.get("agent_id"):
                row["agent_id"] = agent_id or doc.get("agent_id")
            rows.append(row)

        # Insert in batches of 50
        for i in range(0, len(rows), 50):
            db.table("knowledge_chunks").insert(rows[i : i + 50]).execute()

        # 8. Mark document as ready
        db.table("knowledge_documents").update({
            "status": "ready",
            "chunk_count": len(chunks),
        }).eq("id", doc_id).eq("tenant_id", tenant_id).execute()

        logger.info("Successfully indexed document %s: %d chunks", doc_id, len(chunks))

    except Exception as exc:
        logger.exception("Failed to ingest document %s: %s", doc_id, exc)
        db.table("knowledge_documents").update({
            "status": "failed",
            "error_message": str(exc)[:500],
        }).eq("id", doc_id).eq("tenant_id", tenant_id).execute()
        raise

