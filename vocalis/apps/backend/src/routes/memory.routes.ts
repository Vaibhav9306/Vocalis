import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  AddMemoryResponse,
  SearchMemoryResponse,
} from '@meeting-assistant/shared-types';
import { memoryService } from '../services/memory';
import { AppError } from '../middleware/errorHandler';

const router = Router();

export const addMemorySchema = z.object({
  text: z
    .string({
      required_error: 'Text is required',
      invalid_type_error: 'Text must be a string',
    })
    .trim()
    .min(1, 'Text must not be empty')
    .max(32000, 'Text exceeds maximum supported length (32,000 characters)'),
  meetingId: z.string().trim().max(100).optional(),
  meetingTitle: z.string().trim().max(200).optional(),
  source: z.string().trim().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const searchMemorySchema = z.object({
  query: z
    .string({
      required_error: 'Query is required',
      invalid_type_error: 'Query must be a string',
    })
    .trim()
    .min(1, 'Query must not be empty')
    .max(32000, 'Query exceeds maximum supported length (32,000 characters)'),
  topK: z
    .number({
      invalid_type_error: 'topK must be a number',
    })
    .int('topK must be an integer')
    .min(1, 'topK must be at least 1')
    .max(50, 'topK cannot exceed 50')
    .optional()
    .default(5),
});

/**
 * GET /api/memory
 * Lists all indexed meeting memories.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const memories = await memoryService.getAllMemories();
    return res.status(200).json({
      success: true,
      memories,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/memory
 * Embeds and stores a new text memory in the local semantic memory store.
 */
router.post(
  '/',
  async (req: Request, res: Response<AddMemoryResponse>, next: NextFunction) => {
    try {
      const validation = addMemorySchema.safeParse(req.body);
      if (!validation.success) {
        const errorMsg = validation.error.issues
          .map((i) => i.message)
          .join(', ');
        return next(new AppError(errorMsg, 400, 'INVALID_REQUEST'));
      }

      const memory = await memoryService.addTextMemory(validation.data);

      return res.status(200).json({
        success: true,
        memory,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/memory/search
 * Performs cosine similarity search over stored memories using a text query.
 */
router.post(
  '/search',
  async (req: Request, res: Response<SearchMemoryResponse>, next: NextFunction) => {
    try {
      const validation = searchMemorySchema.safeParse(req.body);
      if (!validation.success) {
        const errorMsg = validation.error.issues
          .map((i) => i.message)
          .join(', ');
        return next(new AppError(errorMsg, 400, 'INVALID_REQUEST'));
      }

      const results = await memoryService.searchMemory(
        validation.data.query,
        validation.data.topK
      );

      return res.status(200).json({
        success: true,
        results,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/memory/:id
 * Deletes a single memory record by ID.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await memoryService.deleteMemoryById(req.params.id);
    if (!deleted) {
      return next(new AppError(`Memory record "${req.params.id}" not found.`, 404, 'MEMORY_NOT_FOUND'));
    }
    return res.status(200).json({
      success: true,
      message: 'Memory deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

export const memoryRouter = router;
