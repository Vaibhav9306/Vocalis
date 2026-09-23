import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MeetingAnalysisResponse } from '@meeting-assistant/shared-types';
import { azureOpenAIService } from '../services/azure';
import { sessionService } from '../services/session';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const meetingAnalysisRequestSchema = z.object({
  transcript: z
    .string({
      required_error: 'Transcript is required',
      invalid_type_error: 'Transcript must be a string',
    })
    .trim()
    .min(1, 'Transcript must not be empty')
    .max(100000, 'Transcript exceeds maximum supported length (100,000 characters)'),
  context: z.string().optional(),
  meetingTitle: z.string().optional(),
  participants: z.array(z.string()).optional(),
});

router.post(
  '/analyze',
  async (req: Request, res: Response<MeetingAnalysisResponse>, next: NextFunction) => {
    try {
      const validation = meetingAnalysisRequestSchema.safeParse(req.body);
      if (!validation.success) {
        const errorMsg = validation.error.issues
          .map((i) => i.message)
          .join(', ');
        return next(new AppError(errorMsg, 400, 'INVALID_REQUEST'));
      }

      const analysis = await azureOpenAIService.analyzeMeeting(validation.data);

      return res.status(200).json({
        success: true,
        analysis,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/ai/ask - Ask Scribe AI query across active meeting or all memories
router.post('/ask', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.body.query;
    if (!query || typeof query !== 'string') {
      return next(new AppError('Query is required and must be a string.', 400, 'INVALID_QUERY'));
    }

    const meetingId = req.body.meetingId;
    const liveTranscript = req.body.transcript;

    if (liveTranscript && typeof liveTranscript === 'string' && liveTranscript.trim().length > 0) {
      const response = await sessionService.askWithContext(query, liveTranscript, meetingId);
      return res.status(200).json(response);
    }

    if (meetingId) {
      const response = await sessionService.askMeeting(meetingId, query);
      return res.status(200).json(response);
    }

    const response = await sessionService.askGlobal(query);
    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export const aiRouter = router;
