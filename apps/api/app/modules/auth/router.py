"""Auth router — signup, login, logout, profile, token refresh."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.dependencies import CurrentUser, get_current_user, get_supabase_client
from app.modules.auth.schemas import (
    AuthSessionResponse,
    LoginRequest,
    RefreshRequest,
    SignupRequest,
    UserProfileResponse,
    UserResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=AuthSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def signup(
    body: SignupRequest,
    db: Annotated[Client, Depends(get_supabase_client)],
):
    """Create a new user account via Supabase Auth and persist a profile row."""
    try:
        auth_response = db.auth.sign_up(
            {
                "email": body.email,
                "password": body.password,
                "options": {
                    "data": {"full_name": body.full_name},
                },
            }
        )
    except Exception as exc:
        logger.exception("Signup failed")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Signup failed: {exc}",
        ) from exc

    user = auth_response.user
    session = auth_response.session

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup failed — user not created",
        )

    # Upsert profile record
    db.table("profiles").upsert(
        {
            "id": user.id,
            "email": body.email,
            "full_name": body.full_name,
        }
    ).execute()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_201_CREATED,
            detail="User created — please confirm your email before logging in",
        )

    return AuthSessionResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in or 3600,
        user=UserResponse(
            id=user.id,
            email=user.email or body.email,
            full_name=body.full_name,
            created_at=getattr(user, "created_at", None),
        ),
    )


@router.post(
    "/login",
    response_model=AuthSessionResponse,
    summary="Log in with email and password",
)
async def login(
    body: LoginRequest,
    db: Annotated[Client, Depends(get_supabase_client)],
):
    """Authenticate against Supabase Auth and return a session."""
    try:
        auth_response = db.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        logger.exception("Login failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        ) from exc

    user = auth_response.user
    session = auth_response.session

    if not user or not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Fetch profile for full_name
    profile = (
        db.table("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    full_name = profile.data.get("full_name") if profile.data else None

    return AuthSessionResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in or 3600,
        user=UserResponse(
            id=user.id,
            email=user.email or body.email,
            full_name=full_name,
            avatar_url=profile.data.get("avatar_url") if profile.data else None,
            created_at=getattr(user, "created_at", None),
        ),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Log out")
async def logout(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Client, Depends(get_supabase_client)],
):
    """Sign out the current user (revoke the session server-side)."""
    try:
        db.auth.admin.sign_out(user.id)
    except Exception:
        logger.warning("Logout sign-out call failed for user %s — ignoring", user.id)
    return None


@router.get("/me", response_model=UserProfileResponse, summary="Get current user profile")
async def me(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[Client, Depends(get_supabase_client)],
):
    """Return the authenticated user's profile including their organizations."""
    profile = (
        db.table("profiles")
        .select("id, email, full_name, avatar_url, created_at")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )

    if not profile.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    # Fetch organizations the user belongs to
    memberships = (
        db.table("organization_members")
        .select("organization_id, role, organizations(id, name, slug, created_at)")
        .eq("user_id", user.id)
        .execute()
    )

    orgs = []
    for m in memberships.data or []:
        org_data = m.get("organizations", {})
        if org_data:
            orgs.append(
                {
                    "id": org_data["id"],
                    "name": org_data["name"],
                    "slug": org_data.get("slug"),
                    "role": m["role"],
                    "created_at": org_data.get("created_at"),
                }
            )

    return UserProfileResponse(**profile.data, organizations=orgs)


@router.post(
    "/refresh",
    response_model=AuthSessionResponse,
    summary="Refresh access token",
)
async def refresh_token(
    body: RefreshRequest,
    db: Annotated[Client, Depends(get_supabase_client)],
):
    """Exchange a refresh token for a new access token."""
    try:
        auth_response = db.auth.refresh_session(body.refresh_token)
    except Exception as exc:
        logger.exception("Token refresh failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        ) from exc

    user = auth_response.user
    session = auth_response.session

    if not user or not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh session",
        )

    return AuthSessionResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in or 3600,
        user=UserResponse(
            id=user.id,
            email=user.email or "",
            created_at=getattr(user, "created_at", None),
        ),
    )
