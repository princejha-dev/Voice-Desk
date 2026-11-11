"""
Telemetry: publish session events to Redis for real-time monitoring.

Events are published on a per-tenant channel so each tenant's dashboard only
sees its own events.  Channel format: voicedesk:events:{tenant_id}
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
    return _redis_client


async def publish_session_event(
    event_type: str,
    data: dict,
    tenant_id: str,
) -> None:
    """
    Publish a session event to the tenant-scoped Redis pub/sub channel.

    Args:
        event_type: A short string describing the event (e.g. "session_started",
                    "message_saved", "session_ended", "tool_called").
        data:       Arbitrary dict payload to include in the event.
        tenant_id:  The owning tenant.  Used to scope the channel — consumers
                    for other tenants will never see this event.
    """
    channel = f"voicedesk:events:{tenant_id}"
    payload = {
        "event_type": event_type,
        "tenant_id": tenant_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }

    try:
        client = _get_redis()
        await client.publish(channel, json.dumps(payload))
        logger.debug(
            "Published event '%s' to channel '%s'", event_type, channel
        )
    except Exception:
        # Telemetry failures must never crash the voice session.
        logger.exception(
            "Failed to publish event '%s' for tenant '%s'",
            event_type,
            tenant_id,
        )
