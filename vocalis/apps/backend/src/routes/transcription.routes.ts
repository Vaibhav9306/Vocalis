import { Router, Request, Response, NextFunction } from 'express';
import { TranscriptionResponse, TranscriptionChunk } from '@meeting-assistant/shared-types';
import { audioUploadMiddleware } from '../middleware/upload';
import { azureOpenAIService } from '../services/azure';
import { logger } from '../utils/logger';

const router = Router();

router.post(
  '/',
  audioUploadMiddleware,
  async (req: Request, res: Response<TranscriptionResponse>, next: NextFunction) => {
    try {
      const file = req.file!;
      const language = typeof req.body.language === 'string' ? req.body.language : undefined;
      const prompt = typeof req.body.prompt === 'string' ? req.body.prompt : undefined;

      logger.info('Processing audio transcription request', {
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        language,
      }, 'TranscriptionRoute');

      const result = await azureOpenAIService.transcribeAudio(
        file.buffer,
        file.originalname,
        file.mimetype,
        { language, prompt }
      );

      const segments = result.chunks.map((chunk: TranscriptionChunk, idx: number) => {
        // Parse time range if in "start - end" format
        const match = chunk.timestamp.match(/([\d.]+)s\s*-\s*([\d.]+)s/);
        return {
          id: idx,
          start: match ? parseFloat(match[1]) : 0,
          end: match ? parseFloat(match[2]) : 0,
          text: chunk.text,
        };
      });

      return res.status(200).json({
        success: true,
        transcript: result.fullText,
        language: result.language,
        durationSeconds: result.durationSeconds,
        segments: segments.length > 0 ? segments : undefined,
      });
    } catch (err) {
      next(err);
    }
  }
);

export const transcriptionRouter = router;
