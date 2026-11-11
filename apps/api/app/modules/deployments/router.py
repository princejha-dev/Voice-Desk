"""Deployments module — session creation, deploy info, and webhook management."""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.dependencies import TenantContext, get_tenant_context
from app.services.supabase import get_admin_client
from app.services import livekit_service
from app.config import get_settings

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────


class CreateSessionRequest(BaseModel):
    participant_name: str = "Customer"
    participant_identity: str | None = None
    metadata: dict | None = None


# ── Routes ────────────────────────────────────────────────────────────────────


@router.post("/{org_id}/agents/{agent_id}/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    org_id: str,
    agent_id: str,
    body: CreateSessionRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Create a LiveKit room, dispatch the agent, and return connection info."""
    db = get_admin_client()
    settings = get_settings()

    # Verify agent belongs to this org and has an active version
    agent = (
        db.table("agents")
        .select("id, name, active_version_id, status")
        .eq("id", agent_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if not agent.get("active_version_id"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent has no published version. Publish a version before creating sessions.",
        )

    session_id = str(uuid.uuid4())
    version_id = agent["active_version_id"]
    room_name = f"voicedesk-{org_id[:8]}-{agent_id[:8]}-{session_id[:8]}"

    # Room metadata for the agent worker to pick up
    room_metadata = {
        "tenant_id": org_id,
        "agent_id": agent_id,
        "version_id": version_id,
        "session_id": session_id,
    }

    # Create LiveKit room
    try:
        await livekit_service.create_room(room_name, metadata=room_metadata)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create LiveKit room: {exc}",
        ) from exc

    # Dispatch the agent worker to the room
    try:
        await livekit_service.dispatch_agent(
            room_name=room_name,
            agent_name="voicedesk-agent",
            metadata=room_metadata,
        )
    except Exception as exc:
        # Non-fatal — agent can also join via auto-dispatch
        pass

    # Generate participant token
    participant_identity = body.participant_identity or f"user-{session_id[:8]}"
    try:
        token = await livekit_service.generate_token(
            room_name=room_name,
            participant_name=body.participant_name,
            participant_identity=participant_identity,
            metadata=body.metadata,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate LiveKit token: {exc}",
        ) from exc

    now = datetime.now(timezone.utc).isoformat()

    # Persist the session record
    db.table("call_sessions").insert({
        "id": session_id,
        "tenant_id": org_id,
        "agent_id": agent_id,
        "version_id": version_id,
        "room_name": room_name,
        "participant_identity": participant_identity,
        "status": "active",
        "started_at": now,
        "metadata": body.metadata or {},
    }).execute()

    return {
        "session_id": session_id,
        "room_name": room_name,
        "token": token,
        "livekit_url": settings.LIVEKIT_URL,
    }


@router.get("/{org_id}/agents/{agent_id}/deploy-info")
async def get_deploy_info(
    org_id: str,
    agent_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    request: Request,
):
    """Return the agent's active version and embeddable widget code."""
    db = get_admin_client()

    agent = (
        db.table("agents")
        .select("id, name, slug, active_version_id, status, agent_versions!active_version_id(id, version, published_at, config)")
        .eq("id", agent_id)
        .eq("tenant_id", org_id)
        .maybe_single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    slug = agent.get("slug") or agent_id
    base_url = str(request.base_url).rstrip("/")

    embed_code = (
        f'<script src="{base_url}/widget/voicedesk.js" '
        f'data-agent="{slug}" '
        f'data-org="{org_id}"></script>'
    )

    return {
        "agent_id": agent_id,
        "agent_name": agent.get("name"),
        "status": agent.get("status"),
        "active_version": agent.get("agent_versions"),
        "embed_code": embed_code,
        "public_url": f"{base_url}/c/{slug}",
    }


@router.post("/{org_id}/agents/{agent_id}/webhook-url")
async def generate_webhook_url(
    org_id: str,
    agent_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
    request: Request,
):
    """Generate or rotate the webhook URL for LiveKit event callbacks."""
    db = get_admin_client()

    # Verify agent exists and belongs to this org
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

    webhook_secret = secrets.token_urlsafe(32)
    webhook_token = secrets.token_urlsafe(16)

    base_url = str(request.base_url).rstrip("/")
    webhook_url = f"{base_url}/api/v1/webhooks/livekit/{org_id}/{agent_id}?token={webhook_token}"

    # Persist token and secret on the agent record
    now = datetime.now(timezone.utc).isoformat()
    db.table("agents").update({
        "webhook_secret": webhook_secret,
        "webhook_token": webhook_token,
        "updated_at": now,
    }).eq("id", agent_id).eq("tenant_id", org_id).execute()

    return {
        "webhook_url": webhook_url,
        "webhook_secret": webhook_secret,
        "note": "Store the webhook_secret securely. It is used to verify incoming webhook payloads.",
    }

