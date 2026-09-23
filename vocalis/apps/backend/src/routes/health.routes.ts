import { Router, Request, Response } from 'express';
import { HealthResponse } from '@meeting-assistant/shared-types';
import { env } from '../config/env';
import { azureOpenAIService, azureSpeechService } from '../services/azure';

const router = Router();

router.get('/health', (_req: Request, res: Response<HealthResponse>) => {
  const healthData: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    version: '0.1.0',
    services: {
      azureOpenAI: azureOpenAIService.getStatus(),
      azureSpeech: azureSpeechService.getStatus(),
    },
  };

  res.status(200).json(healthData);
});

export const healthRouter = router;
