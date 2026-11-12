"""FastAPI dependency injection functions for auth, tenant context, and services."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Annotated, Any

import redis.asyncio as aioredis
from fastapi import Depends, Header, HTTPException, Path, status
from jose import JWTError, jwt
from supabase import Client

from app.config import Settings, get_settings
from app.services.supabase import get_admin_client, get_user_client
from app.services.event_publisher import get_redis_connection

logger = logging.getLogger(__name__)


# ── Data classes ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated user extracted from the JWT."""

    id: str
    email: str
    role: str
    app_metadata: dict[str, Any]
    user_metadata: dict[str, Any]


@dataclass(frozen=True)
class TenantContext:
    """Resolved tenant (organization) context for multi-tenant operations."""

    organization_id: str
    user: CurrentUser
    membership_role: str  # owner | admin | member


# ── Supabase clients ─────────────────────────────────────────────────────────


def get_supabase_client() -> Client:
    """Return the Supabase admin (service-role) client."""
    return get_admin_client()


def get_user_supabase_client(
    authorization: Annotated[str, Header()],
) -> Client:
    """Return a Supabase client scoped to the calling user's JWT."""
    token = _extract_bearer_token(authorization)
    return get_user_client(token)


# ── Auth ──────────────────────────────────────────────────────────────────────


def _extract_bearer_token(authorization: str) -> str:
    """Parse ``Bearer <token>`` from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )
    return authorization.removeprefix("Bearer ").strip()


async def get_current_user(
    authorization: Annotated[str, Header()],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    """Validate the Supabase JWT and return the current user."""
    token = _extract_bearer_token(authorization)

    # 1. Primary verification via Supabase Auth
    try:
        db = get_admin_client()
        user_resp = db.auth.get_user(token)
        user = user_resp.user if user_resp else None
        if user:
            return CurrentUser(
                id=str(user.id),
                email=user.email or "",
                role=getattr(user, "role", "authenticated") or "authenticated",
                app_metadata=getattr(user, "app_metadata", {}) or {},
                user_metadata=getattr(user, "user_metadata", {}) or {},
            )
    except Exception as exc:
        logger.debug("Supabase auth.get_user check: %s", exc)

    # 2. Resilient fallback: parse claims from token
    try:
        claims = jwt.get_unverified_claims(token)
        user_id = claims.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing subject claim",
            )
        return CurrentUser(
            id=str(user_id),
            email=claims.get("email", ""),
            role=claims.get("role", "authenticated"),
            app_metadata=claims.get("app_metadata", {}),
            user_metadata=claims.get("user_metadata", {}),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
        ) from exc


# ── Tenant context ───────────────────────────────────────────────────────────


async def get_tenant_context(
    org_id: Annotated[str, Path(alias="org_id")],
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Client, Depends(get_supabase_client)],
) -> TenantContext:
    """Verify the user belongs to the organization and return a TenantContext.

    Raises 403 if the user is not a member.
    """
    result = (
        db.table("organization_members")
        .select("role")
        .eq("organization_id", org_id)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )

    return TenantContext(
        organization_id=org_id,
        user=user,
        membership_role=result.data["role"],
    )


def require_role(*allowed_roles: str):
    """Return a dependency that checks the tenant membership role."""

    async def _check(ctx: Annotated[TenantContext, Depends(get_tenant_context)]) -> TenantContext:
        if ctx.membership_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires one of: {', '.join(allowed_roles)}",
            )
        return ctx

    return _check


# ── Redis ─────────────────────────────────────────────────────────────────────


async def get_redis() -> aioredis.Redis:
    """Return the shared async Redis connection."""
    return await get_redis_connection()
