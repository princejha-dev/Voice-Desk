import logging
from functools import partial
from typing import Optional

from livekit.agents import Agent
from livekit.agents.llm import ChatContext, ChatMessage

from runtime.engine.context import SessionContext
from runtime.providers.stt import create_stt
from runtime.providers.llm import create_llm
from runtime.providers.tts import create_tts
from runtime.tools.registry import get_tools_for_agent

logger = logging.getLogger(__name__)


class DynamicVoiceAgent:
    """
    Builds a LiveKit Agent dynamically from a stored agent config.

    Config shape (JSONB from agent_versions.config):
    {
        "system_prompt": "You are ...",
        "stt": {"provider": "deepgram", "model": "nova-2"},
        "llm": {"provider": "openai", "model": "gpt-4o-mini"},
        "tts": {"provider": "cartesia", "voice": "sonic-english"},
        "enabled_tools": ["knowledge_search", "book_appointment"],
        "first_message": "Hello! How can I help you today?"
    }
    """

    def __init__(self, config: dict, session_ctx: SessionContext) -> None:
        self.config = config
        self.session_ctx = session_ctx

    def build_agent(self) -> Agent:
        """Assemble and return a configured LiveKit Agent."""
        stt = create_stt(self.config.get("stt", {}))
        llm = create_llm(self.config.get("llm", {}))
        tts = create_tts(self.config.get("tts", {}))

        tools = get_tools_for_agent(self.config, self.session_ctx)

        system_prompt: str = (
            self.config.get("system_prompt")
            or self.config.get("instructions")
            or "You are a helpful voice assistant."
        )

        # Construct tool guidelines from tools_config to enforce strict boundaries
        tool_rules = []
        tools_cfg = self.config.get("tools_config", {})
        enabled_tools_list = self.config.get("tools", []) or self.config.get("enabled_tools", [])

        # Booking rules
        b_cfg = tools_cfg.get("book_appointment", {})
        if "book_appointment" in enabled_tools_list or b_cfg.get("enabled"):
            w_days = ", ".join(b_cfg.get("working_days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]))
            s_time = b_cfg.get("start_time", "09:00")
            e_time = b_cfg.get("end_time", "17:00")
            tz = b_cfg.get("timezone", "UTC")
            services = ", ".join(b_cfg.get("services", ["Consultation", "Product Demo"]))
            tool_rules.append(
                f"- APPOINTMENT BOOKING: You can only book appointments on {w_days} between {s_time} and {e_time} ({tz}). "
                f"Available services: {services}. Always ask for customer's name, preferred date, and time. "
                f"Never agree to times or days outside this window; politely explain availability."
            )

        # Knowledge search rules
        if "knowledge_search" in enabled_tools_list:
            tool_rules.append(
                "- KNOWLEDGE BASE: Use the knowledge_search tool when asked about company policies, products, or specifics. "
                "Never invent facts not found in the search results."
            )

        # Support ticket rules
        t_cfg = tools_cfg.get("create_ticket", {})
        if "create_ticket" in enabled_tools_list or t_cfg.get("enabled"):
            depts = ", ".join(t_cfg.get("departments", ["Technical Support", "Billing", "General"]))
            tool_rules.append(
                f"- SUPPORT TICKETS: You can file support tickets for departments: {depts}. "
                "Always collect the issue details and give the caller their ticket reference."
            )

        # Callback rules
        c_cfg = tools_cfg.get("request_callback", {})
        if "request_callback" in enabled_tools_list or c_cfg.get("enabled"):
            tool_rules.append(
                "- CALLBACKS: When a caller requests a callback or human escalation, ask for their phone number and confirm the request."
            )

        # Custom webhook tools rules
        custom_tools = self.config.get("custom_tools", [])
        for ct in custom_tools:
            if isinstance(ct, dict) and ct.get("name"):
                c_name = ct.get("name")
                c_desc = ct.get("description", "")
                tool_rules.append(f"- CUSTOM ACTION '{c_name}': {c_desc}")

        if tool_rules:
            system_prompt += "\n\n### Operational Rules & Tool Boundaries\n" + "\n".join(tool_rules)

        first_message: Optional[str] = (
            self.config.get("first_message")
            or self.config.get("greeting")
        )

        # Build the initial chat context with the system prompt
        initial_ctx = ChatContext()
        initial_ctx.add_message(
            role="system",
            content=system_prompt,
        )

        agent = Agent(
            instructions=system_prompt,
            stt=stt,
            llm=llm,
            tts=tts,
            tools=tools,
            chat_ctx=initial_ctx,
        )

        logger.info(
            "Built agent for tenant=%s agent=%s version=%s tools=%s",
            self.session_ctx.tenant_id,
            self.session_ctx.agent_id,
            self.session_ctx.version_id,
            [t.__name__ if hasattr(t, "__name__") else str(t) for t in tools],
        )

        return agent
