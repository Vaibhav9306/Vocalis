import { Readable } from 'stream';
import {
  IAzureSpeechService,
  AzureSpeechConfig,
  TranscriptionOptions,
  TranscriptionResult,
} from './types';
import { TranscriptionChunk, ServiceStatus } from '@meeting-assistant/shared-types';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export class AzureSpeechService implements IAzureSpeechService {
  private readonly key?: string;
  private readonly region?: string;

  constructor(config: AzureSpeechConfig) {
    this.key = config.key;
    this.region = config.region;
  }

  public isConfigured(): boolean {
    return Boolean(this.key && this.region);
  }

  public getStatus(): ServiceStatus {
    const configured = this.isConfigured();
    return {
      configured,
      region: this.region || undefined,
      notes: configured
        ? 'Speech credentials and region configured'
        : 'Pending Azure Speech key & region configuration in Phase 2',
    };
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new AppError(
        'Azure Speech/Whisper service is not configured. Credentials and region will be connected in Phase 2.',
        503,
        'AZURE_SPEECH_NOT_CONFIGURED'
      );
    }
  }

  public async transcribeAudio(
    audioBuffer: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    this.ensureConfigured();
    logger.info('Azure Speech transcribeAudio called', { bufferByteLength: audioBuffer.byteLength }, 'AzureSpeech');
    // Implementation will be wired to Azure Speech SDK / Whisper API in Phase 2
    throw new AppError('Implementation pending Phase 2 Azure integration', 501, 'NOT_IMPLEMENTED');
  }

  public async transcribeStream(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _audioStream: Readable,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onChunk: (chunk: TranscriptionChunk) => void,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    this.ensureConfigured();
    logger.info('Azure Speech transcribeStream called', {}, 'AzureSpeech');
    // Implementation will be wired to Azure Speech SDK streaming in Phase 2
    throw new AppError('Implementation pending Phase 2 Azure integration', 501, 'NOT_IMPLEMENTED');
  }
}
