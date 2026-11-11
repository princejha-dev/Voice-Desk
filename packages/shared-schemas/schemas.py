from pydantic import BaseModel
from typing import Optional, List, Any
from enum import Enum


class AgentStatus(str, Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class STTConfig(BaseModel):
    provider: str = "deepgram"
    model: str = "nova-2"
    language: str = "en-US"


class LLMConfig(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 500


class TTSConfig(BaseModel):
    provider: str = "cartesia"
    voice_id: str = "sonic-english"
    speed: float = 1.0


class AgentConfig(BaseModel):
    name: str
    system_prompt: str
    greeting: str = "Hello! How can I help you today?"
    stt: STTConfig = STTConfig()
    llm: LLMConfig = LLMConfig()
    tts: TTSConfig = TTSConfig()
    enabled_tools: List[str] = []
    max_session_duration: int = 1800  # seconds
    interruption_threshold: float = 0.5
    end_message: str = "Thank you for calling. Goodbye!"


class SessionMetadata(BaseModel):
    """Injected into LiveKit room metadata by the control plane."""
    tenant_id: str
    agent_id: str
    version_id: str
    session_id: str


class TenantContext(BaseModel):
    tenant_id: str
    user_id: str
    role: str
