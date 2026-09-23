 Vocalis 🎙️ — AI Meeting Assistant

Vocalis is an AI-powered meeting assistant that automatically listens to meetings, transcribes them, understands the conversation, extracts useful information, and remembers it for later — so nothing important from a meeting ever gets lost.

## 🎯 Purpose

Meetings generate a lot of valuable information — decisions, tasks, deadlines, questions — but most of it gets forgotten or buried in someone's notes. Vocalis solves this by automatically capturing, understanding, and remembering meeting content, making it searchable later.

## ✨ Features

- 🎧 **Speech-to-Text** — Converts meeting audio into text using Azure Speech / Whisper
- 🧠 **Meeting Understanding** — Uses Azure OpenAI GPT-4.1-mini to analyze the transcript and extract:
  - Questions asked during the meeting
  - Key discussion points
  - Decisions made
  - Topics covered
  - Action items — including who is responsible and the deadline
- 🔍 **Semantic Memory Search** — Converts important meeting information into embeddings (text-embedding-3-small), stores them, and allows similarity-based search across past meetings (e.g. asking "When will the app be released?" and getting an answer pulled from an earlier meeting)
- 🐳 **Dockerized Setup** — Frontend and backend run together easily via Docker

**Example:** If someone says *"Sarah will implement notifications by Friday,"* Vocalis automatically detects this as a task, assigns it to Sarah, and sets the deadline to Friday — no manual note-taking needed.

## 🏗️ How It Works (Pipeline)

Meeting Audio
│
▼
Azure Speech / Whisper → converts audio to text (transcript)
│
▼
Azure OpenAI GPT-4.1-mini → analyzes transcript, extracts questions,
key points, decisions, topics, action items
│
▼
text-embedding-3-small → converts key info into embeddings
│
▼
Stored in database (SQLite) → searchable later via semantic similarity


## 🏛️ System Architecture

Client Applications
├── Web Dashboard (React + Vite)
└── Google Meet Extension (Future Phase)
│ REST / SSE / WS
▼
Backend Server (Node.js + Express + TypeScript)
├── REST API (CORS, Logger, Error Handler)
├── Routes: /health, /api/v1/...
└── Service Abstraction Layer
├── IAzureOpenAIService (Summaries, Actions, Questions)
└── IAzureSpeechService (Whisper / Transcription)
│ Azure SDK Calls
▼
Azure Cloud Services
├── Azure OpenAI Service (GPT-4.1-mini, text-embedding-3-small)
└── Azure Speech Services (Whisper / Speech-to-Text)


## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | SQLite |
| Speech-to-Text | Azure Speech / Whisper |
| AI Analysis | Azure OpenAI GPT-4.1-mini |
| Semantic Search | text-embedding-3-small |
| Validation | Zod |
| Testing | Vitest |
| Containerization | Docker, Docker Compose |

## 📁 Project Structure

├── apps/
│ ├── backend/ # Express REST API, Azure integrations
│ └── frontend/ # React + Vite dashboard
├── packages/
│ └── shared-types/ # Shared TypeScript types across the app
├── infrastructure/ # Cloud resource definitions
├── scripts/ # Setup and dev automation scripts
└── docs/ # Architecture and planning docs


## 🗺️ Development Roadmap

| Phase | What It Covers | Status |
|---|---|---|
| Phase 1 | Monorepo setup, backend + frontend foundation, Docker, env validation | ✅ Completed |
| Phase 2 | Audio transcription using Whisper | ✅ Completed |
| Phase 3 | Meeting analysis using GPT-4.1-mini (questions, decisions, action items) | ✅ Completed |
| Phase 4 | Semantic search using embeddings | 🔜 In Progress |
| Phase 5 | Live meeting integrations, real-time dashboard, production hardening | ⏳ Planned |

## ⚙️ Environment Variables

Create a `.env` file in the root based on `.env.example`:

AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_API_KEY=your_key
AZURE_OPENAI_DEPLOYMENT_WHISPER=whisper
AZURE_OPENAI_DEPLOYMENT_CHAT=gpt-4.1-mini
AZURE_OPENAI_DEPLOYMENT_EMBEDDING=text-embedding-3-small
AZURE_SPEECH_REGION=eastus



## 🚀 Getting Started
```bash
# Clone the repository
git clone https://github.com/<your-username>/vocalis.git
cd vocalis

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run the project using Docker
docker-compose up
```


Once running, check the backend health at: `GET /health`

## 🧪 Testing

```bash
npm run test
```

All tests run using **Vitest** with **zero real cloud API calls** — Azure services are mocked through service interfaces (`IAzureOpenAIService`, `IAzureSpeechService`).

## 📌 Notes

- The Main Meeting AI model is locked to `gpt-4.1-mini` — no substitutions.
- Speech transcription uses `whisper` (v001) only.
- All Azure deployment names are configurable via environment variables.
- No paid Azure resources are created without explicit approval.
- Pre-deployment checks (quota/capacity) are performed before any Azure model deployment.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. Feel free to open a pull request or raise an issue.

## 📄 License

This project is licensed under the MIT License.
