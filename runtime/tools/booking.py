"""
Booking tool: schedule appointments for the caller.

tenant_id is taken from session_ctx — never from LLM arguments.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

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


async def book_appointment(
    customer_name: str,
    date: str,
    time: str,
    service: str,
    session_ctx: SessionContext,
) -> str:
    """
    Book an appointment for a customer.

    Args:
        customer_name: Full name of the customer.
        date:          Requested date in YYYY-MM-DD format.
        time:          Requested time in HH:MM (24-hour) format.
        service:       Service or appointment type being requested.
        session_ctx:   Server-side context — provides tenant_id and session_id.

    Returns:
        A human-readable confirmation string with the booking reference.
    """
    if not all([customer_name, date, time, service]):
        return "I need the customer name, date, time, and service to book an appointment."

    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    client = _get_supabase()
    try:
        client.table("bookings").insert(
            {
                "id": booking_id,
                "tenant_id": session_ctx.tenant_id,   # always from session_ctx
                "agent_id": session_ctx.agent_id,
                "session_id": session_ctx.session_id,
                "customer_name": customer_name,
                "date": date,
                "time": time,
                "service": service,
                "status": "pending",
                "created_at": now,
            }
        ).execute()
    except Exception:
        logger.exception(
            "Failed to insert booking for session %s", session_ctx.session_id
        )
        return "I was unable to book the appointment at this time. Please try again."

    logger.info(
        "Booking %s created: tenant=%s session=%s",
        booking_id,
        session_ctx.tenant_id,
        session_ctx.session_id,
    )
    return (
        f"Your appointment has been booked! "
        f"Reference: {booking_id[:8].upper()}. "
        f"Details: {service} on {date} at {time} for {customer_name}."
    )
