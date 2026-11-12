import logging
import os
import re

from livekit.agents import tts as agent_tts
from livekit.plugins import cartesia
from livekit.plugins.cartesia.tts import TTSDefaultVoiceId
from livekit.plugins import openai as lk_openai

logger = logging.getLogger(__name__)

# Supported TTS providers
_TTS_PROVIDERS = {"cartesia", "openai"}

CARTESIA_VOICE_MAP = {
    "default": TTSDefaultVoiceId,
    "professional female": "f786b574-daa5-4673-aa0c-cbe3e8534c02",
    "professional male": "a0e99841-438c-4a64-b679-ae501e7d6091",
    "friendly female": "694f9389-aac1-45b6-b726-9d9369183238",
    "friendly male": "69267136-1bdc-4103-a11a-7a06aa7649a6",
    "katie": "f786b574-daa5-4673-aa0c-cbe3e8534c02",
    "sarah": "694f9389-aac1-45b6-b726-9d9369183238",
    "barbershop man": "a0e99841-438c-4a64-b679-ae501e7d6091",
}

OPENAI_VOICE_MAP = {
    "professional female": "alloy",
    "professional male": "echo",
    "friendly female": "shimmer",
    "friendly male": "fable",
}

_UUID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)


def create_tts(config: dict) -> agent_tts.TTS:
    """
    Factory that returns a TTS plugin instance from a provider config block.

    Args:
        config: Dict with optional keys ``provider``, ``voice``, ``voice_name``, ``voice_id``, and ``model``.

    Returns:
        A LiveKit TTS plugin instance.
    """
    provider = (config.get("provider") or "cartesia").lower()

    if provider == "cartesia":
        api_key = os.environ.get("CARTESIA_API_KEY")
        if not api_key:
            raise EnvironmentError("CARTESIA_API_KEY is not set")

        raw_voice = (
            config.get("voice")
            or config.get("voice_id")
            or config.get("voice_name")
            or "default"
        )
        voice_str = str(raw_voice).strip().lower()

        # Resolve voice ID: if it's already a UUID, keep it; else map name; else default
        if _UUID_REGEX.match(voice_str):
            voice = voice_str
        elif voice_str in CARTESIA_VOICE_MAP:
            voice = CARTESIA_VOICE_MAP[voice_str]
        else:
            voice = TTSDefaultVoiceId

        raw_model = config.get("model") or "sonic-3"
        valid_models = {"sonic", "sonic-2", "sonic-lite", "sonic-preview", "sonic-turbo", "sonic-3"}
        model = raw_model if raw_model in valid_models else "sonic-3"

        logger.info("Creating Cartesia TTS with voice=%s model=%s", voice, model)

        return cartesia.TTS(
            api_key=api_key,
            voice=voice,
            model=model,
        )

    if provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY is not set")

        raw_voice = (
            config.get("voice")
            or config.get("voice_name")
            or config.get("voice_id")
            or "alloy"
        )
        voice_str = str(raw_voice).strip().lower()
        voice = OPENAI_VOICE_MAP.get(voice_str, voice_str)

        model = config.get("model") or "tts-1"
        logger.info("Creating OpenAI TTS voice=%s model=%s", voice, model)

        return lk_openai.TTS(
            api_key=api_key,
            voice=voice,
            model=model,
        )

    raise ValueError(
        f"Unsupported TTS provider: '{provider}'. Supported: {_TTS_PROVIDERS}"
    )
