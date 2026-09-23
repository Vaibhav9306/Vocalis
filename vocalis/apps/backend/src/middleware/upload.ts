import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { AppError } from './errorHandler';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (Azure Whisper REST API limit)

const ALLOWED_EXTENSIONS = new Set([
  '.wav',
  '.mp3',
  '.m4a',
  '.webm',
  '.mp4',
  '.ogg',
  '.mpeg',
  '.mpga',
]);

const ALLOWED_MIME_PREFIXES = ['audio/', 'video/webm', 'video/mp4'];

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtensionValid = ALLOWED_EXTENSIONS.has(ext);
  const isMimeValid = ALLOWED_MIME_PREFIXES.some(prefix =>
    file.mimetype.toLowerCase().startsWith(prefix)
  );

  // Allow if either extension is valid or MIME type is audio/video
  if (isExtensionValid || isMimeValid) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Unsupported audio format "${ext || file.mimetype}". Supported formats: wav, mp3, m4a, webm, mp4`,
        415,
        'UNSUPPORTED_MEDIA_TYPE'
      )
    );
  }
};

const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

export const audioUploadMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const uploadSingle = multerUpload.single('audio');

  uploadSingle(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new AppError(
              'Audio file exceeds 25 MB limit for Whisper transcription.',
              413,
              'FILE_TOO_LARGE'
            )
          );
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(
            new AppError(
              `Unexpected field "${err.field}". Audio file must be uploaded under field name "audio".`,
              400,
              'INVALID_FIELD_NAME'
            )
          );
        }
        return next(new AppError(`Upload error: ${err.message}`, 400, 'UPLOAD_ERROR'));
      }
      return next(err);
    }

    if (!req.file) {
      return next(
        new AppError(
          'Missing audio file. Please attach an audio file using multipart/form-data with field name "audio".',
          400,
          'AUDIO_FILE_REQUIRED'
        )
      );
    }

    next();
  });
};
