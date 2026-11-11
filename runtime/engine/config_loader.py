import logging
import os
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger(__name__)

_supabase: Client | None = None


def _get_supabase() -> Client:
    """Return (or create) the service-role Supabase client."""
    global _supabase
    if _supabase is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _supabase = create_client(url, key)
    return _supabase


@lru_cache(maxsize=100)
def _cached_load(version_id: str, tenant_id: str, agent_id: str) -> dict:
    """
    Synchronous inner loader so lru_cache works.

    Agent configs are immutable once published, so caching by version_id is safe.
    Triple-check: version_id AND tenant_id AND agent_id must all match.
    """
    client = _get_supabase()

    response = (
        client.table("agent_versions")
        .select("config")
        .eq("id", version_id)
        .eq("tenant_id", tenant_id)
        .eq("agent_id", agent_id)
        .single()
        .execute()
    )

    if not response.data:
        # Security boundary: missing means either not found OR cross-tenant mismatch.
        raise ValueError(
            f"agent_version not found: version_id={version_id} "
            f"tenant_id={tenant_id} agent_id={agent_id}"
        )

    config: dict = response.data.get("config") or {}
    logger.info(
        "Loaded agent config for version_id=%s tenant_id=%s agent_id=%s",
        version_id,
        tenant_id,
        agent_id,
    )
    return config


async def load_config(version_id: str, tenant_id: str, agent_id: str) -> dict[str, Any]:
    """
    Public async interface.  Delegates to the LRU-cached sync loader.

    Args:
        version_id: UUID of the agent version row.
        tenant_id:  UUID of the owning tenant.  Used as a security check.
        agent_id:   UUID of the agent.  Used as a security check.

    Returns:
        The ``config`` JSONB column as a Python dict.

    Raises:
        ValueError: If the row is not found or any ID does not match.
    """
    return _cached_load(version_id, tenant_id, agent_id)
