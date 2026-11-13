"""Application settings using pydantic-settings."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from environment variables / .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "apps/api/.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Supabase ──────────────────────────────────────────────────────────
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # ── LiveKit ───────────────────────────────────────────────────────────
    LIVEKIT_URL: str = "ws://localhost:7880"
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # ── Redis ─────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── AI Providers ──────────────────────────────────────────────────────
    OPENAI_API_KEY: str = ""
    CARTESIA_API_KEY: str = ""
    DEEPGRAM_API_KEY: str = ""

    # ── Encryption ────────────────────────────────────────────────────────
    ENCRYPTION_KEY: str = ""  # 32-byte URL-safe base64 Fernet key

    # ── CORS ──────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # ── Environment ───────────────────────────────────────────────────────
    ENV: Literal["dev", "staging", "prod"] = "dev"

    # ── App ───────────────────────────────────────────────────────────────
    APP_NAME: str = "VoiceDesk API"
    API_V1_PREFIX: str = "/api/v1"
    LOG_LEVEL: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()  # type: ignore[call-arg]
