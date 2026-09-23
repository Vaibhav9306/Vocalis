# System Architecture

## Overview
The AI Meeting Assistant is structured as a modular TypeScript monorepo designed to capture real-time meeting audio, transcribe it with Azure Speech / Whisper, analyze discourse with Azure OpenAI, detect questions and action items, and deliver actionable meeting intelligence.

```
+-------------------------------------------------------------------+
|                        Client Applications                        |
|                                                                   |
|   +-----------------------+           +-----------------------+   |
|   |  Web Dashboard Shell  |           | Google Meet Extension |   |
|   |    (React + Vite)     |           |     (Future Phase)    |   |
|   +-----------+-----------+           +-----------+-----------+   |
+---------------|-----------------------------------|---------------+
                | REST / SSE / WS                   | Audio Stream
                v                                   v
+-------------------------------------------------------------------+
|                     Backend Server (Node.js + TS)                 |
|                                                                   |
|  +-------------------------------------------------------------+  |
|  | Express REST API (CORS, Request Logger, Error Handler)       |  |
|  +-------------------------------------------------------------+  |
|  | Routes: /health, /api/v1/...                                 |  |
|  +-------------------------------------------------------------+  |
|  | Modular Service Abstraction Layer                           |  |
|  |   - IAzureOpenAIService (Summaries, Actions, Questions)      |  |
|  |   - IAzureSpeechService (Whisper / Speech Transcription)    |  |
|  +-------------------------------------------------------------+  |
+--------------------------------|----------------------------------+
                                 | Azure SDK Calls (Phase 2)
                                 v
+-------------------------------------------------------------------+
|                     Azure Cloud Services                          |
|                                                                   |
|   +-----------------------+           +-----------------------+   |
|   |  Azure OpenAI Service |           | Azure Speech Services |   |
|   | (ai-meeting-assistant)|           | (Speech-to-Text /     |   |
|   | Region: East US       |           |  Whisper)             |   |
|   +-----------------------+           +-----------------------+   |
+-------------------------------------------------------------------+
```

## Directory Structure
- `apps/backend`: Express.js REST API with structured logging, Zod validation, and Azure integration interfaces.
- `apps/frontend`: React + Vite dashboard shell communicating with backend `/health`.
- `packages/shared-types`: Common TypeScript definitions shared across the monorepo.
- `infrastructure`: Cloud definitions and IaC notes.
- `scripts`: Developer experience automation.
- `docs`: Architectural and technical guides.

## Approved Azure Models & Roadmap
See [PROJECT_PLAN.md](file:///D:/agam/meeting-assistant/docs/PROJECT_PLAN.md) for the complete roadmap.

1. **Speech Transcription (Phase 2 - Next)**:
   - Model: `whisper` (Version `001`)
   - Role: Meeting audio transcription and near-real-time streaming transcription.
2. **Main Meeting AI (Phase 3 - Gated)**:
   - Model: `gpt-4.1-mini` (Version `2025-04-14`)
   - Role: Question detection, meeting context understanding, suggested answers, key-point extraction, summaries, and action items.
   - *Gating Rule*: Deployed strictly **after** Phase 2 transcription is verified working. `gpt-5-mini` is disallowed.
3. **Semantic Search (Phase 4 - Future)**:
   - Model: `text-embedding-3-small` (Version `1`)
   - Role: Historical transcript indexing and context retrieval.

## Security & Secrets
- Never commit `.env` or API secrets to version control.
- In local development, configuration is read from `.env` via Zod.
- In production, secrets will be loaded securely from Azure Key Vault or container environment variables.
