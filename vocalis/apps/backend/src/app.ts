import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { logger } from './utils/logger';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import { appRouter } from './routes';

export const createApp = (): Application => {
  const app: Application = express();

  // Production-grade CORS configuration:
  // Restricts from wildcard "*" to actual production origin while preserving chrome-extension origins
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin header (same-origin browser fetches, server-to-server, curl)
        if (!origin) {
          return callback(null, true);
        }

        // Allow configured production origin (e.g. https://<app-name>.azurewebsites.net)
        if (env.CORS_ORIGIN && env.CORS_ORIGIN !== '*' && origin === env.CORS_ORIGIN) {
          return callback(null, true);
        }

        // Separately preserve Chrome Extension origins
        if (origin.startsWith('chrome-extension://')) {
          return callback(null, true);
        }

        // Allow Azure App Service domain if origin matches
        if (origin.endsWith('.azurewebsites.net')) {
          return callback(null, true);
        }

        // In development mode, allow localhost origins
        if (env.NODE_ENV === 'development' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
          return callback(null, true);
        }

        // Reject untrusted origins
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Structured request logger
  app.use(requestLogger);

  // Application routes (API, /health, /api/*, etc.)
  app.use(appRouter);

  // Production Static File Serving & SPA Fallback
  const candidateDistPaths = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(process.cwd(), 'apps/frontend/dist'),
    path.resolve(__dirname, '../../../apps/frontend/dist'),
  ];
  const frontendDistPath = candidateDistPaths.find((candidate) => fs.existsSync(candidate));

  if (frontendDistPath) {
    logger.info(`Frontend static build served from: ${frontendDistPath}`, {}, 'StaticServing');
    app.use(express.static(frontendDistPath));

    // SPA fallback: return index.html for non-API, non-WS GET requests
    app.get('*', (req, res, next) => {
      // Never intercept API routes, health checks, or WebSocket upgrade endpoints
      if (
        req.path === '/health' ||
        req.path.startsWith('/api') ||
        req.path.startsWith('/ws') ||
        req.path.startsWith('/transcription') ||
        req.path.startsWith('/auth') ||
        req.path.startsWith('/ai') ||
        req.path.startsWith('/embeddings') ||
        req.path.startsWith('/memory') ||
        req.path.startsWith('/sessions')
      ) {
        return next();
      }

      const indexPath = path.join(frontendDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      return next();
    });
  }

  // 404 and error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

