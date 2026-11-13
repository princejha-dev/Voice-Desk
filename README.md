# VoiceDesk — Multi-Tenant Voice AI SaaS Platform

VoiceDesk is a production-grade, multi-tenant Voice AI platform that enables businesses to deploy intelligent voice agents for customer support, appointment booking, sales, and general-purpose business assistance. Built on top of LiveKit, Supabase, and modern LLM providers, VoiceDesk provides a complete control plane, runtime engine, and data layer for managing voice AI at scale.

---

## Architecture Overview

VoiceDesk follows a **three-layer architecture**:

```
┌─────────────────────────────────────────────────────┐
│                   CONTROL PLANE                     │
│  Next.js Dashboard  ·  FastAPI Management API       │
│  Agent Builder  ·  Analytics  ·  Eval Framework     │
├─────────────────────────────────────────────────────┤
│                   RUNTIME PLANE                     │
│  LiveKit Agent Workers  ·  LLM Orchestration        │
│  STT/TTS Pipeline  ·  Tool Execution  ·  RAG        │
├─────────────────────────────────────────────────────┤
│                    DATA PLANE                       │
│  Supabase (PostgreSQL + Auth + RLS)  ·  Redis       │
│  pgvector Embeddings  ·  Usage Metering             │
└─────────────────────────────────────────────────────┘
```

### Control Plane
- **Web Dashboard** (`apps/web/`): Next.js 14+ app for agent configuration, analytics, knowledge management, and team settings.
- **Management API** (`apps/api/`): FastAPI service handling CRUD operations, file uploads, evaluation runs, and billing.

### Runtime Plane
- **Agent Workers** (`runtime/`): LiveKit agent processes that handle real-time voice sessions, LLM inference, tool execution, and RAG retrieval.
- **Background Workers**: Async tasks for document ingestion, embedding generation, evaluation execution, and usage aggregation.

### Data Plane
- **Supabase**: PostgreSQL with Row-Level Security (RLS) for strict multi-tenant data isolation, plus Supabase Auth for authentication.
- **Redis**: Session state, rate limiting, caching, and pub/sub for real-time events.
- **pgvector**: Vector similarity search for knowledge base RAG.

---

## Directory Structure

```
voicedesk/
├── apps/
│   ├── api/                    # FastAPI management API
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── routers/
│   │   │   ├── services/
│   │   │   └── middleware/
│   │   └── requirements.txt
│   └── web/                    # Next.js dashboard
│       ├── src/
│       ├── package.json
│       └── next.config.js
├── runtime/                    # LiveKit agent runtime
│   ├── entrypoint.py
│   ├── agent/
│   ├── tools/
│   └── requirements.txt
├── packages/
│   ├── shared-schemas/         # Pydantic models shared across services
│   ├── agent-config/           # Agent template definitions
│   └── eval-framework/         # Evaluation runner and scorers
├── supabase/
│   ├── migrations/             # Numbered SQL migrations
│   └── seed.sql                # Demo seed data
├── infrastructure/
│   ├── docker/                 # Dockerfiles
│   ├── docker-compose.yml      # Production compose
│   └── docker-compose.dev.yml  # Development overrides
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── tenant-isolation/       # RLS isolation tests
│   └── evaluations/
├── archive/                    # Archived original files
├── .env.example
├── .gitignore
└── README.md
```

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose
- Supabase CLI (`npx supabase`)
- pnpm (`corepack enable`)

### 1. Clone and Configure

```bash
git clone <repo-url> voicedesk
cd voicedesk
cp .env.example .env
# Fill in your credentials in .env
```

### 2. Start Infrastructure

```bash
# Start local Supabase + Redis
docker compose -f infrastructure/docker-compose.dev.yml up -d

# Run migrations
npx supabase db push

# Seed demo data
npx supabase db reset --seed
```

### 3. Start Services

```bash
# API server
cd apps/api && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Web dashboard
cd apps/web && pnpm install && pnpm dev

# Agent runtime
cd runtime && pip install -r requirements.txt
python entrypoint.py start
```

### 4. Run Tests

```bash
# Unit tests
pytest tests/unit/

# Tenant isolation tests
pytest tests/tenant-isolation/

# Evaluations
pytest tests/evaluations/
```

---

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) | Yes |
| `LIVEKIT_URL` | LiveKit Cloud or self-hosted URL | Yes |
| `LIVEKIT_API_KEY` | LiveKit API key | Yes |
| `LIVEKIT_API_SECRET` | LiveKit API secret | Yes |
| `OPENAI_API_KEY` | OpenAI API key for GPT models | Optional |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude models | Optional |
| `GEMINI_API_KEY` | Google Gemini API key | Optional |
| `DEEPGRAM_API_KEY` | Deepgram STT/TTS API key | Optional |
| `CARTESIA_API_KEY` | Cartesia TTS API key | Optional |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS API key | Optional |
| `REDIS_URL` | Redis connection URL | Yes |
| `ENCRYPTION_KEY` | 32-byte key for encrypting provider credentials | Yes |

---

## Multi-Tenancy Model

VoiceDesk enforces strict tenant isolation at every layer:

- **Database**: PostgreSQL Row-Level Security (RLS) policies ensure every query is scoped to the authenticated user's organization.
- **Runtime**: Each voice session carries a `TenantContext` that restricts LLM context, knowledge retrieval, and tool execution to the owning tenant.
- **API**: All endpoints extract and validate tenant identity from the authenticated session before any data access.
- **Evaluation**: Isolation tests verify that cross-tenant data leakage is impossible.

---

## Agent Templates

VoiceDesk ships with pre-built agent templates:

| Template | Use Case | Default Tools |
|---|---|---|
| Customer Support | Handle inbound support calls | `lookup_order`, `create_ticket`, `transfer_call` |
| Appointment Booking | Schedule appointments | `check_availability`, `create_booking`, `send_confirmation` |
| Sales Assistant | Qualify leads, answer product questions | `lookup_product`, `check_pricing`, `schedule_demo` |
| Business Assistant | General-purpose voice assistant | `search_knowledge`, `take_note`, `request_callback` |

---

## License

Proprietary — All rights reserved.
