"""Supabase client helpers."""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_admin_client() -> Client:
    """Return a Supabase client authenticated with the service-role key.

    This client bypasses Row-Level Security and should only be used for
    server-side administrative operations.
    """
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def get_user_client(access_token: str) -> Client:
    """Return a Supabase client scoped to the calling user's JWT.

    This client respects Row-Level Security policies defined on the
    database tables.
    """
    settings = get_settings()
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    client.auth.set_session(access_token, "")
    return client
