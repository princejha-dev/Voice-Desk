"""
RAG tool: knowledge base search via pgvector.

SECURITY: tenant_id and agent_id are ALWAYS taken from session_ctx (server-side).
They are NEVER derived from the query string or any LLM output.
"""
from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

import openai
from supabase import create_client, Client

from runtime.engine.context import SessionContext

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_supabase: Client | None = None
_openai_client: openai.AsyncOpenAI | None = None

_EMBEDDING_MODEL = "text-embedding-3-small"
_TOP_K = 5


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


def _get_openai() -> openai.AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = openai.AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    return _openai_client


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

    # 1. Generate embedding — query string is untrusted, but that is fine here
    #    because we only use the embedding for similarity search.
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

    # 2. Query knowledge_chunks with cosine similarity via pgvector RPC.
    #    tenant_id and agent_id come from session_ctx — NEVER from the query.
    client_db = _get_supabase()
    try:
        response = client_db.rpc(
            "match_knowledge_chunks",
            {
                "query_embedding": query_embedding,
                "match_tenant_id": session_ctx.tenant_id,   # server-side
                "match_agent_id": session_ctx.agent_id,     # server-side
                "match_count": _TOP_K,
            },
        ).execute()
    except Exception:
        logger.exception("Failed to query knowledge_chunks for session %s", session_ctx.session_id)
        return "Knowledge search is temporarily unavailable."

    rows: list[dict] = response.data or []
    if not rows:
        return "No relevant information found in the knowledge base."

    # 3. Format chunks for the LLM context
    parts: list[str] = []
    for i, row in enumerate(rows, start=1):
        content = (row.get("content") or "").strip()
        if content:
            parts.append(f"[{i}] {content}")

    return "\n\n".join(parts) if parts else "No relevant information found."
