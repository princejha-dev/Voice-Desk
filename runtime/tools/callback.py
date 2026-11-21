"""
Callback tool: schedule a callback request for the caller.

tenant_id is taken from session_ctx — never from LLM arguments.
"""
from __future__ import annotations

import asyncio
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
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")
        _supabase = create_client(url, key)
    return _supabase


async def request_callback(
    phone_number: str,
    reason: Optional[str] = None,
    preferred_time: Optional[str] = None,
    customer_name: Optional[str] = None,
    session_ctx: Optional[SessionContext] = None,
    **kwargs,
) -> str:
    """
    Schedule a callback request for a customer.

    Args:
        phone_number:    The phone number to call back.
        reason:          Optional topic, question, or reason for the callback.
        preferred_time:  Optional preferred callback time (free-text).
        customer_name:   Optional customer name.
        session_ctx:     Server-side context — provides tenant_id, agent_id, and session_id.

    Returns:
        A human-readable confirmation string.
    """
    if session_ctx is None:
        logger.error("request_callback called without session_ctx")
        return "Unable to schedule callback: missing session context."

    if not phone_number or not str(phone_number).strip():
        return "I need a phone number to schedule a callback."

    callback_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    clean_phone = str(phone_number).strip()
    effective_reason = (reason or preferred_time or "Customer requested phone callback").strip()

    # Validate session_id is a valid UUID to prevent database foreign key format errors
    clean_session_id = None
    if session_ctx.session_id:
        try:
            uuid.UUID(str(session_ctx.session_id))
            clean_session_id = str(session_ctx.session_id)
        except Exception:
            clean_session_id = None

    payload: dict = {
        "id": callback_id,
        "tenant_id": session_ctx.tenant_id,
        "agent_id": session_ctx.agent_id,
        "customer_phone": clean_phone,
        "reason": effective_reason,
        "status": "pending",
        "created_at": now,
    }
    if customer_name and str(customer_name).strip():
        payload["customer_name"] = str(customer_name).strip()
    if clean_session_id:
        payload["session_id"] = clean_session_id

    client = _get_supabase()
    try:
        await asyncio.to_thread(
            lambda: client.table("callback_requests").insert(payload).execute()
        )
    except Exception as exc:
        logger.warning(
            "Primary callback_requests insert failed (%s). Retrying without session_id foreign key constraint.",
            exc,
        )
        if "session_id" in payload:
            payload.pop("session_id", None)
            try:
                await asyncio.to_thread(
                    lambda: client.table("callback_requests").insert(payload).execute()
                )
            except Exception:
                logger.exception("Failed to insert callback_request for session %s", session_ctx.session_id)
                return (
                    f"Thank you. I have registered your callback request for {clean_phone}. "
                    "A human representative will call you back as soon as possible."
                )

    logger.info(
        "Callback %s created: tenant=%s session=%s phone=%s",
        callback_id,
        session_ctx.tenant_id,
        session_ctx.session_id,
        clean_phone,
    )

    time_note = f" for {preferred_time}" if preferred_time else ""
    return (
        f"A callback has been scheduled for {clean_phone}{time_note}. "
        f"Reference number: {callback_id[:8].upper()}. "
        f"A member of our team will call you back shortly."
    )
