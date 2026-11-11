"""
Callback tool: schedule a callback request for the caller.

tenant_id is taken from session_ctx — never from LLM arguments.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from supabase import create_client, Client

from runtime.engine.context import SessionContext

logger = logging.getLogger(__name__)

_supabase: Client | None = None


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


async def request_callback(
    phone_number: str,
    preferred_time: Optional[str] = None,
    session_ctx: Optional[SessionContext] = None,
) -> str:
    """
    Schedule a callback request.

    Args:
        phone_number:    The phone number to call back.
        preferred_time:  Optional preferred callback time (free-text).
        session_ctx:     Server-side context — provides tenant_id and session_id.

    Returns:
        A human-readable confirmation string.
    """
    if session_ctx is None:
        logger.error("request_callback called without session_ctx")
        return "Unable to schedule callback: missing session context."

    if not phone_number or not phone_number.strip():
        return "I need a phone number to schedule a callback."

    callback_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    client = _get_supabase()
    try:
        client.table("callback_requests").insert(
            {
                "id": callback_id,
                "tenant_id": session_ctx.tenant_id,   # always from session_ctx
                "agent_id": session_ctx.agent_id,
                "session_id": session_ctx.session_id,
                "phone_number": phone_number.strip(),
                "preferred_time": preferred_time,
                "status": "pending",
                "created_at": now,
            }
        ).execute()
    except Exception:
        logger.exception(
            "Failed to insert callback_request for session %s",
            session_ctx.session_id,
        )
        return "I was unable to schedule the callback at this time. Please try again."

    logger.info(
        "Callback %s created: tenant=%s session=%s phone=%s",
        callback_id,
        session_ctx.tenant_id,
        session_ctx.session_id,
        phone_number,
    )

    time_note = f" at {preferred_time}" if preferred_time else ""
    return (
        f"A callback has been scheduled for {phone_number}{time_note}. "
        f"Reference: {callback_id[:8].upper()}. "
        f"You should receive a call from our team shortly."
    )
