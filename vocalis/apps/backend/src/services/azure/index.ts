import { env } from '../../config/env';
import { AzureOpenAIService } from './openAiService';
import { AzureSpeechService } from './speechService';

export * from './types';
export * from './openAiService';
export * from './speechService';
export * from './speechStreamingService';

// Singleton service instances initialized with validated environment variables
export const azureOpenAIService = new AzureOpenAIService({
  endpoint: env.AZURE_OPENAI_ENDPOINT,
  apiKey: env.AZURE_OPENAI_API_KEY,
  deploymentWhisper: env.AZURE_OPENAI_DEPLOYMENT_WHISPER,
  deploymentChat: env.AZURE_OPENAI_DEPLOYMENT_CHAT,
  deploymentEmbedding: env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
  deployment: env.AZURE_OPENAI_DEPLOYMENT,
});

export const azureSpeechService = new AzureSpeechService({
  key: env.AZURE_SPEECH_KEY || env.AZURE_OPENAI_API_KEY,
  region: env.AZURE_SPEECH_REGION,
});
