"""Organizations module — CRUD + member management."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.dependencies import CurrentUser, TenantContext, get_current_user, get_tenant_context, require_role
from app.services.supabase import get_admin_client

router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────


class CreateOrgRequest(BaseModel):
    name: str
    slug: str | None = None


class UpdateOrgRequest(BaseModel):
    name: str | None = None
    settings: dict | None = None


class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = "member"  # owner | admin | member


# ── Routes ────────────────────────────────────────────────────────────────────


@router.get("")
async def list_organizations(
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """List all organizations the current user belongs to."""
    db = get_admin_client()
    memberships = (
        db.table("organization_members")
        .select("role, organizations(id, name, slug, settings, created_at)")
        .eq("user_id", user.id)
        .execute()
        .data
    )
    orgs = [
        {**m["organizations"], "membership_role": m["role"]}
        for m in memberships
        if m.get("organizations")
    ]
    return {"organizations": orgs}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: CreateOrgRequest,
    user: Annotated[CurrentUser, Depends(get_current_user)],
):
    """Create a new organization and add the creator as owner."""
    db = get_admin_client()
    now = datetime.now(timezone.utc).isoformat()
    org_id = str(uuid.uuid4())
    slug = body.slug or body.name.lower().replace(" ", "-") + "-" + org_id[:8]

    org = (
        db.table("organizations")
        .insert({
            "id": org_id,
            "name": body.name,
            "slug": slug,
            "settings": {},
            "created_at": now,
            "updated_at": now,
        })
        .execute()
        .data[0]
    )

    # Add creator as owner
    db.table("organization_members").insert({
        "id": str(uuid.uuid4()),
        "organization_id": org_id,
        "user_id": user.id,
        "role": "owner",
        "joined_at": now,
    }).execute()

    return org


@router.get("/{org_id}")
async def get_organization(
    org_id: str,
    ctx: Annotated[TenantContext, Depends(get_tenant_context)],
):
    """Get organization detail including member list."""
    db = get_admin_client()
    org = (
        db.table("organizations")
        .select("*")
        .eq("id", org_id)
        .single()
        .execute()
        .data
    )
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    members = (
        db.table("organization_members")
        .select("user_id, role, joined_at")
        .eq("organization_id", org_id)
        .execute()
        .data
    )
    return {**org, "members": members}


@router.put("/{org_id}")
async def update_organization(
    org_id: str,
    body: UpdateOrgRequest,
    ctx: Annotated[TenantContext, Depends(require_role("owner", "admin"))],
):
    """Update organization name or settings."""
    db = get_admin_client()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    org = (
        db.table("organizations")
        .update(updates)
        .eq("id", org_id)
        .execute()
        .data
    )
    return org[0] if org else {}


@router.post("/{org_id}/members", status_code=status.HTTP_201_CREATED)
async def invite_member(
    org_id: str,
    body: InviteMemberRequest,
    ctx: Annotated[TenantContext, Depends(require_role("owner", "admin"))],
):
    """Invite a user to the organization by email."""
    db = get_admin_client()

    # Look up user by email via auth admin API
    try:
        users_resp = db.auth.admin.list_users()
        target_user = next(
            (u for u in users_resp if u.email == body.email), None
        )
    except Exception:
        target_user = None

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found with that email address",
        )

    # Check if already a member
    existing = (
        db.table("organization_members")
        .select("id")
        .eq("organization_id", org_id)
        .eq("user_id", target_user.id)
        .maybe_single()
        .execute()
        .data
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organization",
        )

    now = datetime.now(timezone.utc).isoformat()
    member = (
        db.table("organization_members")
        .insert({
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "user_id": target_user.id,
            "role": body.role,
            "joined_at": now,
        })
        .execute()
        .data[0]
    )
    return member


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: str,
    user_id: str,
    ctx: Annotated[TenantContext, Depends(require_role("owner", "admin"))],
):
    """Remove a member from the organization."""
    # Prevent removing the last owner
    if user_id == ctx.user.id and ctx.membership_role == "owner":
        db = get_admin_client()
        owners = (
            db.table("organization_members")
            .select("id")
            .eq("organization_id", org_id)
            .eq("role", "owner")
            .execute()
            .data
        )
        if len(owners) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the only owner of an organization",
            )

    db = get_admin_client()
    db.table("organization_members").delete().eq("organization_id", org_id).eq("user_id", user_id).execute()

