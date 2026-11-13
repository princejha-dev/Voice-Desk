"""Agent module routers — CRUD + versioning + publish."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel

from app.dependencies import TenantContext, get_tenant_context, get_current_user
from app.services.supabase import get_admin_client

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class LLMConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    temperature: float = 0.3
    max_tokens: int | None = None


class STTConfig(BaseModel):
    provider: str = "deepgram"
    model: str = "nova-3"
    language: str = "en"


class TTSConfig(BaseModel):
    provider: str = "cartesia"
    voice_id: str = "default"
    voice_name: str = "Professional Female"


class GuardrailConfig(BaseModel):
    refuse_off_topic: bool = True
    require_knowledge_base: bool = True
    offer_human_fallback: bool = True


class AgentConfigSchema(BaseModel):
    instructions: str = ""
    greeting: str = ""
    personality: str = ""
    llm: LLMConfig = LLMConfig()
    stt: STTConfig = STTConfig()
    tts: TTSConfig = TTSConfig()
    tools: list[str] = ["knowledge_search", "request_callback"]
    guardrails: GuardrailConfig = GuardrailConfig()
    knowledge_base_ids: list[str] = []


class CreateAgentRequest(BaseModel):
    name: str
    description: str | None = None
    template: str | None = None


class UpdateAgentRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class SaveVersionRequest(BaseModel):
    config: AgentConfigSchema


class PublishRequest(BaseModel):
    version_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

TEMPLATE_DEFAULTS: dict[str, dict] = {
    "customer_support": {
        "instructions": "You are a helpful customer support assistant. Answer questions using only the provided knowledge base. If you don't know, say so and offer a callback.",
        "greeting": "Hello! Thank you for calling. How can I help you today?",
        "personality": "Professional, friendly, and patient",
        "tools": ["knowledge_search", "create_ticket", "request_callback"],
    },
    "appointment_booking": {
        "instructions": "You are an appointment booking assistant. Help callers schedule, reschedule, or cancel appointments.",
        "greeting": "Hi! I'd love to help you schedule an appointment. When works best for you?",
        "personality": "Warm, organized, and efficient",
        "tools": ["knowledge_search", "book_appointment", "request_callback"],
    },
    "sales_assistant": {
        "instructions": "You are a sales assistant. Qualify leads, answer product questions, and capture contact info. Be helpful, not pushy.",
        "greeting": "Welcome! I'm here to help you find the right solution. What are you looking for?",
        "personality": "Confident, knowledgeable, and consultative",
        "tools": ["knowledge_search", "request_callback", "book_appointment"],
    },
    "business_assistant": {
        "instructions": "You are a general business receptionist. Provide business information and route calls.",
        "greeting": "Thank you for calling! How may I direct your inquiry today?",
        "personality": "Professional, courteous, and well-informed",
        "tools": ["knowledge_search", "request_callback"],
    },
}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/{org_id}/agents", status_code=status.HTTP_201_CREATED)
async def create_agent(
    org_id: str,
    body: CreateAgentRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Create a new agent for the organization."""
    db = get_admin_client()

    defaults = TEMPLATE_DEFAULTS.get(body.template or "", {})
    initial_config = AgentConfigSchema(**defaults).model_dump()

    # Insert agent
    agent = (
        db.table("agents")
        .insert({
            "tenant_id": org_id,
            "name": body.name,
            "description": body.description,
            "template": body.template,
            "status": "draft",
        })
        .execute()
        .data[0]
    )

    # Create version 1
    version = (
        db.table("agent_versions")
        .insert({
            "tenant_id": org_id,
            "agent_id": agent["id"],
            "version": 1,
            "config": initial_config,
            "created_by": ctx.user.id,
        })
        .execute()
        .data[0]
    )

    return {"agent": agent, "initial_version": version}


@router.get("/{org_id}/agents")
async def list_agents(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    db = get_admin_client()
    agents = (
        db.table("agents")
        .select("*, agent_versions!active_version_id(id, version, published_at)")
        .eq("tenant_id", org_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    return {"agents": agents}


@router.get("/{org_id}/agents/{agent_id}")
async def get_agent(
    org_id: str,
    agent_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    db = get_admin_client()
    agent = (
        db.table("agents")
        .select("*, agent_versions!active_version_id(*)")
        .eq("id", agent_id)
        .eq("tenant_id", org_id)
        .single()
        .execute()
        .data
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{org_id}/agents/{agent_id}")
async def update_agent(
    org_id: str,
    agent_id: str,
    body: UpdateAgentRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    db = get_admin_client()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    agent = (
        db.table("agents")
        .update(updates)
        .eq("id", agent_id)
        .eq("tenant_id", org_id)
        .execute()
        .data
    )
    return agent[0] if agent else {}


@router.delete("/{org_id}/agents/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    org_id: str,
    agent_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    db = get_admin_client()
    db.table("agents").delete().eq("id", agent_id).eq("tenant_id", org_id).execute()


@router.post("/{org_id}/agents/{agent_id}/versions", status_code=status.HTTP_201_CREATED)
async def save_version(
    org_id: str,
    agent_id: str,
    body: SaveVersionRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Save a new immutable config snapshot for an agent."""
    db = get_admin_client()

    # Get current max version
    existing = (
        db.table("agent_versions")
        .select("version")
        .eq("agent_id", agent_id)
        .eq("tenant_id", org_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
        .data
    )
    next_version = (existing[0]["version"] + 1) if existing else 1

    version = (
        db.table("agent_versions")
        .insert({
            "tenant_id": org_id,
            "agent_id": agent_id,
            "version": next_version,
            "config": body.config.model_dump(),
            "created_by": ctx.user.id,
        })
        .execute()
        .data[0]
    )
    return version


@router.get("/{org_id}/agents/{agent_id}/versions")
async def list_versions(
    org_id: str,
    agent_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    db = get_admin_client()
    versions = (
        db.table("agent_versions")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("tenant_id", org_id)
        .order("version", desc=True)
        .execute()
        .data
    )
    return {"versions": versions}


@router.post("/{org_id}/agents/{agent_id}/publish")
async def publish_agent(
    org_id: str,
    agent_id: str,
    body: PublishRequest,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Publish a specific version — sets active_version_id and marks agent as published."""
    db = get_admin_client()

    # Verify version belongs to this agent + tenant
    version = (
        db.table("agent_versions")
        .select("id, version")
        .eq("id", body.version_id)
        .eq("agent_id", agent_id)
        .eq("tenant_id", org_id)
        .single()
        .execute()
        .data
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    now = datetime.now(timezone.utc).isoformat()

    # Mark version as published
    db.table("agent_versions").update({"published_at": now}).eq("id", body.version_id).execute()

    # Update agent active_version_id and status
    agent = (
        db.table("agents")
        .update({
            "active_version_id": body.version_id,
            "status": "published",
            "updated_at": now,
        })
        .eq("id", agent_id)
        .eq("tenant_id", org_id)
        .execute()
        .data[0]
    )
    return {"agent": agent, "published_version": version}

