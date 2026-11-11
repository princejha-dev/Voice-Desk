import logging
import os
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


async def create_session(
    session_id: str,
    tenant_id: str,
    agent_id: str,
    version_id: str,
    room_name: str,
) -> None:
    """
    Upsert a call_sessions row and mark it as active.

    The row may have been pre-created by the API; we update it in place.
    """
    client = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    client.table("call_sessions").upsert(
        {
            "id": session_id,
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "version_id": version_id,
            "room_name": room_name,
            "status": "active",
            "started_at": now,
        },
        on_conflict="id",
    ).execute()

    logger.info("Session %s marked active (tenant=%s)", session_id, tenant_id)


async def end_session(session_id: str, tenant_id: str) -> None:
    """Mark a call_sessions row as ended."""
    client = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    client.table("call_sessions").update(
        {"status": "ended", "ended_at": now}
    ).eq("id", session_id).eq("tenant_id", tenant_id).execute()

    logger.info("Session %s ended (tenant=%s)", session_id, tenant_id)


async def save_message(
    session_id: str,
    tenant_id: str,
    role: str,
    content: str,
    latency_ms: Optional[int] = None,
) -> None:
    """Append a turn to conversation_messages."""
    client = _get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    row: dict = {
        "session_id": session_id,
        "tenant_id": tenant_id,
        "role": role,
        "content": content,
        "created_at": now,
    }
    if latency_ms is not None:
        row["latency_ms"] = latency_ms

    client.table("conversation_messages").insert(row).execute()
