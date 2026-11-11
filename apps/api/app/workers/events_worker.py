"""
LiveKit webhook events worker.

Processes incoming LiveKit webhook events to:
- Update call_sessions on room lifecycle events
- Record conversation messages from transcription events
- Publish live events to Redis for monitoring dashboard
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from app.services.supabase import get_admin_client

logger = logging.getLogger(__name__)


# ── Event handlers ─────────────────────────────────────────────────────────────


async def handle_room_started(event: dict[str, Any]) -> None:
    """Mark session as active when room starts."""
    room = event.get("room", {})
    room_name = room.get("name", "")
    if not room_name:
        return

    db = get_admin_client()
    db.table("call_sessions").update({
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }).eq("livekit_room", room_name).execute()

    logger.info("Room started: %s", room_name)


async def handle_room_finished(event: dict[str, Any]) -> None:
    """Mark session as ended when room finishes."""
    room = event.get("room", {})
    room_name = room.get("name", "")
    if not room_name:
        return

    db = get_admin_client()
    db.table("call_sessions").update({
        "status": "ended",
        "ended_at": datetime.now(timezone.utc).isoformat(),
    }).eq("livekit_room", room_name).eq("status", "active").execute()

    logger.info("Room finished: %s", room_name)


async def handle_participant_joined(event: dict[str, Any]) -> None:
    """Log when a participant (human or agent) joins."""
    participant = event.get("participant", {})
    room = event.get("room", {})
    logger.info(
        "Participant joined room %s: %s (kind=%s)",
        room.get("name"),
        participant.get("identity"),
        participant.get("kind"),
    )


async def handle_track_published(event: dict[str, Any]) -> None:
    """Placeholder for track publication events."""
    pass


async def handle_egress_ended(event: dict[str, Any]) -> None:
    """Handle egress ended events (recording, etc)."""
    egress = event.get("egressInfo", {})
    logger.info("Egress ended: %s status=%s", egress.get("egressId"), egress.get("status"))


async def handle_agent_dispatched(event: dict[str, Any]) -> None:
    """Log agent dispatch events."""
    agent = event.get("dispatchId") or event.get("agent", {})
    logger.info("Agent dispatched: %s", agent)


# ── Redis publish ──────────────────────────────────────────────────────────────


async def _try_publish_redis(channel: str, payload: dict[str, Any]) -> None:
    """Best-effort publish to Redis; never raises."""
    try:
        from app.services.event_publisher import get_redis_connection
        redis = await get_redis_connection()
        await redis.publish(channel, json.dumps(payload))
    except Exception as exc:
        logger.debug("Redis publish failed (non-fatal): %s", exc)


# ── Main dispatcher ────────────────────────────────────────────────────────────


HANDLERS = {
    "room_started": handle_room_started,
    "room_finished": handle_room_finished,
    "participant_joined": handle_participant_joined,
    "track_published": handle_track_published,
    "egress_ended": handle_egress_ended,
    "agent_dispatched": handle_agent_dispatched,
}


async def process_webhook_event(event_type: str, event: dict[str, Any], tenant_id: str | None = None) -> None:
    """
    Route a LiveKit webhook event to the appropriate handler and
    publish it to the Redis monitoring channel for live dashboards.

    Args:
        event_type: LiveKit webhook event type string.
        event: Full event payload dict.
        tenant_id: If known, the tenant that owns this room.
    """
    logger.info("Processing webhook event: %s (tenant=%s)", event_type, tenant_id)

    # Dispatch to specific handler
    handler = HANDLERS.get(event_type)
    if handler:
        try:
            await handler(event)
        except Exception as exc:
            logger.exception("Error in event handler %s: %s", event_type, exc)

    # Publish to monitoring Redis channel
    if tenant_id:
        channel = f"voicedesk:events:{tenant_id}"
        payload = {
            "type": event_type,
            "event": event,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        await _try_publish_redis(channel, payload)


async def save_transcript_message(
    session_id: str,
    tenant_id: str,
    role: str,
    content: str,
    latency_ms: int | None = None,
) -> None:
    """
    Persist a transcript message to the conversation_messages table.
    Called by the runtime layer after each utterance.
    """
    db = get_admin_client()
    row: dict[str, Any] = {
        "session_id": session_id,
        "tenant_id": tenant_id,
        "role": role,
        "content": content,
    }
    if latency_ms is not None:
        row["latency_ms"] = latency_ms

    try:
        db.table("conversation_messages").insert(row).execute()
    except Exception as exc:
        logger.warning("Failed to save transcript message: %s", exc)

