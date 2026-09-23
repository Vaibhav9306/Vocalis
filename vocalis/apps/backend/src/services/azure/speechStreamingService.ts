import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { env } from '../../config/env';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export interface SpeechStreamingCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string, durationSeconds?: number) => void;
  onError: (error: Error) => void;
  onClose?: () => void;
}

export interface ISpeechStreamingSession {
  writeAudio(buffer: Buffer): void;
  stop(): Promise<void>;
  isActive(): boolean;
}

export interface ISpeechStreamingService {
  isConfigured(): boolean;
  startSession(callbacks: SpeechStreamingCallbacks, language?: string): Promise<ISpeechStreamingSession>;
}

export class AzureSpeechStreamingService implements ISpeechStreamingService {
  private readonly key?: string;
  private readonly region?: string;

  constructor(key?: string, region?: string) {
    // If explicitly provided, honor it (empty string becomes undefined); otherwise fallback to env
    this.key = key !== undefined
      ? (key.trim() || undefined)
      : (env.AZURE_SPEECH_KEY || env.AZURE_OPENAI_API_KEY || undefined);
    this.region = region !== undefined
      ? (region.trim() || undefined)
      : (env.AZURE_SPEECH_REGION || 'eastus2');
  }

  public isConfigured(): boolean {
    return Boolean(this.key && this.region);
  }

  public async startSession(callbacks: SpeechStreamingCallbacks, language = 'en-US'): Promise<ISpeechStreamingSession> {
    if (!this.isConfigured()) {
      throw new AppError(
        'Azure Speech streaming is not configured. Verify AZURE_SPEECH_KEY or AZURE_OPENAI_API_KEY and AZURE_SPEECH_REGION.',
        503,
        'AZURE_SPEECH_NOT_CONFIGURED'
      );
    }

    logger.info('Initializing Azure Speech continuous recognition session (Auto multilingual & Hinglish)', {
      region: this.region,
    }, 'AzureSpeechStreaming');

    const speechConfig = sdk.SpeechConfig.fromSubscription(this.key!, this.region!);
    speechConfig.outputFormat = sdk.OutputFormat.Detailed;

    // 16kHz, 16-bit Mono Linear PCM (standard speech recognition format)
    const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
    const pushStream = sdk.AudioInputStream.createPushStream(format);
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    let recognizer: sdk.SpeechRecognizer;
    try {
      // Auto-detect English, Hindi, and Hinglish code-switching automatically
      const autoDetectConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(['en-IN', 'hi-IN', 'en-US']);
      recognizer = sdk.SpeechRecognizer.FromConfig(speechConfig, autoDetectConfig, audioConfig);
    } catch {
      speechConfig.speechRecognitionLanguage = 'en-IN';
      recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    }

    let active = true;

    recognizer.recognizing = (_sender, event) => {
      if (!active) return;
      const text = event.result?.text?.trim();
      if (text) {
        callbacks.onInterim(text);
      }
    };

    recognizer.recognized = (_sender, event) => {
      if (!active) return;
      if (event.result.reason === sdk.ResultReason.RecognizedSpeech) {
        const text = event.result.text?.trim();
        if (text) {
          // Duration in 100-nanosecond ticks -> convert to seconds
          const durationSeconds = event.result.duration
            ? Number(event.result.duration) / 10000000
            : undefined;
          logger.info('Recognized speech segment', {
            textLength: text.length,
            durationSeconds,
          }, 'AzureSpeechStreaming');
          callbacks.onFinal(text, durationSeconds);
        }
      }
    };

    recognizer.canceled = (_sender, event) => {
      if (event.reason === sdk.CancellationReason.Error) {
        logger.error('Azure Speech recognition canceled with error', {
          errorCode: event.errorCode,
          errorDetails: event.errorDetails,
        }, 'AzureSpeechStreaming');

        callbacks.onError(
          new AppError(
            `Azure Speech recognition error: ${event.errorDetails} (Code: ${event.errorCode})`,
            502,
            'AZURE_SPEECH_ERROR'
          )
        );
      }
    };

    recognizer.sessionStopped = () => {
      logger.info('Azure Speech session stopped event received', {}, 'AzureSpeechStreaming');
      callbacks.onClose?.();
    };

    // Start continuous recognition asynchronously
    await new Promise<void>((resolve, reject) => {
      recognizer.startContinuousRecognitionAsync(
        () => {
          logger.info('Azure Speech continuous recognition started', {}, 'AzureSpeechStreaming');
          resolve();
        },
        (err) => {
          logger.error('Failed to start continuous recognition', { error: err }, 'AzureSpeechStreaming');
          reject(
            new AppError(
              `Failed to start Azure Speech continuous recognition: ${err}`,
              500,
              'SPEECH_START_ERROR'
            )
          );
        }
      );
    });

    const session: ISpeechStreamingSession = {
      writeAudio: (buffer: Buffer) => {
        if (!active) return;
        try {
          // Pass the underlying ArrayBuffer slice into PushAudioInputStream
          const arrayBuffer = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
          ) as ArrayBuffer;
          pushStream.write(arrayBuffer);
        } catch (err) {
          logger.warn('Failed writing audio buffer to push stream', { error: err }, 'AzureSpeechStreaming');
        }
      },
      stop: async () => {
        if (!active) return;
        active = false;
        try {
          pushStream.close();
        } catch {
          // ignore stream close errors
        }

        await new Promise<void>((resolve) => {
          recognizer.stopContinuousRecognitionAsync(
            () => {
              try {
                recognizer.close();
              } catch {
                // ignore
              }
              resolve();
            },
            () => {
              try {
                recognizer.close();
              } catch {
                // ignore
              }
              resolve();
            }
          );
        });
      },
      isActive: () => active,
    };

    return session;
  }
}

export const azureSpeechStreamingService = new AzureSpeechStreamingService();
