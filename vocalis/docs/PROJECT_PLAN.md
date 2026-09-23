# AI Meeting Assistant - Master Project Plan & Model Roadmap

## 1. Executive Summary & Model Architecture Decisions

The AI Meeting Assistant leverages Azure OpenAI models hosted in **East US** (`ai-meeting-assistant`), with strict phased gating to safeguard the $200 Azure credit, ensure architectural reliability, and prevent resource bloat.

### Approved Model Catalog

| Functional Role | Selected Model | Version | Deployment Phase | Primary Responsibilities |
|---|---|---|---|---|
| **Speech Transcription** | `whisper` | `001` | **Phase 2 (Immediate Next)** | Meeting audio transcription; near-real-time / batch transcript generation. |
| **Main Meeting AI** | `gpt-4.1-mini` | `2025-04-14` | **Phase 3 (Gated)** | Question detection, meeting context understanding, suggested answers, key-point extraction, meeting summaries, and action items. |
| **Semantic Search & Retrieval** | `text-embedding-3-small` | `1` | **Phase 4 (Future)** | Historical transcript search, context retrieval, vector search across past meetings. |

### Strict Model Selection Rules
1. **NO GPT-5-mini**: Under no circumstances should `gpt-5-mini` or any other model be substituted for the Main Meeting AI.
2. **NO Alternate GPT Substitutions**: Main Meeting AI is locked to `gpt-4.1-mini`.
3. **Phase 2 Isolation**: Phase 2 must **ONLY** implement and test `whisper` (v001).
4. **Phase 3 Deployment Gate**: `gpt-4.1-mini` will **NOT** be deployed or implemented until Phase 2 audio transcription is fully working and verified.
5. **Configurable Deployments**: All deployment names must remain fully configurable via environment variables (`AZURE_OPENAI_DEPLOYMENT_WHISPER`, `AZURE_OPENAI_DEPLOYMENT_CHAT`, `AZURE_OPENAI_DEPLOYMENT_EMBEDDING`).
6. **Pre-deployment Verification**: Prior to creating any deployment, inspect quota, available capacity, and existing deployments in the resource group.
7. **Explicit User Approval**: Never create paid resources or deploy models without explicit user consent.

---

## 2. Phased Implementation Roadmap

```
+-----------------------------------------------------------------------------+
| Phase 1: Local Foundation [COMPLETED]                                       |
| - Monorepo structure, shared types, Express backend, React shell           |
| - Environment validation (Zod), structured logger, error handler, health    |
| - Vitest test suite, Docker Compose, TypeScript verification                |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Phase 2: Speech Transcription Pipeline (Whisper v001) [COMPLETED & VERIFIED]|
| - Deployed whisper (v001, Standard SKU, Capacity 1) to                      |
|   'ai-meeting-assistant-5g-resource' in East US 2                           |
| - Implemented AzureOpenAIService.transcribeAudio() with verbose_json parsing|
| - Implemented POST /api/transcription with multer validation                |
| - Built PowerShell test client (scripts/test-transcription.ps1)             |
| - Verified end-to-end with real audio (sample_test.wav) returning transcript|
| - 100% automated tests passing with zero cloud calls in Vitest suite        |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Phase 3: Main Meeting AI (gpt-4.1-mini) [COMPLETED & VERIFIED]              |
| - Deployed gpt-4.1-mini (v2025-04-14, GlobalStandard SKU, Capacity 10) to  |
|   'ai-meeting-assistant-5g-resource' in East US 2                           |
| - Implemented AzureOpenAIService.analyzeMeeting() with json_object schema   |
| - Implemented Zod validation for questions, decisions, actions, and topics  |
| - Implemented POST /api/ai/analyze endpoint                                 |
| - Verified with 11 automated Vitest tests (zero cloud calls)                |
| - Executed ONE controlled real test with synthetic meeting transcript       |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Phase 4: Semantic Search & Meeting Memory (text-embedding-3-small)          |
| - Deploy text-embedding-3-small for semantic transcript indexing            |
| - Build vector embedding generation and search service                      |
| - Enable retrieval of historical meeting context and cross-meeting insights |
+-----------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
| Phase 5: Client Integrations & Frontend Polish                              |
| - Audio capture integration (browser microphone / Google Meet extension)    |
| - Live real-time dashboard UI with transcript sync and instant AI feed      |
| - Production hardening and Azure Key Vault integration                      |
+-----------------------------------------------------------------------------+
```

---

## 3. Environment & Configuration Specifications

| Variable | Default Value | Target Service | Usage |
|---|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | `https://ai-meeting-assistant.openai.azure.com/` | Resource Root | Base Azure OpenAI URL |
| `AZURE_OPENAI_API_KEY` | *(Secret - via .env)* | Authentication | Kept secure; never in source |
| `AZURE_OPENAI_DEPLOYMENT_WHISPER` | `whisper` | Speech Transcription | Model: `whisper`, Version: `001` |
| `AZURE_OPENAI_DEPLOYMENT_CHAT` | `gpt-4.1-mini` | Main Meeting AI | Model: `gpt-4.1-mini` (Phase 3) |
| `AZURE_OPENAI_DEPLOYMENT_EMBEDDING`| `text-embedding-3-small` | Semantic Search | Model: `text-embedding-3-small` |
| `AZURE_SPEECH_REGION` | `eastus` | Azure Speech Services | Fallback / Hybrid speech |

---

## 4. Cost and Credit Safeguards ($200 Azure Credit)
- **Zero Idle Spend in Phase 1**: All foundational work runs locally with zero cloud charges.
- **Pay-per-minute / Pay-per-token Only**: When deployed, `whisper` charges per audio minute processed and `gpt-4.1-mini` charges per input/output token; neither incurs high hourly reserved provisioning costs under Standard/GlobalStandard tiers.
- **Quota & Availability Pre-flight**: Every deployment command is preceded by `az cognitiveservices account list-models` checks.
- **No Duplicate Resource Creation**: All deployments target the existing `ai-meeting-assistant` account in `eastus`.
