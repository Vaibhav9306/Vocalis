import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EmbeddingResponse } from '@meeting-assistant/shared-types';
import { azureOpenAIService } from '../services/azure';
import { AppError } from '../middleware/errorHandler';

const router = Router();

export const embeddingRequestSchema = z.object({
  text: z
    .string({
      required_error: 'Text is required',
      invalid_type_error: 'Text must be a string',
    })
    .trim()
    .min(1, 'Text must not be empty')
    .max(32000, 'Text exceeds maximum supported length (32,000 characters)'),
});

router.post(
  '/',
  async (req: Request, res: Response<EmbeddingResponse>, next: NextFunction) => {
    try {
      const validation = embeddingRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const errorMsg = validation.error.issues
          .map((i) => i.message)
          .join(', ');
        return next(new AppError(errorMsg, 400, 'INVALID_REQUEST'));
      }

      const result = await azureOpenAIService.createEmbedding(validation.data.text);

      return res.status(200).json({
        success: true,
        embedding: {
          dimensions: result.dimensions,
          vector: result.embedding,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export const embeddingRouter = router;
