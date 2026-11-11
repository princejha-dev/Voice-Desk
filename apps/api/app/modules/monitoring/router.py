"""Monitoring module — aggregate metrics and live WebSocket stream."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.dependencies import TenantContext, get_tenant_context, get_current_user, CurrentUser
from app.services.supabase import get_admin_client
from app.services.event_publisher import get_redis_connection

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/{org_id}/monitoring/overview")
async def get_monitoring_overview(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Aggregate metrics for the organization: today's calls, avg duration, success rate."""
    db = get_admin_client()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    all_today = (
        db.table("call_sessions")
        .select("id, status, duration_seconds, started_at")
        .eq("tenant_id", org_id)
        .gte("started_at", today_start)
        .execute()
        .data
    )

    total_calls = len(all_today)
    ended = [s for s in all_today if s.get("status") == "ended"]
    successful = [s for s in ended if s.get("duration_seconds") and s["duration_seconds"] > 0]

    durations = [s["duration_seconds"] for s in ended if s.get("duration_seconds")]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0
    success_rate = round(len(successful) / total_calls * 100, 1) if total_calls > 0 else 0

    # Active sessions (started but not ended)
    active_count = len([s for s in all_today if s.get("status") == "active"])

    return {
        "date": today_start[:10],
        "total_calls_today": total_calls,
        "active_calls": active_count,
        "avg_duration_seconds": avg_duration,
        "success_rate_percent": success_rate,
        "ended_calls": len(ended),
    }


@router.get("/{org_id}/monitoring/agents/{agent_id}/analytics")
async def get_agent_analytics(
    org_id: str,
    agent_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    days: int = 7,
):
    """Per-agent analytics over the last N days."""
    db = get_admin_client()

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    sessions = (
        db.table("call_sessions")
        .select("id, status, duration_seconds, started_at, metadata")
        .eq("tenant_id", org_id)
        .eq("agent_id", agent_id)
        .gte("started_at", since)
        .execute()
        .data
    )

    total = len(sessions)
    ended = [s for s in sessions if s.get("status") == "ended"]
    durations = [s["duration_seconds"] for s in ended if s.get("duration_seconds")]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    # Daily breakdown
    daily: dict[str, int] = {}
    for s in sessions:
        day = (s.get("started_at") or "")[:10]
        if day:
            daily[day] = daily.get(day, 0) + 1

    daily_sorted = [{"date": k, "calls": v} for k, v in sorted(daily.items())]

    total_tokens = sum(
        (s.get("metadata") or {}).get("total_tokens", 0) for s in sessions
    )

    return {
        "agent_id": agent_id,
        "period_days": days,
        "total_sessions": total,
        "avg_duration_seconds": avg_duration,
        "total_tokens": total_tokens,
        "daily_breakdown": daily_sorted,
    }


@router.websocket("/{org_id}/monitoring/live")
async def live_monitoring_ws(
    websocket: WebSocket,
    org_id: str,
):
    """WebSocket endpoint for live session event streaming via Redis Pub/Sub."""
    await websocket.accept()
    redis = None
    pubsub = None

    try:
        redis = await get_redis_connection()
        pubsub = redis.pubsub()
        channel = f"voicedesk:live:{org_id}:*"

        # Subscribe to org-level channel
        await pubsub.psubscribe(f"voicedesk:live:{org_id}:*")
        logger.info("WS client connected to live monitoring for org %s", org_id)

        async for message in pubsub.listen():
            if message["type"] in ("pmessage", "message"):
                data = message.get("data")
                if data:
                    await websocket.send_text(data if isinstance(data, str) else data.decode())

    except WebSocketDisconnect:
        logger.info("WS client disconnected from live monitoring for org %s", org_id)
    except Exception as exc:
        logger.error("WS error for org %s: %s", org_id, exc)
        try:
            await websocket.send_text(json.dumps({"error": str(exc)}))
        except Exception:
            pass
    finally:
        if pubsub:
            try:
                await pubsub.punsubscribe()
                await pubsub.aclose()
            except Exception:
                pass

