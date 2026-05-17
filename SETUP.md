# TruePath — Developer Setup Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.x LTS | Required for frontend and backend |
| npm | bundled with Node | |
| Python | 3.10+ | Required for services layer |
| Git | any | |

You also need credentials for two external services before the app will run:

- **Supabase** — PostgreSQL + pgvector (cloud-hosted, no local DB needed)
- **OpenAI** — LLM inference and embeddings

---

## 1. Clone the Repo

```bash
git clone <repo-url>
cd truepath
```

---

## 2. Install Dependencies

Run these from the repo root:

```bash
# Frontend
cd frontend && npm install && cd ..

# Backend
cd backend && npm install && cd ..

# Python services
cd services
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
cd ..
```

---

## 3. Configure Environment Variables

Copy the example files and fill in credentials:

```bash
copy frontend\.env.local.example frontend\.env.local
copy backend\.env.example backend\.env
copy services\.env.example services\.env
```

### frontend/.env.local

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_ANALYTICS_ENABLED=false
```

### backend/.env

```env
# Server
PORT=4000
CORS_ORIGIN=http://localhost:3000

# Supabase
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>

# OpenAI
OPENAI_API_KEY=<your-api-key>
OPENAI_MODEL=gpt-4o
OPENAI_FOLLOWUP_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_SKILLS_MODEL=gpt-4.1-mini

# Python services
PYTHON_SERVICES_URL=http://localhost:8000
```

### services/.env

```env
OPENAI_API_KEY=<your-api-key>
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
```

---

## 4. Run Database Migrations

Apply SQL migrations from `backend/src/db/migrations/` to your Supabase project.

You can run them in order via the Supabase SQL Editor or psql:

```bash
psql "<supabase-connection-string>" -f backend/src/db/migrations/<file>.sql
```

The Supabase connection string is available in the project dashboard under **Settings → Database → Connection string**.

---

## 5. Start the Full Stack

Open three terminals from the repo root.

**Terminal 1 — Python services (port 8000)**

```bash
cd services
venv\Scripts\activate   # Windows
python main.py
```

**Terminal 2 — Backend API (port 4000)**

```bash
cd backend
npm run dev
```

**Terminal 3 — Frontend (port 3000)**

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 6. Optional: Ingest RAG Data

If you need to populate the vector database with pathway data from `rag-data/`:

```bash
cd services
venv\Scripts\activate
python -c "from rag.indexer import build_index; build_index()"
```

---

## Useful Commands

| Location | Command | Purpose |
|----------|---------|---------|
| `frontend/` | `npm run type-check` | TypeScript check |
| `frontend/` | `npm run lint` | ESLint |
| `frontend/` | `npm run build` | Production build |
| `backend/` | `npm run type-check` | TypeScript check |
| `backend/` | `npm run test` | Vitest tests |
| `backend/` | `npm run test:watch` | Watch mode |

---

## Architecture at a Glance

```
Browser
  └── Next.js frontend  (port 3000)
        └── Express backend  (port 4000)
              ├── Supabase (PostgreSQL + pgvector)  [cloud]
              ├── OpenAI API                         [cloud]
              └── FastAPI services  (port 8000)
                    └── OpenAI API                   [cloud]
```

Key design decisions:
- No user accounts — sessions are stateless.
- No raw user text input — all UI is pill/button selection.
- LLM calls happen server-side only; the browser never talks to OpenAI directly.

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Engineering constitution — hard rules for all code |
| `WORKFLOW.md` | Development workflow |
| `docs/ARCHITECTURE.md` | Full system design and request flows |
| `docs/PROJECT_CHARTER.md` | Product vision and MVP scope |
| `backend/src/config.ts` | All environment variable handling |
