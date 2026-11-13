"""Sessions module — list, inspect, and manage call sessions."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import TenantContext, get_tenant_context
from app.services.supabase import get_admin_client

router = APIRouter()


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/{org_id}/sessions")
async def list_sessions(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    agent_id: str | None = Query(default=None),
    session_status: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """List call sessions for an organization with optional filters."""
    db = get_admin_client()

    query = (
        db.table("call_sessions")
        .select("id, agent_id, tenant_id, room_name, status, started_at, ended_at, duration_seconds, participant_identity, metadata, agents(name, slug)")
        .eq("tenant_id", org_id)
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if agent_id:
        query = query.eq("agent_id", agent_id)
    if session_status:
        query = query.eq("status", session_status)

    raw_sessions = query.execute().data or []
    sessions = []
    for s in raw_sessions:
        agent_data = s.pop("agents", None) or {}
        s["agent_name"] = agent_data.get("name") or "Agent"
        s["agent_slug"] = agent_data.get("slug")
        if not s.get("duration_seconds") and s.get("started_at") and s.get("ended_at"):
            try:
                t1 = datetime.fromisoformat(s["started_at"].replace("Z", "+00:00"))
                t2 = datetime.fromisoformat(s["ended_at"].replace("Z", "+00:00"))
                s["duration_seconds"] = max(0, int((t2 - t1).total_seconds()))
            except Exception:
                pass
        sessions.append(s)

    return {"sessions": sessions, "limit": limit, "offset": offset}


@router.get("/{org_id}/sessions/{session_id}")
async def get_session(
    org_id: str,
    session_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Get session detail including conversation messages."""
    db = get_admin_client()

    session = (
        db.table("call_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    messages = (
        db.table("conversation_messages")
        .select("id, role, content, created_at, metadata")
        .eq("session_id", session_id)
        .order("created_at", desc=False)
        .execute()
        .data
    )

    return {**session, "messages": messages}


@router.get("/{org_id}/sessions/{session_id}/metrics")
async def get_session_metrics(
    org_id: str,
    session_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Get performance metrics for a session: latency, tokens, tool calls."""
    db = get_admin_client()

    session = (
        db.table("call_sessions")
        .select("id, tenant_id, duration_seconds, metadata")
        .eq("id", session_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    messages = (
        db.table("conversation_messages")
        .select("role, metadata")
        .eq("session_id", session_id)
        .execute()
        .data
    )

    total_tokens = 0
    tool_call_count = 0
    latencies: list[float] = []

    for msg in messages:
        meta = msg.get("metadata") or {}
        total_tokens += meta.get("tokens", 0)
        if meta.get("tool_calls"):
            tool_call_count += len(meta["tool_calls"])
        if meta.get("latency_ms"):
            latencies.append(meta["latency_ms"])

    avg_latency = sum(latencies) / len(latencies) if latencies else None

    return {
        "session_id": session_id,
        "duration_seconds": session.get("duration_seconds"),
        "total_tokens": total_tokens,
        "tool_call_count": tool_call_count,
        "avg_latency_ms": avg_latency,
        "message_count": len(messages),
    }


@router.post("/{org_id}/sessions/{session_id}/end", status_code=status.HTTP_200_OK)
async def end_session(
    org_id: str,
    session_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Mark a session as ended."""
    db = get_admin_client()

    session = (
        db.table("call_sessions")
        .select("id, tenant_id, status, started_at")
        .eq("id", session_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if session.get("status") == "ended":
        return {"message": "Session already ended", "session_id": session_id}

    now = datetime.now(timezone.utc)
    started_at = session.get("started_at")
    duration_seconds = None
    if started_at:
        try:
            started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            duration_seconds = int((now - started).total_seconds())
        except (ValueError, TypeError):
            pass

    updated = (
        db.table("call_sessions")
        .update({
            "status": "ended",
            "ended_at": now.isoformat(),
            "duration_seconds": duration_seconds,
        })
        .eq("id", session_id)
        .eq("tenant_id", org_id)
        .execute()
        .data
    )
    return updated[0] if updated else {"session_id": session_id, "status": "ended"}

