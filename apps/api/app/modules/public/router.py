"""Public module — unauthenticated endpoints for the customer call widget."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.services.supabase import get_admin_client
from app.services import livekit_service
from app.config import get_settings

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────


class CreatePublicSessionRequest(BaseModel):
    participant_name: str = "Customer"


# ── Simple in-memory rate limiter ─────────────────────────────────────────────

_rate_limit_store: dict[str, list[float]] = {}
RATE_LIMIT_MAX = 10  # max sessions
RATE_LIMIT_WINDOW = 60.0  # seconds


def _check_rate_limit(key: str) -> None:
    import time
    now = time.time()
    timestamps = _rate_limit_store.get(key, [])
    # Purge old timestamps
    timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(timestamps) >= RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many sessions created. Please wait before trying again.",
        )
    timestamps.append(now)
    _rate_limit_store[key] = timestamps


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("/c/{slug}")
async def get_public_agent_info(slug: str):
    """Return public agent info for the customer call page."""
    db = get_admin_client()

    agent = (
        db.table("agents")
        .select("id, name, slug, tenant_id, active_version_id, agent_versions!active_version_id(config)")
        .eq("slug", slug)
        .eq("status", "published")
        .maybe_single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    version = agent.get("agent_versions") or {}
    config = version.get("config") or {}

    return {
        "agent_id": agent["id"],
        "name": agent["name"],
        "greeting": config.get("greeting", "Hello! How can I help you today?"),
        "avatar_url": config.get("avatar_url"),
        "personality": config.get("personality"),
    }


@router.post("/c/{slug}/session", status_code=status.HTTP_201_CREATED)
async def create_public_session(
    slug: str,
    body: CreatePublicSessionRequest,
    request: Request,
):
    """Create a public (customer-facing) LiveKit session for an agent."""
    # Rate limit by IP
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(f"{slug}:{client_ip}")

    db = get_admin_client()
    settings = get_settings()

    # Resolve agent from slug
    agent = (
        db.table("agents")
        .select("id, name, tenant_id, active_version_id, status")
        .eq("slug", slug)
        .eq("status", "published")
        .maybe_single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if not agent.get("active_version_id"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Agent is not ready to accept calls",
        )

    org_id = agent["tenant_id"]
    agent_id = agent["id"]
    version_id = agent["active_version_id"]
    session_id = str(uuid.uuid4())
    participant_identity = f"customer-{session_id[:8]}"
    room_name = f"voicedesk-pub-{org_id[:8]}-{agent_id[:8]}-{session_id[:8]}"

    room_metadata = {
        "tenant_id": org_id,
        "agent_id": agent_id,
        "version_id": version_id,
        "session_id": session_id,
        "source": "public_widget",
    }

    # Create LiveKit room
    try:
        await livekit_service.create_room(room_name, metadata=room_metadata)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create session room: {exc}",
        ) from exc

    # Dispatch agent to room
    try:
        await livekit_service.dispatch_agent(
            room_name=room_name,
            agent_name="voicedesk-agent",
            metadata=room_metadata,
        )
    except Exception:
        pass  # Agent can join via auto-dispatch fallback

    # Generate customer token
    try:
        token = await livekit_service.generate_token(
            room_name=room_name,
            participant_name=body.participant_name,
            participant_identity=participant_identity,
            metadata=room_metadata,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate token: {exc}",
        ) from exc

    now = datetime.now(timezone.utc).isoformat()

    # Persist call session
    db.table("call_sessions").insert({
        "id": session_id,
        "tenant_id": org_id,
        "agent_id": agent_id,
        "version_id": version_id,
        "room_name": room_name,
        "participant_identity": participant_identity,
        "status": "active",
        "started_at": now,
        "metadata": {"source": "public_widget"},
    }).execute()

    return {
        "session_id": session_id,
        "room_name": room_name,
        "token": token,
        "livekit_url": settings.LIVEKIT_URL,
    }

