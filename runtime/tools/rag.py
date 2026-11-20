"""
RAG tool: knowledge base search via pgvector with resilient multi-agent assignment fallback.

SECURITY: tenant_id and agent_id are ALWAYS taken from session_ctx (server-side).
They are NEVER derived from the query string or any LLM output.
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import os
from typing import TYPE_CHECKING, List, Dict, Any

import openai
from supabase import create_client, Client

from runtime.engine.context import SessionContext

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_supabase: Client | None = None
_openai_client: openai.AsyncOpenAI | None = None

_EMBEDDING_MODEL = "text-embedding-3-small"
_DEFAULT_TOP_K = 5
_DEFAULT_MATCH_THRESHOLD = 0.2


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")
        _supabase = create_client(url, key)
    return _supabase


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        _openai_client = openai.AsyncOpenAI(api_key=api_key)
    return _openai_client


def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for a, b in zip(vec_a, vec_b):
        dot += a * b
        norm_a += a * a
        norm_b += b * b
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


def _parse_embedding(raw_embedding: Any) -> List[float] | None:
    """Parse vector embedding if returned as list or json string."""
    if isinstance(raw_embedding, list):
        return [float(x) for x in raw_embedding]
    if isinstance(raw_embedding, str):
        try:
            parsed = json.loads(raw_embedding)
            if isinstance(parsed, list):
                return [float(x) for x in parsed]
        except Exception:
            return None
    return None


async def knowledge_search(query: str, session_ctx: SessionContext) -> str:
    """
    Search the agent's knowledge base using pgvector cosine similarity.

    The knowledge base is scoped to the calling tenant and agent — these
    values come exclusively from session_ctx and cannot be overridden by the
    query or any LLM-generated input.

    Args:
        query:       The natural-language question to search for.
        session_ctx: Server-side session context (tenant_id, agent_id guaranteed).

    Returns:
        A formatted string containing the top matching knowledge chunks, or a
        message indicating that nothing relevant was found.
    """
    if not query or not query.strip():
        return "No query provided."

    # Extract agent-level RAG configuration if present
    agent_cfg = getattr(session_ctx, "agent_config", None) or {}
    tools_cfg = agent_cfg.get("tools_config", {}).get("knowledge_search", {})
    match_threshold = float(tools_cfg.get("match_threshold", _DEFAULT_MATCH_THRESHOLD))
    top_k = int(tools_cfg.get("max_chunks", _DEFAULT_TOP_K))

    # 1. Generate query embedding
    client_ai = _get_openai()
    try:
        embedding_resp = await client_ai.embeddings.create(
            model=_EMBEDDING_MODEL,
            input=query.strip(),
        )
        query_embedding: list[float] = embedding_resp.data[0].embedding
    except Exception:
        logger.exception("Failed to generate embedding for knowledge search")
        return "Knowledge search is temporarily unavailable."

    # 2. Attempt primary search via pgvector RPC
    client_db = _get_supabase()
    rows: list[dict] = []
    try:
        response = await asyncio.to_thread(
            lambda: client_db.rpc(
                "search_knowledge",
                {
                    "p_tenant_id": session_ctx.tenant_id,
                    "p_agent_id": session_ctx.agent_id,
                    "p_query_embedding": query_embedding,
                    "p_match_count": top_k,
                    "p_match_threshold": match_threshold,
                },
            ).execute()
        )
        rows = response.data or []
    except Exception as rpc_err:
        logger.warning(
            "search_knowledge RPC failed for session %s (%s). Falling back to direct assignment search.",
            session_ctx.session_id,
            rpc_err,
        )

    # 3. Resilient Fallback: If RPC returned 0 rows (e.g. if chunks have uploader's agent_id or migration 00010 not yet applied)
    if not rows:
        try:
            # A. Fetch document IDs assigned to this agent
            assigned_docs_res = await asyncio.to_thread(
                lambda: client_db.table("agent_knowledge_documents")
                .select("document_id")
                .eq("tenant_id", session_ctx.tenant_id)
                .eq("agent_id", session_ctx.agent_id)
                .execute()
            )
            assigned_doc_ids = [d["document_id"] for d in (assigned_docs_res.data or [])]

            # B. Also fetch documents created directly by this agent
            direct_docs_res = await asyncio.to_thread(
                lambda: client_db.table("knowledge_documents")
                .select("id")
                .eq("tenant_id", session_ctx.tenant_id)
                .eq("agent_id", session_ctx.agent_id)
                .eq("status", "ready")
                .execute()
            )
            direct_doc_ids = [d["id"] for d in (direct_docs_res.data or [])]

            all_authorized_doc_ids = list(set(assigned_doc_ids + direct_doc_ids))

            if all_authorized_doc_ids:
                # Ensure all authorized documents are active ('ready')
                verified_docs_res = await asyncio.to_thread(
                    lambda: client_db.table("knowledge_documents")
                    .select("id")
                    .in_("id", all_authorized_doc_ids)
                    .eq("tenant_id", session_ctx.tenant_id)
                    .eq("status", "ready")
                    .execute()
                )
                active_doc_ids = [d["id"] for d in (verified_docs_res.data or [])]

                if active_doc_ids:
                    # Fetch chunks for active authorized docs
                    chunks_res = await asyncio.to_thread(
                        lambda: client_db.table("knowledge_chunks")
                        .select("id, document_id, chunk_index, content, embedding, metadata")
                        .in_("document_id", active_doc_ids)
                        .eq("tenant_id", session_ctx.tenant_id)
                        .execute()
                    )
                    chunks = chunks_res.data or []

                    scored_chunks = []
                    for c in chunks:
                        emb = _parse_embedding(c.get("embedding"))
                        if not emb:
                            continue
                        sim = _cosine_similarity(query_embedding, emb)
                        if sim >= match_threshold:
                            scored_chunks.append({**c, "similarity": sim})

                    scored_chunks.sort(key=lambda x: x["similarity"], reverse=True)
                    rows = scored_chunks[:top_k]
                    logger.info(
                        "RAG fallback found %d matching chunks for session %s (agent=%s)",
                        len(rows),
                        session_ctx.session_id,
                        session_ctx.agent_id,
                    )
        except Exception:
            logger.exception("RAG fallback search failed for session %s", session_ctx.session_id)

    if not rows:
        return "No relevant information found in the knowledge base."

    # 4. Format matching chunks for LLM voice context
    parts: list[str] = []
    for i, row in enumerate(rows, start=1):
        content = (row.get("content") or "").strip()
        if content:
            parts.append(f"[{i}] {content}")

    return "\n\n".join(parts) if parts else "No relevant information found in the knowledge base."
