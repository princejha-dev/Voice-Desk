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
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


async def create_ticket(
    subject: str,
    description: str,
    priority: str = "medium",
    session_ctx: Optional[SessionContext] = None,
) -> str:
    """
    Create a support ticket.

    Args:
        subject:     Short summary of the issue.
        description: Full description of the issue.
        priority:    One of low / medium / high / urgent. Defaults to medium.
        session_ctx: Server-side context — provides tenant_id and session_id.

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

    client = _get_supabase()
    try:
        client.table("support_tickets").insert(
            {
                "id": ticket_id,
                "tenant_id": session_ctx.tenant_id,   # always from session_ctx
                "agent_id": session_ctx.agent_id,
                "session_id": session_ctx.session_id,
                "subject": subject,
                "description": description,
                "priority": priority,
                "status": "open",
                "created_at": now,
            }
        ).execute()
    except Exception:
        logger.exception(
            "Failed to insert ticket for session %s", session_ctx.session_id
        )
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
        f"Ticket ID: {ticket_id[:8].upper()}. "
        f"Subject: {subject} (Priority: {priority}). "
        f"Our team will be in touch soon."
    )
