# Inquira Backend

FastAPI + LangChain service that powers **Inquira**, a multi-agent AI research platform. It runs six cooperating agents, orchestrates parallel tool calls, and returns structured research reports.

> This README covers the backend package only. For the project overview, see the [root README](../README.md).

| Resource | Link |
|---|---|
| Repository | https://github.com/Sheharyar-Sarmad/Inquira |
| Backend path | `/agent` |
| Live API | https://inquira-a3dk.onrender.com |
| Swagger UI | https://inquira-a3dk.onrender.com/api/v1/docs |
| ReDoc | https://inquira-a3dk.onrender.com/api/v1/redoc |
| Health check | https://inquira-a3dk.onrender.com/health |
| Frontend | https://inquira-nine.vercel.app/ |

---

## Table of Contents

- [Architecture](#architecture)
- [The Six Agents](#the-six-agents)
- [The Four Tools](#the-four-tools)
- [API Endpoints](#api-endpoints)
- [Async Job Model](#async-job-model)
- [Resilience Layer](#resilience-layer)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Known Limitations](#known-limitations)

---

## Architecture

```text
Client
  │  POST /api/v1/research/async  { conversation_id, query }
  ▼
FastAPI ──► 202 Accepted { job_id }
  │
  └─► BackgroundTask ──► workflow.py (orchestrator)
                            │
                            ├─► Redis cache lookup (identical query → fast return)
                            │
                            ├─► Research phase
                            │     research_agent (planner, all four tools)
                            │       ├─► web_research_agent  (Tavily + Firecrawl)
                            │       ├─► wikipedia_agent     (Wikipedia)
                            │       └─► arxiv_agent         (arXiv)
                            │
                            ├─► critic_agent (no tools)
                            │     ├─► loop back to a named specialist (max 3 rounds)
                            │     └─► hand off to writer
                            │
                            └─► writer_agent (no tools) ──► structured report
                                                              │
Client ◄── GET /api/v1/research/jobs/{job_id} ◄───────────────┘
```

Every tool call passes through a **Redis-backed sliding-window rate limiter** before it fires. The LLM is **Groq LPU** running `openai/gpt-oss-120b`.

---

## The Six Agents

| # | Agent | Role | Tools |
|---|---|---|---|
| 1 | `research_agent` | Main planner. Decides what to research and fans out. | All four |
| 2 | `web_research_agent` | Tavily + Firecrawl specialist. Finds current web sources and scrapes them. | `search_web`, `get_firecrawl_tool` |
| 3 | `wikipedia_agent` | Wikipedia specialist. Gets background and foundational facts. | `search_wikipedia` |
| 4 | `arxiv_agent` | arXiv specialist. Finds academic papers on the topic. | `search_arxiv` |
| 5 | `critic_agent` | Verifier. Reviews aggregated evidence and decides whether to loop back (naming a target specialist) or hand off to the writer. | None |
| 6 | `writer_agent` | Synthesises the final structured report. | None |

**Writer output sections:** Introduction, Key findings, Detailed analysis, Sources, Conclusion.

The orchestrator (`workflow.py`) runs the graph, invokes the critic after the research phase, and loops up to **three rounds** before forcing the writer.

---

## The Four Tools

| Tool | Backend | Purpose |
|---|---|---|
| `search_web` | Tavily | Current web search |
| `search_wikipedia` | Wikipedia API | Article summaries |
| `search_arxiv` | arXiv API | Academic papers |
| `get_firecrawl_tool` | Firecrawl | Reads a single webpage and returns markdown |

All tool calls are gated by the Redis sliding-window rate limiter.

---

## API Endpoints

Base prefix for versioned routes: `/api/v1`

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Welcome message |
| `GET` | `/health` | Liveness probe |
| `POST` | `/api/v1/research/async` | Submit a research query. Accepts `{conversation_id, query}`, returns `202 Accepted` with a `job_id`. |
| `GET` | `/api/v1/research/jobs/{job_id}` | Returns job status, `answer`, `tools_used`, and a `cached` flag. |
| `POST` | `/api/v1/research/jobs/{job_id}/approve` | Reserved for human-in-the-loop. Currently not required because all tools are read-only. |

### Request

```json
{
  "conversation_id": "conv-123",
  "query": "What are the latest advances in retrieval-augmented generation?"
}
```

### Submit response (`202 Accepted`)

```json
{
  "job_id": "b1f4c2e0-..."
}
```

### Job status response

```json
{
  "job_id": "b1f4c2e0-...",
  "status": "completed",
  "answer": "## Introduction\n...",
  "tools_used": ["search_web", "search_arxiv", "search_wikipedia"],
  "cached": false
}
```

---

## Async Job Model

- `POST /api/v1/research/async` returns `202` immediately with a `job_id`.
- The actual work runs in a FastAPI `BackgroundTask`.
- Clients poll `GET /api/v1/research/jobs/{job_id}` until the job completes.
- The job store is **in-process memory** (see [Known Limitations](#known-limitations)).
- **Redis** caches results, so identical queries return quickly with `cached: true`.

---

## Resilience Layer

Groq occasionally leaks control tokens into tool names (for example `search_arxiv<|channel|>commentary` instead of `search_arxiv`). The workflow hardens against this and other transient failures:

- **Tool-name sanitisation:** names are cleaned before the `AIMessage` is replayed to the model.
- **Retry with backoff:** transient `400` errors are retried up to **3 attempts**.
- **Graceful fallback:** if retries are exhausted, the workflow produces a forced summary instead of failing the job.
- **Per-tool exception isolation:** exceptions inside individual tools are swallowed, so one failing tool does not kill the whole query.
- **Rate limiting:** a Redis sliding-window limiter guards every tool call.

---

## Project Structure

> Adjust to match your tree if any filenames differ.

```text
agent/
├── main.py              # FastAPI app entry point, router registration, /, /health
├── workflow.py          # Orchestrator: runs the agent graph, critic loop, resilience logic
├── agents/              # The six agent definitions
├── tools/               # search_web, search_wikipedia, search_arxiv, get_firecrawl_tool
├── routes/              # /api/v1 research endpoints
├── requirements.txt     # Python dependencies
└── .env                 # Local environment variables (not committed)
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- A running Redis instance
- API keys for Groq, Tavily, and Firecrawl

### Installation

```bash
git clone https://github.com/Sheharyar-Sarmad/Inquira.git
cd Inquira/agent

python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

### Run locally

```bash
uvicorn main:app --reload --port 8000
```

Then open:

- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc
- Health: http://localhost:8000/health

---

## Configuration

Create a `.env` file in `/agent`:

```env
GROQ_API_KEY=your_groq_key
TAVILY_API_KEY=your_tavily_key
FIRECRAWL_API_KEY=your_firecrawl_key
REDIS_URL=redis://localhost:6379
```

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq LPU inference (`openai/gpt-oss-120b`) |
| `TAVILY_API_KEY` | Web search via `search_web` |
| `FIRECRAWL_API_KEY` | Page scraping via `get_firecrawl_tool` |
| `REDIS_URL` | Result cache and rate limiter |

---

## Usage Examples

### Submit a job

```bash
curl -X POST https://inquira-a3dk.onrender.com/api/v1/research/async \
  -H "Content-Type: application/json" \
  -d '{"conversation_id": "demo-1", "query": "Explain mixture-of-experts models"}'
```

### Poll for the result

```bash
curl https://inquira-a3dk.onrender.com/api/v1/research/jobs/<job_id>
```

### Health check

```bash
curl https://inquira-a3dk.onrender.com/health
```

---

## Known Limitations

- **In-process job store:** jobs live in memory, so they are lost on restart and not shared across multiple workers or instances. Running more than one worker will cause `job_id` lookups to miss.
- **Free-tier cold starts:** the hosted instance on Render may take time to wake after inactivity.
- **Approval endpoint is a placeholder:** `/approve` is reserved for future human-in-the-loop flows; it is not required today since all tools are read-only.
- **Critic loop cap:** the critic can send work back at most three times before the writer is forced to run.

---

## License

See the root repository for license information.