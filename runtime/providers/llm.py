import logging
import os

from livekit.plugins import openai as lk_openai
from livekit.agents import llm as agent_llm

logger = logging.getLogger(__name__)

# Supported LLM providers
_LLM_PROVIDERS = {"openai", "anthropic"}


def create_llm(config: dict) -> agent_llm.LLM:
    """
    Factory that returns an LLM plugin instance from a provider config block.

    Args:
        config: Dict with optional keys ``provider`` and ``model``.
                Defaults: provider=openai, model=gpt-4o-mini.

    Returns:
        A LiveKit LLM plugin instance.

    Raises:
        ValueError: If the requested provider is not supported.
    """
    provider = (config.get("provider") or "openai").lower()
    model = config.get("model") or "gpt-4o-mini"

    # Normalize any accidental typos or legacy model names
    if "4.1-mini" in model or model == "gpt-4-mini":
        model = "gpt-4o-mini"
    elif "4.1" in model:
        model = "gpt-4o"

    if provider == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY is not set")

        logger.debug("Creating OpenAI LLM with model=%s", model)
        return lk_openai.LLM(
            model=model,
            api_key=api_key,
        )

    if provider == "anthropic":
        try:
            from livekit.plugins import anthropic as lk_anthropic  # type: ignore
        except ImportError as exc:
            raise ImportError(
                "livekit-plugins-anthropic is not installed. "
                "Add it to requirements.txt."
            ) from exc

        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise EnvironmentError("ANTHROPIC_API_KEY is not set")

        logger.debug("Creating Anthropic LLM with model=%s", model)
        return lk_anthropic.LLM(model=model, api_key=api_key)

    raise ValueError(
        f"Unsupported LLM provider: '{provider}'. Supported: {_LLM_PROVIDERS}"
    )
