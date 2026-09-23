import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { audioUploadMiddleware } from '../middleware/upload';
import { sessionService } from '../services/session';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

const startSessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
  participants: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// POST /api/sessions/start - Initialize a new live meeting session
router.post('/start', (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = startSessionSchema.safeParse(req.body || {});
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((i) => i.message).join(', ');
      return next(new AppError(errorMsg, 400, 'INVALID_REQUEST'));
    }

    const session = sessionService.createSession(
      validation.data.title,
      validation.data.participants,
      validation.data.tags
    );
    return res.status(201).json({
      success: true,
      session,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/sessions - List all active/recent sessions
router.get('/', (_req: Request, res: Response) => {
  const sessions = sessionService.listSessions();
  return res.status(200).json({
    success: true,
    sessions,
  });
});

// GET /api/sessions/:id - Get state of a specific session
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = sessionService.getSession(req.params.id);
    if (!session) {
      return next(new AppError(`Meeting session "${req.params.id}" not found.`, 404, 'SESSION_NOT_FOUND'));
    }
    return res.status(200).json({
      success: true,
      session,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/sessions/:id - Update session metadata (title, favorite, tags)
router.patch('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = sessionService.updateSession(req.params.id, req.body);
    return res.status(200).json({
      success: true,
      session,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sessions/:id - Delete a meeting session
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = sessionService.deleteSession(req.params.id);
    if (!deleted) {
      return next(new AppError(`Meeting session "${req.params.id}" not found.`, 404, 'SESSION_NOT_FOUND'));
    }
    return res.status(200).json({
      success: true,
      message: 'Session deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/ask - Contextual Ask This Meeting
router.post('/:id/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.body.query;
    if (!query || typeof query !== 'string') {
      return next(new AppError('Query is required and must be a string.', 400, 'INVALID_QUERY'));
    }
    const result = await sessionService.askMeeting(req.params.id, query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/comments - Add timestamped collaborative comment
router.post('/:id/comments', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, userName, text, timestamp } = req.body;
    if (!text || typeof text !== 'string') {
      return next(new AppError('Comment text is required.', 400, 'INVALID_COMMENT'));
    }
    const comment = sessionService.addComment(req.params.id, {
      userId: userId || 'user-default',
      userName: userName || 'You',
      text,
      timestamp: timestamp || '00:00',
    });
    return res.status(201).json({
      success: true,
      comment,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/chunks - Upload and transcribe an audio chunk
router.post(
  '/:id/chunks',
  audioUploadMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.params.id;
      const file = req.file!;
      const seqRaw = req.body.sequenceNumber;
      const sequenceNumber = seqRaw !== undefined ? parseInt(String(seqRaw), 10) : 0;

      if (isNaN(sequenceNumber) || sequenceNumber < 0) {
        return next(
          new AppError('Invalid sequenceNumber. Must be a non-negative integer.', 400, 'INVALID_SEQUENCE_NUMBER')
        );
      }

      logger.info('Received audio chunk upload', {
        sessionId,
        sequenceNumber,
        sizeBytes: file.size,
        mimeType: file.mimetype,
      }, 'SessionRoutes');

      const result = await sessionService.processAudioChunk(
        sessionId,
        sequenceNumber,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      return res.status(200).json({
        success: true,
        chunk: result.chunk,
        accumulatedTranscript: result.accumulatedTranscript,
        latestAnalysis: result.latestAnalysis,
        savedMemoriesCount: result.savedMemoriesCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/sessions/:id/analyze - Manually trigger an analysis run
router.post('/:id/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const analysis = await sessionService.runAnalysisAndPersist(sessionId, true);
    const session = sessionService.getSession(sessionId);

    return res.status(200).json({
      success: true,
      analysis,
      session,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/sessions/:id/stop - End a session, finalize transcript and run final analysis
router.post('/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const session = await sessionService.endSession(sessionId);

    return res.status(200).json({
      success: true,
      session,
    });
  } catch (err) {
    next(err);
  }
});

export const sessionRouter = router;
