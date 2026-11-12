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
