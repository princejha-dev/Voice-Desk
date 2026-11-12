"""LiveKit room and token management service."""

from __future__ import annotations

from datetime import timedelta
import json
import logging
from typing import Any

from livekit.api import LiveKitAPI
from livekit.api.room_service import CreateRoomRequest, DeleteRoomRequest, ListRoomsRequest
from livekit.api.sip_service import CreateSIPDispatchRuleRequest
from livekit.protocol.agent_dispatch import CreateAgentDispatchRequest, RoomAgentDispatch
from livekit.api import AccessToken, VideoGrants

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_api() -> LiveKitAPI:
    settings = get_settings()
    return LiveKitAPI(
        url=settings.LIVEKIT_URL,
        api_key=settings.LIVEKIT_API_KEY,
        api_secret=settings.LIVEKIT_API_SECRET,
    )


async def create_room(room_name: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Create a LiveKit room and return its info."""
    api = _get_api()
    try:
        room = await api.room.create_room(
            CreateRoomRequest(
                name=room_name,
                empty_timeout=300,
                max_participants=10,
                metadata=json.dumps(metadata) if metadata else "",
            )
        )
        return {
            "name": room.name,
            "sid": room.sid,
            "metadata": room.metadata,
            "creation_time": room.creation_time,
        }
    finally:
        await api.aclose()


async def generate_token(
    room_name: str,
    participant_name: str,
    participant_identity: str,
    metadata: dict[str, Any] | None = None,
    ttl_seconds: int = 3600,
) -> str:
    """Generate a LiveKit access token for a participant."""
    settings = get_settings()
    token = (
        AccessToken(settings.LIVEKIT_API_KEY, settings.LIVEKIT_API_SECRET)
        .with_identity(participant_identity)
        .with_name(participant_name)
        .with_grants(
            VideoGrants(
                room_join=True,
                room=room_name,
            )
        )
        .with_metadata(json.dumps(metadata) if metadata else "")
        .with_ttl(timedelta(seconds=ttl_seconds))
    )
    return token.to_jwt()


async def dispatch_agent(
    room_name: str,
    agent_name: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Dispatch an agent to a specific room using explicit dispatch."""
    api = _get_api()
    try:
        dispatch = await api.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                room=room_name,
                agent_name=agent_name,
                metadata=json.dumps(metadata) if metadata else "",
            )
        )
        return {
            "dispatch_id": dispatch.id,
            "room": dispatch.room,
            "agent_name": dispatch.agent_name,
        }
    finally:
        await api.aclose()


async def delete_room(room_name: str) -> None:
    """Delete a LiveKit room."""
    api = _get_api()
    try:
        await api.room.delete_room(DeleteRoomRequest(room=room_name))
    finally:
        await api.aclose()


async def list_rooms() -> list[dict[str, Any]]:
    """List all active LiveKit rooms."""
    api = _get_api()
    try:
        response = await api.room.list_rooms(ListRoomsRequest())
        return [
            {
                "name": r.name,
                "sid": r.sid,
                "num_participants": r.num_participants,
                "creation_time": r.creation_time,
                "metadata": r.metadata,
            }
            for r in response.rooms
        ]
    finally:
        await api.aclose()
