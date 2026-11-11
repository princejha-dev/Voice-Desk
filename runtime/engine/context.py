from dataclasses import dataclass, field
from typing import Any


@dataclass
class SessionContext:
    """Immutable context injected into every tool call. NEVER from LLM output."""

    tenant_id: str
    agent_id: str
    version_id: str
    session_id: str
    agent_config: dict = field(default_factory=dict)

    def tool_kwargs(self) -> dict:
        """Safe kwargs to pass to all tool functions."""
        return {
            "tenant_id": self.tenant_id,
            "agent_id": self.agent_id,
            "session_id": self.session_id,
        }
