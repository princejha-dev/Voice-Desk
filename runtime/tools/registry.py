"""
Tool registry for VoiceDesk agents.

Each entry creates a LiveKit FunctionTool with session_ctx securely baked in via closure.
The LiveKit Agents SDK requires tools to be instances of FunctionTool, never raw callables or functools.partial.
"""
from __future__ import annotations

import logging
from typing import Any, List

from livekit.agents import llm

from runtime.engine.context import SessionContext
from runtime.tools.rag import knowledge_search
from runtime.tools.booking import book_appointment
from runtime.tools.tickets import create_ticket
from runtime.tools.callback import request_callback
from runtime.tools.webhook import create_dynamic_webhook_tool

logger = logging.getLogger(__name__)


def _build_knowledge_tool(session_ctx: SessionContext):
    async def knowledge_search_tool(query: str) -> str:
        """Search the authorized knowledge base using semantic search to answer caller questions accurately."""
        return await knowledge_search(query=query, session_ctx=session_ctx)
    return llm.function_tool(knowledge_search_tool)


def _build_booking_tool(session_ctx: SessionContext):
    async def book_appointment_tool(
        customer_name: str,
        date: str,
        time: str,
        service: str = "General Consultation",
        customer_phone: str = "",
    ) -> str:
        """Book an appointment for the caller after checking working days, hours, and availability.

        Args:
            customer_name: Full name of the customer.
            date: Requested date in YYYY-MM-DD format (e.g. 2026-11-20).
            time: Requested time in HH:MM format (24-hour, e.g. 14:30).
            service: Appointment service type requested.
            customer_phone: Optional phone number of the customer.
        """
        return await book_appointment(
            customer_name=customer_name,
            date=date,
            time=time,
            service=service,
            customer_phone=customer_phone,
            session_ctx=session_ctx,
        )
    return llm.function_tool(book_appointment_tool)


def _build_ticket_tool(session_ctx: SessionContext):
    async def create_support_ticket_tool(
        subject: str,
        description: str,
        priority: str = "medium",
    ) -> str:
        """Create a support ticket for the caller's issue.

        Args:
            subject: Short summary of the problem.
            description: Detailed description of the issue.
            priority: Ticket priority (low, medium, high, urgent).
        """
        return await create_ticket(
            subject=subject,
            description=description,
            priority=priority,
            session_ctx=session_ctx,
        )
    return llm.function_tool(create_support_ticket_tool)


def _build_callback_tool(session_ctx: SessionContext):
    async def request_callback_tool(
        phone_number: str,
        reason: str = "",
    ) -> str:
        """Request a human representative to call the customer back.

        Args:
            phone_number: The phone number to call back.
            reason: Optional reason or topic for the callback.
        """
        return await request_callback(
            phone_number=phone_number,
            reason=reason,
            session_ctx=session_ctx,
        )
    return llm.function_tool(request_callback_tool)


TOOL_FACTORIES = {
    "knowledge_search": _build_knowledge_tool,
    "book_appointment": _build_booking_tool,
    "create_ticket": _build_ticket_tool,
    "request_callback": _build_callback_tool,
}


def get_tools_for_agent(config: dict, session_ctx: SessionContext) -> List[Any]:
    """
    Return a list of LiveKit FunctionTools with session_ctx baked in.

    Args:
        config:      Agent config dict (from agent_versions.config).
        session_ctx: Immutable session context — injected server-side.

    Returns:
        List of LiveKit FunctionTool instances ready for Agent(tools=...).
    """
    enabled: list[str] = config.get("enabled_tools") or config.get("tools") or []
    tools: list[Any] = []

    for tool_id in enabled:
        builder = TOOL_FACTORIES.get(tool_id)
        if builder is None:
            logger.warning("Unknown tool_id '%s' — skipping", tool_id)
            continue
        try:
            tool_instance = builder(session_ctx)
            tools.append(tool_instance)
            logger.debug("Registered tool '%s' for session %s", tool_id, session_ctx.session_id)
        except Exception as e:
            logger.exception("Failed to build tool '%s': %s", tool_id, e)

    # Register any custom HTTP webhook tools configured specifically for this agent
    custom_tools: list[dict] = config.get("custom_tools") or []
    for ct in custom_tools:
        if not isinstance(ct, dict):
            continue
        c_name = ct.get("name")
        if not c_name:
            continue
        try:
            wb_tool = create_dynamic_webhook_tool(ct, session_ctx)
            tools.append(wb_tool)
            logger.info("Registered custom webhook tool '%s' for session %s", c_name, session_ctx.session_id)
        except Exception as e:
            logger.warning("Failed to register custom webhook tool '%s': %s", c_name, e)

    return tools
