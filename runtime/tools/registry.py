"""
Tool registry for VoiceDesk agents.

Each entry maps a tool_id string to a callable.  The registry is the single
source of truth for which tools exist; agent configs reference tool_ids by
name.  At runtime, get_tools_for_agent() wraps each selected callable with
functools.partial so that session_ctx is always injected from server-side
context, never from LLM output.
"""
from __future__ import annotations

import logging
from functools import partial
from typing import Callable, List

from runtime.engine.context import SessionContext
from runtime.tools.rag import knowledge_search
from runtime.tools.booking import book_appointment
from runtime.tools.tickets import create_ticket
from runtime.tools.callback import request_callback

logger = logging.getLogger(__name__)

AVAILABLE_TOOLS: dict[str, Callable] = {
    "knowledge_search": knowledge_search,
    "book_appointment": book_appointment,
    "create_ticket": create_ticket,
    "request_callback": request_callback,
}


def get_tools_for_agent(config: dict, session_ctx: SessionContext) -> List[Callable]:
    """
    Return a list of tool callables with ``session_ctx`` baked in.

    Only tools whose IDs appear in ``config["enabled_tools"]`` and that exist
    in AVAILABLE_TOOLS are returned.  Unknown tool IDs are logged and skipped.

    Args:
        config:      Agent config dict (from agent_versions.config).
        session_ctx: Immutable session context — injected into every tool call
                     so that tenant isolation is enforced server-side.

    Returns:
        List of partial callables ready to pass to the LiveKit Agent.
    """
    enabled: list[str] = config.get("enabled_tools", [])
    tools: list[Callable] = []

    for tool_id in enabled:
        fn = AVAILABLE_TOOLS.get(tool_id)
        if fn is None:
            logger.warning("Unknown tool_id '%s' — skipping", tool_id)
            continue
        # Bake session_ctx into the callable so the LLM never supplies it.
        bound = partial(fn, session_ctx=session_ctx)
        # Preserve the original function's name and docstring for the LLM schema.
        bound.__name__ = fn.__name__  # type: ignore[attr-defined]
        bound.__doc__ = fn.__doc__
        tools.append(bound)
        logger.debug("Registered tool '%s' for session %s", tool_id, session_ctx.session_id)

    return tools
