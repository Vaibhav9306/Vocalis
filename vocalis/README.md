# AI Meeting Assistant

A modular TypeScript application designed to capture real-time meeting audio, transcribe discourse with Azure Speech / Whisper, analyze content with Azure OpenAI, detect questions, and extract action items.

---

## Repository Structure

```text
meeting-assistant/
├── apps/
│   ├── backend/             # Express.js REST API (Node.js + TypeScript)
│   │   ├── src/
│   │   │   ├── config/      # Zod environment variable validation
│   │   │   ├── middleware/  # Error handler, request logger, 404 handler
│   │   │   ├── routes/      # GET /health and API routing
│   │   │   ├── services/    # Azure OpenAI & Speech modular interfaces
│   │   │   └── utils/       # Structured logger
│   │   └── tests/           # Vitest API health tests
│   └── frontend/            # React + TypeScript Dashboard Shell (Vite)
│       └── src/
│           ├── components/  # Header, SystemStatusCard, MeetingShell
│           └── services/    # Backend API client
├── packages/
│   └── shared-types/        # Common TypeScript interfaces & contracts
├── infrastructure/          # IaC notes and cloud provisioning docs
├── scripts/                 # Windows PowerShell setup & dev automation
├── docs/                    # Architecture diagrams and specifications
├── .env.example             # Environment configuration template
├── .gitignore               # Strict secret and build artifact exclusion
├── docker-compose.yml       # Local multi-service container orchestration
└── README.md                # Project documentation
```

---

## Approved Azure Models & Roadmap
Model configurations are managed via environment variables and follow strict phase gating:

| Role | Model | Version | Deployment Phase | Purpose |
|---|---|---|---|---|
| **Speech Transcription** | `whisper` | `001` | **Phase 2 (Verified)** | Meeting audio transcription (near-real-time / batch). |
| **Main Meeting AI** | `gpt-4.1-mini` | `2025-04-14` | **Phase 3 (Verified)** | Question detection, suggested answers, summaries, action items. |
| **Semantic Embeddings** | `text-embedding-3-small` | `1` | **Phase 4A (Verified)** | High-dimensional text vector generation (1536 dims). |
| **Local Semantic Memory**| `text-embedding-3-small` | `1` | **Phase 4B (Verified)** | In-memory vector store & cosine similarity search. |
| **Persistent Semantic Memory**| `text-embedding-3-small` | `1` | **Phase 4C (Verified)** | Persistent SQLite vector store with BLOB storage. |
| **RAG Discourse Grounding**| `gpt-4.1-mini` | `2025-04-14` | **Phase 4D (Future)** | Historical meeting context retrieval injection into discourse. |

> **Rules**:
> - `gpt-5-mini` is strictly disallowed; `gpt-4.1-mini` is the approved Main Meeting AI.
> - Phase 2 implements and verifies `whisper` v001 **only**.
> - `gpt-4.1-mini` will not be deployed until Phase 2 transcription is verified.

---

## Prerequisites
- **Node.js**: v20+ (tested on v24.14.0)
- **npm**: v10+ (tested on v11.9.0)
- (Optional) **Docker**: For containerized local execution

---

## Getting Started

### 1. Clone & Setup Environment

Copy the example environment configuration:
```powershell
cp .env.example .env
```
> **Note**: In Phase 1, Azure credentials remain empty. Do NOT commit secrets or real keys into source control.

### 2. Install Dependencies & Build Packages

Run npm install at the monorepo root to link all workspaces:
```powershell
npm install
npm run build -w @meeting-assistant/shared-types
```
*(Or simply run `.\scripts\setup.ps1`)*

### 3. Run Development Servers

Run backend and frontend concurrently:
```powershell
npm run dev:backend   # Starts backend on http://localhost:3001
npm run dev:frontend  # Starts frontend on http://localhost:5173
```
*(Or run `.\scripts\dev.ps1` on Windows)*

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Runs development servers across all workspaces |
| `npm run dev:backend` | Starts backend development server (`tsx watch`) |
| `npm run dev:frontend` | Starts Vite frontend dev server |
| `npm run build` | Compiles all TypeScript workspaces |
| `npm run type-check` | Performs TypeScript type checking without emitting files |
| `npm run test` | Runs backend tests with Vitest |
| `npm run test:backend`| Executes backend test suite |

---

### `GET /health`
Returns system status, uptime, environment, and readiness of Azure integration layers.

### `POST /api/transcription`
Accepts `multipart/form-data` with an audio file under field name `audio`.
- **Supported Formats**: `wav`, `mp3`, `m4a`, `webm`, `mp4`, `ogg`
- **Max File Size**: 25 MB
- **Request Example**:
  ```powershell
  # Using the included PowerShell test utility
  .\scripts\test-transcription.ps1 -AudioPath "scripts\sample_test.wav"

  # Or using curl
  curl.exe -X POST "http://localhost:3001/api/transcription" -F "audio=@scripts\sample_test.wav"
  ```
- **Response Format**:
  ```json
  {
    "success": true,
    "transcript": "Hello this is a test of the AI meeting assistant transcription pipeline",
    "language": "english",
    "durationSeconds": 5.13,
    "segments": [
      {
        "id": 0,
        "start": 0,
        "end": 4.86,
        "text": "Hello this is a test of the AI meeting assistant transcription pipeline"
      }
    ]
  }
  ```

