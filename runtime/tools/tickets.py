"""
Ticket tool: create support tickets on behalf of the caller.

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

_VALID_PRIORITIES = {"low", "medium", "high", "urgent"}


def _get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")
        _supabase = create_client(url, key)
    return _supabase


async def create_ticket(
    subject: str,
    description: str,
    priority: str = "medium",
    session_ctx: Optional[SessionContext] = None,
    **kwargs,
) -> str:
    """
    Create a support ticket.

    Args:
        subject:     Short summary of the issue.
        description: Full description of the issue.
        priority:    One of low / medium / high / urgent. Defaults to medium.
        session_ctx: Server-side context — provides tenant_id, agent_id, and session_id.

    Returns:
        A human-readable confirmation with the ticket reference number.
    """
    if session_ctx is None:
        logger.error("create_ticket called without session_ctx")
        return "Unable to create ticket: missing session context."

    if not subject or not description:
        return "I need a subject and description to create a support ticket."

    # Sanitise priority — do not trust LLM output for enum values
    if priority not in _VALID_PRIORITIES:
        priority = "medium"

    ticket_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    clean_session_id = None
    if session_ctx.session_id:
        try:
            uuid.UUID(str(session_ctx.session_id))
            clean_session_id = str(session_ctx.session_id)
        except Exception:
            clean_session_id = None

    payload = {
        "id": ticket_id,
        "tenant_id": session_ctx.tenant_id,
        "agent_id": session_ctx.agent_id,
        "subject": subject.strip(),
        "description": description.strip(),
        "priority": priority,
        "status": "open",
        "created_at": now,
    }
    if clean_session_id:
        payload["session_id"] = clean_session_id

    client = _get_supabase()
    try:
        await asyncio.to_thread(
            lambda: client.table("support_tickets").insert(payload).execute()
        )
    except Exception as exc:
        logger.warning("Primary support_tickets insert failed (%s). Retrying without session_id.", exc)
        if "session_id" in payload:
            payload.pop("session_id", None)
            try:
                await asyncio.to_thread(
                    lambda: client.table("support_tickets").insert(payload).execute()
                )
            except Exception:
                logger.exception("Failed to insert ticket for session %s", session_ctx.session_id)
                return "I was unable to create the support ticket at this time. Please try again."

    logger.info(
        "Ticket %s created: tenant=%s session=%s priority=%s",
        ticket_id,
        session_ctx.tenant_id,
        session_ctx.session_id,
        priority,
    )
    return (
        f"Your support ticket has been created. "
        f"Ticket reference: {ticket_id[:8].upper()}. "
        f"Subject: {subject} (Priority: {priority}). "
        f"Our team will be in touch soon."
    )
