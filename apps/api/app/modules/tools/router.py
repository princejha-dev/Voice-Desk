"""Tools module — manage tools available to agents."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.dependencies import TenantContext, get_tenant_context
from app.services.supabase import get_admin_client

router = APIRouter()

# Built-in tool catalog
TOOL_CATALOG = [
    {
        "id": "knowledge_search",
        "name": "Knowledge Search",
        "description": "Search the agent's knowledge base to answer customer questions.",
        "category": "knowledge",
        "config_schema": {},
    },
    {
        "id": "request_callback",
        "name": "Request Callback",
        "description": "Schedule a human callback for the customer.",
        "category": "crm",
        "config_schema": {
            "callback_url": {"type": "string", "description": "Webhook URL to receive callback requests"},
        },
    },
    {
        "id": "create_ticket",
        "name": "Create Support Ticket",
        "description": "Create a support ticket in an external system.",
        "category": "crm",
        "config_schema": {
            "api_url": {"type": "string"},
            "api_key": {"type": "string"},
        },
    },
    {
        "id": "book_appointment",
        "name": "Book Appointment",
        "description": "Book, reschedule, or cancel appointments.",
        "category": "calendar",
        "config_schema": {
            "calendar_api_url": {"type": "string"},
            "api_key": {"type": "string"},
        },
    },
    {
        "id": "send_sms",
        "name": "Send SMS",
        "description": "Send an SMS to the customer.",
        "category": "messaging",
        "config_schema": {
            "twilio_account_sid": {"type": "string"},
            "twilio_auth_token": {"type": "string"},
            "from_number": {"type": "string"},
        },
    },
]


# ── Schemas ────────────────────────────────────────────────────────────────────


class EnableToolRequest(BaseModel):
    tool_id: str
    config: dict = {}


class UpdateToolConfigRequest(BaseModel):
    config: dict


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/{org_id}/tools")
async def list_tools(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    agent_id: str | None = None,
):
    """List all available tools with enabled status per agent."""
    db = get_admin_client()

    enabled_tools: list[dict] = []
    if agent_id:
        enabled_tools = (
            db.table("agent_tools")
            .select("tool_id, config, enabled_at")
            .eq("agent_id", agent_id)
            .eq("tenant_id", org_id)
            .execute()
            .data
        )

    enabled_map = {t["tool_id"]: t for t in enabled_tools}

    result = []
    for tool in TOOL_CATALOG:
        entry = {**tool}
        if agent_id:
            if tool["id"] in enabled_map:
                entry["enabled"] = True
                entry["config"] = enabled_map[tool["id"]].get("config", {})
                entry["enabled_at"] = enabled_map[tool["id"]].get("enabled_at")
            else:
                entry["enabled"] = False
                entry["config"] = {}
        result.append(entry)

    return {"tools": result}


@router.post("/{org_id}/agents/{agent_id}/tools", status_code=status.HTTP_201_CREATED)
async def enable_tool(
    org_id: str,
    agent_id: str,
    body: EnableToolRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Enable a tool for a specific agent."""
    db = get_admin_client()

    # Verify agent belongs to org
    agent = (
        db.table("agents")
        .select("id")
        .eq("id", agent_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Validate tool exists in catalog
    tool_def = next((t for t in TOOL_CATALOG if t["id"] == body.tool_id), None)
    if not tool_def:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tool '{body.tool_id}' not found in catalog")

    now = datetime.now(timezone.utc).isoformat()

    # Upsert tool assignment
    result = (
        db.table("agent_tools")
        .upsert({
            "id": str(uuid.uuid4()),
            "tenant_id": org_id,
            "agent_id": agent_id,
            "tool_id": body.tool_id,
            "config": body.config,
            "enabled_at": now,
        }, on_conflict="agent_id,tool_id")
        .execute()
        .data
    )

    return result[0] if result else {"agent_id": agent_id, "tool_id": body.tool_id, "status": "enabled"}


@router.delete("/{org_id}/agents/{agent_id}/tools/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disable_tool(
    org_id: str,
    agent_id: str,
    tool_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Disable (remove) a tool from an agent."""
    db = get_admin_client()
    db.table("agent_tools").delete().eq("agent_id", agent_id).eq("tool_id", tool_id).eq("tenant_id", org_id).execute()


@router.put("/{org_id}/agents/{agent_id}/tools/{tool_id}")
async def update_tool_config(
    org_id: str,
    agent_id: str,
    tool_id: str,
    body: UpdateToolConfigRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Update configuration for an enabled tool."""
    db = get_admin_client()

    existing = (
        db.table("agent_tools")
        .select("id")
        .eq("agent_id", agent_id)
        .eq("tool_id", tool_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tool is not enabled for this agent. Enable it first.",
        )

    result = (
        db.table("agent_tools")
        .update({"config": body.config})
        .eq("agent_id", agent_id)
        .eq("tool_id", tool_id)
        .eq("tenant_id", org_id)
        .execute()
        .data
    )
    return result[0] if result else {}


# ── Tool Operations Data Endpoints ──────────────────────────────────────────────


class UpdateBookingStatusRequest(BaseModel):
    status: str
    notes: str | None = None


class UpdateTicketStatusRequest(BaseModel):
    status: str
    priority: str | None = None


class UpdateCallbackStatusRequest(BaseModel):
    status: str


@router.get("/{org_id}/tools/bookings")
async def list_bookings(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    agent_id: str | None = None,
    booking_status: str | None = None,
    limit: int = 50,
):
    """List appointments booked by voice agents for this organization."""
    db = get_admin_client()
    query = (
        db.table("bookings")
        .select("id, tenant_id, agent_id, session_id, customer_name, customer_phone, customer_email, booking_date, booking_time, duration_minutes, status, notes, created_at, agents(name, slug)")
        .eq("tenant_id", org_id)
        .order("booking_date", desc=True)
        .order("booking_time", desc=True)
        .limit(limit)
    )
    if agent_id:
        query = query.eq("agent_id", agent_id)
    if booking_status:
        query = query.eq("status", booking_status)

    raw_data = query.execute().data or []
    for row in raw_data:
        agent_data = row.pop("agents", None) or {}
        row["agent_name"] = agent_data.get("name") or "Voice Agent"
        row["agent_slug"] = agent_data.get("slug")
    return {"bookings": raw_data}


@router.patch("/{org_id}/tools/bookings/{booking_id}")
async def update_booking_status(
    org_id: str,
    booking_id: str,
    body: UpdateBookingStatusRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Update status of a booked appointment."""
    db = get_admin_client()
    update_data: dict = {"status": body.status}
    if body.notes is not None:
        update_data["notes"] = body.notes

    result = (
        db.table("bookings")
        .update(update_data)
        .eq("id", booking_id)
        .eq("tenant_id", org_id)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return result[0]


@router.get("/{org_id}/tools/tickets")
async def list_tickets(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    agent_id: str | None = None,
    ticket_status: str | None = None,
    priority: str | None = None,
    limit: int = 50,
):
    """List support tickets created by voice agents."""
    db = get_admin_client()
    query = (
        db.table("support_tickets")
        .select("id, tenant_id, agent_id, session_id, customer_name, customer_contact, subject, description, priority, status, created_at, agents(name, slug)")
        .eq("tenant_id", org_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if agent_id:
        query = query.eq("agent_id", agent_id)
    if ticket_status:
        query = query.eq("status", ticket_status)
    if priority:
        query = query.eq("priority", priority)

    raw_data = query.execute().data or []
    for row in raw_data:
        agent_data = row.pop("agents", None) or {}
        row["agent_name"] = agent_data.get("name") or "Voice Agent"
        row["agent_slug"] = agent_data.get("slug")
    return {"tickets": raw_data}


@router.patch("/{org_id}/tools/tickets/{ticket_id}")
async def update_ticket_status(
    org_id: str,
    ticket_id: str,
    body: UpdateTicketStatusRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Update status or priority of a support ticket."""
    db = get_admin_client()
    update_data: dict = {"status": body.status}
    if body.priority is not None:
        update_data["priority"] = body.priority

    result = (
        db.table("support_tickets")
        .update(update_data)
        .eq("id", ticket_id)
        .eq("tenant_id", org_id)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return result[0]


@router.get("/{org_id}/tools/callbacks")
async def list_callbacks(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    agent_id: str | None = None,
    callback_status: str | None = None,
    limit: int = 50,
):
    """List callback requests scheduled by voice agents."""
    db = get_admin_client()
    query = (
        db.table("callback_requests")
        .select("id, tenant_id, agent_id, session_id, customer_name, customer_phone, reason, status, created_at, agents(name, slug)")
        .eq("tenant_id", org_id)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if agent_id:
        query = query.eq("agent_id", agent_id)
    if callback_status:
        query = query.eq("status", callback_status)

    raw_data = query.execute().data or []
    for row in raw_data:
        agent_data = row.pop("agents", None) or {}
        row["agent_name"] = agent_data.get("name") or "Voice Agent"
        row["agent_slug"] = agent_data.get("slug")
    return {"callbacks": raw_data}


@router.patch("/{org_id}/tools/callbacks/{callback_id}")
async def update_callback_status(
    org_id: str,
    callback_id: str,
    body: UpdateCallbackStatusRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Update status of a callback request."""
    db = get_admin_client()
    result = (
        db.table("callback_requests")
        .update({"status": body.status})
        .eq("id", callback_id)
        .eq("tenant_id", org_id)
        .execute()
        .data
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Callback request not found")
    return result[0]