### `POST /api/ai/analyze`
Extracts structured meeting intelligence (questions, decisions, action items, key points, topics) using `gpt-4.1-mini`.
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "transcript": "Alex: We need to finish the mobile app by Friday.\nSarah: Can we add push notifications before release?\nAlex: Yes, let's include them.\nSarah: I'll implement the notifications.\nAlex: Great, let's release Friday.",
    "meetingTitle": "Sprint Planning (Optional)",
    "context": "Context (Optional)",
    "participants": ["Alex", "Sarah"]
  }
  ```
- **Response Format**:
  ```json
  {
    "success": true,
    "analysis": {
      "detectedQuestions": [
        {
          "question": "Can we add push notifications before release?",
          "context": "Sarah asks about adding push notifications before release.",
          "suggestedAnswer": "Yes, let's include them.",
          "confidence": 0.95
        }
      ],
      "keyPoints": [
        "The mobile app needs to be finished by Friday.",
        "Push notifications are to be added before the release.",
        "Sarah will implement the push notifications.",
        "The release is scheduled for Friday."
      ],
      "decisions": [
        "Push notifications will be included before the release.",
        "The mobile app release date is set for Friday."
      ],
      "actionItems": [
        {
          "task": "Implement push notifications.",
          "owner": "Sarah",
          "deadline": "Friday"
        }
      ],
      "topics": [
        "Mobile app development",
        "Push notifications",
        "Release scheduling"
      ]
    }
  }
  ```

### `POST /api/embeddings`
Converts input text into a high-dimensional dense vector (1536 dimensions) using Azure OpenAI `text-embedding-3-small`.
- **Deployment Name**: `text-embedding-3-small`
- **Environment Variable**: `AZURE_OPENAI_DEPLOYMENT_EMBEDDING=text-embedding-3-small`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "text": "Hello, this is a test of the AI meeting assistant embedding pipeline."
  }
  ```
- **Response Format**:
  ```json
  {
    "success": true,
    "embedding": {
      "dimensions": 1536,
      "vector": [
        0.0013875961303710938,
        -0.0191497802734375,
        0.063720703125,
        -0.0300445556640625,
        -0.0245819091796875
      ]
    }
  }
  ```

> [!NOTE]
> **Phase 4A Scope**: This endpoint provides raw embedding generation only. For semantic indexing and similarity retrieval, see Phase 4B memory endpoints below.

### `POST /api/memory`
Embeds and stores text memories in the local semantic memory store.
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "text": "The team decided that the mobile app will be released on Friday.",
    "meetingId": "meeting-123",
    "meetingTitle": "Release Planning",
    "source": "meeting"
  }
  ```
- **Response Format** (Embedding vector is intentionally omitted in client DTO):
  ```json
  {
    "success": true,
    "memory": {
      "id": "09007ba0-21bd-45d0-bcc7-5dce29f28371",
      "text": "The team decided that the mobile app will be released on Friday.",
      "meetingId": "meeting-123",
      "meetingTitle": "Release Planning",
      "source": "meeting",
      "createdAt": "2026-09-21T17:54:21.081Z"
    }
  }
  ```

### `POST /api/memory/search`
Performs cosine similarity search against stored embeddings.
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "query": "When will the mobile app be released?",
    "topK": 3
  }
  ```
- **Response Format**:
  ```json
  {
    "success": true,
    "results": [
      {
        "memory": {
          "id": "09007ba0-21bd-45d0-bcc7-5dce29f28371",
          "text": "The team decided that the mobile app will be released on Friday.",
          "meetingId": "meeting-123",
          "meetingTitle": "Release Planning",
          "source": "meeting",
          "createdAt": "2026-09-21T17:54:21.081Z"
        },
        "similarity": 0.7159
      },
      {
        "memory": {
          "id": "9cbefcee-7015-4e29-9179-10d1537f9a9b",
          "text": "Sarah will implement push notifications before Friday.",
          "meetingId": "meeting-101",
          "meetingTitle": "Sprint Planning",
          "source": "meeting",
          "createdAt": "2026-09-21T17:54:20.156Z"
        },
        "similarity": 0.3503
      }
    ]
  }
  ```

> [!NOTE]
> **Phase 4C Persistent Semantic Memory**:
> Memories are persistently stored on disk in SQLite (`apps/backend/data/memory.db`) and survive backend restarts.
>
> - **Binary Vector Storage**: Embeddings are stored as native 32-bit float BLOBs (6,144 bytes per 1536-dim vector) rather than large JSON strings.
> - **Database Schema**:
>   ```sql
>   CREATE TABLE IF NOT EXISTS memories (
>     id TEXT PRIMARY KEY,
>     text TEXT NOT NULL,
>     embedding BLOB NOT NULL,
>     created_at TEXT NOT NULL,
>     meeting_id TEXT,
>     meeting_title TEXT,
>     source TEXT,
>     metadata TEXT
>   );
>   CREATE INDEX IF NOT EXISTS idx_memories_meeting_id ON memories(meeting_id);
>   CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
>   ```
> - **Configuration (`.env`)**:
>   - `MEMORY_STORE_TYPE=sqlite` (default for dev/production) or `MEMORY_STORE_TYPE=in-memory` (ephemeral/testing)
>   - `SQLITE_DB_PATH=data/memory.db` (configurable disk location, excluded from Git)
> - **Test Isolation**: Unit tests automatically use isolated in-memory storage or isolated temporary database files, preventing test concurrency collisions.

---

## Docker Compose
To run both backend and frontend using Docker:
```bash
docker compose up --build
```
- Backend will be accessible at: `http://localhost:3001`
- Frontend will be accessible at: `http://localhost:5173`
