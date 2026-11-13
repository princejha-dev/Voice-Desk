"""
Booking tool: schedule appointments for the caller with strict rule enforcement.

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
        _supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _supabase


async def book_appointment(
    customer_name: str,
    date: str,
    time: str,
    service: str = "General Consultation",
    customer_phone: str = "",
    session_ctx: Optional[SessionContext] = None,
) -> str:
    """
    Book an appointment for a customer.

    Args:
        customer_name:  Full name of the customer.
        date:           Requested date in YYYY-MM-DD format (e.g. '2026-11-20').
        time:           Requested time in HH:MM format (24-hour, e.g. '14:30').
        service:        Service or appointment type requested.
        customer_phone: Optional contact phone number for the customer.
        session_ctx:    Server-side context — provides tenant_id, agent_id, and agent_config.

    Returns:
        A human-readable confirmation string or a rule violation message.
    """
    if session_ctx is None:
        return "Unable to book appointment: missing server session context."

    if not customer_name or not date or not time:
        return "I need your full name, preferred date (YYYY-MM-DD), and time (HH:MM) to book an appointment."

    # 1. Load agent's configured booking boundaries from tools_config
    cfg: dict = session_ctx.agent_config.get("tools_config", {}).get("book_appointment", {})
    working_days = cfg.get("working_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
    start_time_str = cfg.get("start_time", "09:00")
    end_time_str = cfg.get("end_time", "17:00")
    tz_str = cfg.get("timezone", "UTC")
    slot_duration = cfg.get("slot_duration_minutes", 30)

    # 2. Validate Day of Week
    try:
        parsed_date = datetime.strptime(date.strip(), "%Y-%m-%d")
        weekday_name = parsed_date.strftime("%A")
        if weekday_name not in working_days:
            allowed_days = ", ".join(working_days)
            return (
                f"We are only open for appointments on {allowed_days}. "
                f"{parsed_date.strftime('%B %d')} is a {weekday_name}. "
                f"Would another date during our working days work for you?"
            )
    except ValueError:
        return "Please provide a valid date in YYYY-MM-DD format (for example, 2026-11-20)."

    # 3. Validate Time Window
    clean_time = time.strip()
    if len(clean_time) == 5:
        clean_time = f"{clean_time}:00"
    try:
        req_time = datetime.strptime(clean_time[:5], "%H:%M").time()
        start_t = datetime.strptime(start_time_str, "%H:%M").time()
        end_t = datetime.strptime(end_time_str, "%H:%M").time()
        if not (start_t <= req_time <= end_t):
            return (
                f"Our appointment hours are between {start_time_str} and {end_time_str} ({tz_str}). "
                f"Could we schedule a time within that window?"
            )
    except ValueError:
        pass  # If time parsing fails, proceed gracefully

    client = _get_supabase()

    # 4. Check for existing slot conflicts
    try:
        conflict_res = await asyncio.to_thread(
            lambda: client.table("bookings")
            .select("id")
            .eq("tenant_id", session_ctx.tenant_id)
            .eq("agent_id", session_ctx.agent_id)
            .eq("booking_date", date.strip())
            .eq("booking_time", clean_time[:5])
            .neq("status", "cancelled")
            .execute()
        )
        if conflict_res.data and len(conflict_res.data) > 0:
            return (
                f"The slot on {date} at {time} is already booked. "
                f"Could we schedule 30 minutes earlier or later?"
            )
    except Exception:
        logger.warning("Failed slot conflict check; continuing")

    # 5. Insert booking into database
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    try:
        await asyncio.to_thread(
            lambda: client.table("bookings").insert(
                {
                    "id": booking_id,
                    "tenant_id": session_ctx.tenant_id,
                    "agent_id": session_ctx.agent_id,
                    "session_id": session_ctx.session_id,
                    "customer_name": customer_name.strip(),
                    "customer_phone": customer_phone.strip() if customer_phone else None,
                    "booking_date": date.strip(),
                    "booking_time": clean_time[:5],
                    "duration_minutes": slot_duration,
                    "status": "pending",
                    "notes": f"Service: {service}",
                    "created_at": now,
                }
            ).execute()
        )
    except Exception:
        logger.exception(
            "Failed to insert booking for session %s", session_ctx.session_id
        )
        return "I was unable to secure that appointment slot right now. Please try again."

    logger.info(
        "Booking %s created: tenant=%s agent=%s date=%s time=%s",
        booking_id,
        session_ctx.tenant_id,
        session_ctx.agent_id,
        date,
        time,
    )
    return (
        f"Your appointment for {service} has been scheduled for {weekday_name}, {date} at {time} ({tz_str}) "
        f"for {customer_name}. Confirmation reference: {booking_id[:8].upper()}."
    )
