"""Billing module — usage tracking and plan info."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.dependencies import TenantContext, get_tenant_context
from app.services.supabase import get_admin_client

router = APIRouter()


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/{org_id}/billing/usage")
async def get_usage_summary(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Get usage summary for the current calendar month."""
    db = get_admin_client()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    sessions = (
        db.table("call_sessions")
        .select("id, duration_seconds, metadata")
        .eq("tenant_id", org_id)
        .gte("started_at", month_start)
        .execute()
        .data
    )

    total_calls = len(sessions)
    total_seconds = sum(s.get("duration_seconds") or 0 for s in sessions)
    total_minutes = round(total_seconds / 60, 2)

    total_tokens = 0
    for s in sessions:
        meta = s.get("metadata") or {}
        total_tokens += meta.get("total_tokens", 0)

    return {
        "period": {
            "start": month_start,
            "end": now.isoformat(),
        },
        "calls": total_calls,
        "minutes": total_minutes,
        "tokens": total_tokens,
    }


@router.get("/{org_id}/billing/usage/details")
async def get_usage_details(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """Get a paginated list of usage events for the organization."""
    db = get_admin_client()

    sessions = (
        db.table("call_sessions")
        .select("id, agent_id, started_at, ended_at, duration_seconds, status, metadata")
        .eq("tenant_id", org_id)
        .order("started_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
        .data
    )

    events = [
        {
            "event_id": s["id"],
            "agent_id": s.get("agent_id"),
            "type": "call_session",
            "started_at": s.get("started_at"),
            "ended_at": s.get("ended_at"),
            "duration_seconds": s.get("duration_seconds"),
            "status": s.get("status"),
            "tokens": (s.get("metadata") or {}).get("total_tokens", 0),
        }
        for s in sessions
    ]
    return {"events": events, "limit": limit, "offset": offset}


@router.get("/{org_id}/billing/plan")
async def get_plan(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Get the current subscription plan for the organization."""
    db = get_admin_client()

    org = (
        db.table("organizations")
        .select("id, name, settings")
        .eq("id", org_id)
        .single()
        .execute()
        .data
    )

    settings_data = org.get("settings") or {}
    plan = settings_data.get("plan", "free")

    plan_limits = {
        "free": {"calls_per_month": 100, "minutes_per_month": 60, "agents": 1, "members": 2},
        "starter": {"calls_per_month": 1000, "minutes_per_month": 600, "agents": 5, "members": 5},
        "pro": {"calls_per_month": 10000, "minutes_per_month": 6000, "agents": 20, "members": 20},
        "enterprise": {"calls_per_month": -1, "minutes_per_month": -1, "agents": -1, "members": -1},
    }

    return {
        "organization_id": org_id,
        "plan": plan,
        "limits": plan_limits.get(plan, plan_limits["free"]),
        "billing_email": settings_data.get("billing_email"),
        "subscription_id": settings_data.get("subscription_id"),
    }

