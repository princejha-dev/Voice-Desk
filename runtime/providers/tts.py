import logging
import os

from livekit.agents import tts as agent_tts

logger = logging.getLogger(__name__)

# Supported TTS providers
_TTS_PROVIDERS = {"cartesia", "openai"}


def create_tts(config: dict) -> agent_tts.TTS:
    """
    Factory that returns a TTS plugin instance from a provider config block.

    Args:
        config: Dict with optional keys ``provider``, ``voice``, and ``model``.
                Defaults: provider=cartesia, voice=sonic-english.

    Returns:
        A LiveKit TTS plugin instance.

    Raises:
        ValueError: If the requested provider is not supported.
    """
    provider = (config.get("provider") or "cartesia").lower()

    if provider == "cartesia":
        from livekit.plugins import cartesia

        api_key = os.environ.get("CARTESIA_API_KEY")
        if not api_key:
            raise EnvironmentError("CARTESIA_API_KEY is not set")

        voice = config.get("voice") or "sonic-english"
        model = config.get("model") or "sonic-english"
        logger.debug("Creating Cartesia TTS voice=%s model=%s", voice, model)

        return cartesia.TTS(
            api_key=api_key,
            voice=voice,
            model=model,
        )

    if provider == "openai":
        from livekit.plugins import openai as lk_openai

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY is not set")

        voice = config.get("voice") or "alloy"
        model = config.get("model") or "tts-1"
        logger.debug("Creating OpenAI TTS voice=%s model=%s", voice, model)

        return lk_openai.TTS(
            api_key=api_key,
            voice=voice,
            model=model,
        )

    raise ValueError(
        f"Unsupported TTS provider: '{provider}'. Supported: {_TTS_PROVIDERS}"
    )
