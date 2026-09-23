import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { setupLiveMeetingWebSocket } from './websocket/liveMeetingWs';

const app = createApp();

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : (env.PORT || 3000);

const server = app.listen(port, () => {
  logger.info(`🚀 AI Meeting Assistant Backend running on http://localhost:${port}`, {
    port,
    environment: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
  }, 'Server');
});

// Attach WebSocket live audio streaming server
const wss = setupLiveMeetingWebSocket(server);

const handleShutdown = (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown...`, {}, 'Server');
  wss.close(() => {
    logger.info('WebSocket server closed.', {}, 'Server');
  });
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.', {}, 'Server');
    process.exit(0);
  });

  // Force shutdown after 10s if hanging
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout', {}, 'Server');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export { server };
