"""
VoiceDesk LiveKit Runtime — Worker Entrypoint.

This module is the LiveKit agent worker process.  LiveKit calls ``entrypoint``
once for every new room/job dispatched to this worker pool.

Security model
--------------
* Room metadata is set server-side by the VoiceDesk API and contains
  tenant_id, agent_id, version_id, session_id.
* These values are NEVER read from participant metadata or any participant
  message — only from ctx.room.metadata which the LiveKit server signs.
* The session context (SessionContext) is built from the validated metadata and
  injected into every tool call so tenant isolation is enforced in code, not
  relying solely on RLS.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Ensure root directory is on sys.path so 'runtime' package can be imported
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Ensure runtime directory's .env is loaded
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()  # fallback to root .env if present

# Pre-register LiveKit plugins on the main thread
from livekit.plugins import deepgram, cartesia, openai as lk_openai

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)

from runtime.engine.config_loader import load_config
from runtime.engine.context import SessionContext
from runtime.engine.agent_factory import DynamicVoiceAgent
from runtime.engine import session_manager
from runtime.telemetry.events import publish_session_event

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def entrypoint(ctx: JobContext) -> None:
    """
    Called by LiveKit for each new room/job dispatched to this worker.

    Steps
    -----
    1.  Connect to the room.
    2.  Parse and validate room metadata (server-signed by LiveKit).
    3.  Load agent config (LRU-cached by version_id).
    4.  Build SessionContext — the immutable security boundary.
    5.  Build the LiveKit Agent from the config.
    6.  Mark the call_session as active in Supabase.
    7.  Start the AgentSession and wait for it to finish.
    8.  Mark the call_session as ended in Supabase.
    9.  Publish telemetry events at start/end.
    """
    # ------------------------------------------------------------------ #
    # 1. Connect
    # ------------------------------------------------------------------ #
    await ctx.connect()
    logger.info("Connected to room: %s", ctx.room.name)

    # ------------------------------------------------------------------ #
    # 2. Parse room metadata
    #    CRITICAL: ctx.room.metadata is set server-side by LiveKit dispatch.
    #    It is NOT participant-supplied.
    # ------------------------------------------------------------------ #
    raw_metadata = ctx.room.metadata or "{}"
    try:
        metadata: dict = json.loads(raw_metadata)
    except json.JSONDecodeError as exc:
        logger.error("Invalid room metadata JSON in room %s: %s", ctx.room.name, exc)
        raise

    try:
        tenant_id: str = metadata["tenant_id"]
        agent_id: str = metadata["agent_id"]
        version_id: str = metadata["version_id"]
        session_id: str = metadata["session_id"]
    except KeyError as exc:
        logger.error(
            "Missing required metadata key %s in room %s", exc, ctx.room.name
        )
        raise ValueError(f"Room metadata missing required field: {exc}") from exc

    logger.info(
        "Job metadata parsed — tenant=%s agent=%s version=%s session=%s room=%s",
        tenant_id, agent_id, version_id, session_id, ctx.room.name,
    )

    # ------------------------------------------------------------------ #
    # 3. Load agent config (LRU-cached, immutable configs)
    #    Triple-check: version_id AND tenant_id AND agent_id must all match.
    # ------------------------------------------------------------------ #
    config = await load_config(version_id, tenant_id, agent_id)

    # ------------------------------------------------------------------ #
    # 4. Build the immutable session context
    # ------------------------------------------------------------------ #
    session_ctx = SessionContext(
        tenant_id=tenant_id,
        agent_id=agent_id,
        version_id=version_id,
        session_id=session_id,
        agent_config=config,
    )

    # ------------------------------------------------------------------ #
    # 5. Build the LiveKit Agent from config
    # ------------------------------------------------------------------ #
    agent: Agent = DynamicVoiceAgent(config, session_ctx).build_agent()

    # ------------------------------------------------------------------ #
    # 6. Mark session as active
    # ------------------------------------------------------------------ #
    await session_manager.create_session(
        session_id=session_id,
        tenant_id=tenant_id,
        agent_id=agent_id,
        version_id=version_id,
        room_name=ctx.room.name,
    )
    await publish_session_event(
        "session_started",
        {"session_id": session_id, "room_name": ctx.room.name, "agent_id": agent_id},
        tenant_id,
    )

    # ------------------------------------------------------------------ #
    # 7. Start the AgentSession and register lifecycle cleanup
    # ------------------------------------------------------------------ #
    async def on_shutdown(*args) -> None:
        try:
            await session_manager.end_session(session_id=session_id, tenant_id=tenant_id)
            await publish_session_event(
                "session_ended",
                {"session_id": session_id, "agent_id": agent_id},
                tenant_id,
            )
            logger.info("Session %s ended and telemetry published", session_id)
        except Exception:
            logger.exception("Error during session shutdown for %s", session_id)

    ctx.add_shutdown_callback(on_shutdown)

    session = AgentSession()
    await session.start(agent=agent, room=ctx.room)
    logger.info("AgentSession started for session %s in room %s", session_id, ctx.room.name)

    first_message = config.get("first_message") or config.get("greeting")
    if first_message:
        session.say(first_message)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="voicedesk-agent"))
