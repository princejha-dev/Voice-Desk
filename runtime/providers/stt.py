import logging
import os

from livekit.plugins import deepgram
from livekit.agents import stt as agent_stt

logger = logging.getLogger(__name__)

# Supported STT providers
_STT_PROVIDERS = {"deepgram"}


def create_stt(config: dict) -> agent_stt.STT:
    """
    Factory that returns an STT plugin instance from a provider config block.

    Args:
        config: Dict with optional keys ``provider`` and ``model``.
                Defaults: provider=deepgram, model=nova-2.

    Returns:
        A LiveKit STT plugin instance.

    Raises:
        ValueError: If the requested provider is not supported.
    """
    provider = (config.get("provider") or "deepgram").lower()
    model = config.get("model") or "nova-2"

    if provider == "deepgram":
        api_key = os.environ.get("DEEPGRAM_API_KEY")
        if not api_key:
            raise EnvironmentError("DEEPGRAM_API_KEY is not set")

        logger.debug("Creating Deepgram STT with model=%s", model)
        return deepgram.STT(
            model=model,
            api_key=api_key,
        )

    raise ValueError(
        f"Unsupported STT provider: '{provider}'. Supported: {_STT_PROVIDERS}"
    )
