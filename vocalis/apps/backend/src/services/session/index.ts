import { azureOpenAIService } from '../azure';
import { memoryService } from '../memory';
import { SessionService } from './sessionService';

export * from './types';
export * from './sessionService';

// Active singleton instance of SessionService wired with Azure OpenAI and Memory services
export const sessionService = new SessionService(azureOpenAIService, memoryService);
