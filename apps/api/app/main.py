"""FastAPI main application entry point for VoiceDesk control plane."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.modules.auth.router import router as auth_router
from app.modules.organizations.router import router as orgs_router
from app.modules.agents.router import router as agents_router
from app.modules.deployments.router import router as deployments_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.tools.router import router as tools_router
from app.modules.sessions.router import router as sessions_router
from app.modules.monitoring.router import router as monitoring_router
from app.modules.evaluations.router import router as evaluations_router
from app.modules.billing.router import router as billing_router
from app.modules.public.router import router as public_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # Startup
    yield
    # Shutdown


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        docs_url="/docs" if settings.ENV != "prod" else None,
        redoc_url="/redoc" if settings.ENV != "prod" else None,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    prefix = settings.API_V1_PREFIX

    # ── Routers ───────────────────────────────────────────────────
    app.include_router(auth_router, prefix=f"{prefix}/auth", tags=["auth"])
    app.include_router(orgs_router, prefix=f"{prefix}/organizations", tags=["organizations"])
    app.include_router(agents_router, prefix=f"{prefix}/organizations", tags=["agents"])
    app.include_router(deployments_router, prefix=f"{prefix}/organizations", tags=["deployments"])
    app.include_router(knowledge_router, prefix=f"{prefix}/organizations", tags=["knowledge"])
    app.include_router(tools_router, prefix=f"{prefix}/organizations", tags=["tools"])
    app.include_router(sessions_router, prefix=f"{prefix}/organizations", tags=["sessions"])
    app.include_router(monitoring_router, prefix=f"{prefix}/organizations", tags=["monitoring"])
    app.include_router(evaluations_router, prefix=f"{prefix}/organizations", tags=["evaluations"])
    app.include_router(billing_router, prefix=f"{prefix}/organizations", tags=["billing"])
    app.include_router(public_router, prefix=f"{prefix}/public", tags=["public"])

    @app.get("/health", tags=["health"])
    async def health():
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()

