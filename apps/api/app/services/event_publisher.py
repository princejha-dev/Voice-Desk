"""Event publishing via Redis Streams for reliable, ordered event delivery."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as aioredis

from app.config import get_settings

logger = logging.getLogger(__name__)

STREAM_EVENTS = "voicedesk:events"
STREAM_SESSIONS = "voicedesk:session_events"
CHANNEL_PREFIX = "voicedesk:live:"

_redis_pool: aioredis.Redis | None = None


async def get_redis_connection() -> aioredis.Redis:
    """Return (or lazily create) the shared async Redis connection."""
    global _redis_pool
    if _redis_pool is None:
        settings = get_settings()
        _redis_pool = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
    return _redis_pool


async def close_redis_connection() -> None:
    """Gracefully close the Redis connection pool."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None


async def publish_event(event_type: str, payload: dict[str, Any]) -> str | None:
    """Publish an event to the main events Redis stream.

    Returns the stream message ID on success, or ``None`` if Redis is unavailable.
    """
    try:
        r = await get_redis_connection()
        message = {
            "event_type": event_type,
            "payload": json.dumps(payload, default=str),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        msg_id = await r.xadd(STREAM_EVENTS, message, maxlen=100_000)
        logger.debug("Published event %s → %s", event_type, msg_id)
        return msg_id
    except Exception:
        logger.exception("Failed to publish event %s", event_type)
        return None


async def publish_session_event(session_id: str, event: dict[str, Any]) -> str | None:
    """Publish a session-scoped event to the session events stream.

    Also publishes to a Redis Pub/Sub channel so that WebSocket consumers
    can receive the event in real time.
    """
    try:
        r = await get_redis_connection()
        message = {
            "session_id": session_id,
            "event": json.dumps(event, default=str),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        msg_id = await r.xadd(STREAM_SESSIONS, message, maxlen=500_000)

        # Also fan-out to Pub/Sub for live WebSocket consumers
        channel = f"{CHANNEL_PREFIX}{session_id}"
        await r.publish(channel, json.dumps(event, default=str))

        logger.debug("Published session event for %s → %s", session_id, msg_id)
        return msg_id
    except Exception:
        logger.exception("Failed to publish session event for %s", session_id)
        return None


async def publish_agent_live_event(org_id: str, agent_id: str, event: dict[str, Any]) -> None:
    """Publish a live event on the agent's Pub/Sub channel for WebSocket consumers."""
    try:
        r = await get_redis_connection()
        channel = f"voicedesk:agent_live:{org_id}:{agent_id}"
        await r.publish(channel, json.dumps(event, default=str))
    except Exception:
        logger.exception("Failed to publish agent live event for %s/%s", org_id, agent_id)
