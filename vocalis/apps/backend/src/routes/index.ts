import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { transcriptionRouter } from './transcription.routes';
import { aiRouter } from './ai.routes';
import { embeddingRouter } from './embedding.routes';
import { memoryRouter } from './memory.routes';
import { sessionRouter } from './session.routes';
import { saasRouter } from './saas.routes';

const router = Router();

// Primary root health check: GET /health
router.use('/', healthRouter);

// Authentication endpoints: POST /api/auth/login, POST /api/auth/register, GET /api/auth/me
router.use('/api/auth', authRouter);
router.use('/auth', authRouter);

// Root transcription endpoint: POST /transcription
router.use('/transcription', transcriptionRouter);

// Explicit API transcription endpoint: POST /api/transcription
router.use('/api/transcription', transcriptionRouter);

// AI Analysis endpoints: POST /api/ai/analyze, POST /api/ai/ask
router.use('/api/ai', aiRouter);
router.use('/ai', aiRouter);

// Embedding endpoints: POST /api/embeddings (Phase 4A)
router.use('/api/embeddings', embeddingRouter);
router.use('/embeddings', embeddingRouter);

// Memory & Semantic Search endpoints: POST /api/memory, POST /api/memory/search (Phase 4B)
router.use('/api/memory', memoryRouter);
router.use('/memory', memoryRouter);

// Live Meeting Session endpoints (Phase 5A + 5B)
router.use('/api/sessions', sessionRouter);
router.use('/sessions', sessionRouter);

// SaaS Tasks, Decisions, and Usage endpoints
router.use('/api', saasRouter);

// Versioned API namespace: /api/v1
const apiV1Router = Router();
apiV1Router.use('/', healthRouter);
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/transcription', transcriptionRouter);
apiV1Router.use('/ai', aiRouter);
apiV1Router.use('/embeddings', embeddingRouter);
apiV1Router.use('/memory', memoryRouter);
apiV1Router.use('/sessions', sessionRouter);
apiV1Router.use('/', saasRouter);
router.use('/api/v1', apiV1Router);

export const appRouter = router;

