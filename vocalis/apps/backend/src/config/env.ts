import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or local if present
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z
    .union([z.string(), z.number()])
    .default('3000')
    .transform((val) => (typeof val === 'number' ? val : parseInt(String(val), 10))),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Azure OpenAI configuration
  AZURE_OPENAI_ENDPOINT: z.string().url().optional().or(z.literal('')),
  AZURE_OPENAI_API_KEY: z.string().optional().or(z.literal('')),

  // Configurable Model Deployment Names
  // Phase 2: Speech Transcription (whisper v001)
  AZURE_OPENAI_DEPLOYMENT_WHISPER: z.string().default('whisper'),
  // Phase 3: Main Meeting AI (gpt-4.1-mini)
  AZURE_OPENAI_DEPLOYMENT_CHAT: z.string().default('gpt-4.1-mini'),
  // Phase 4: Semantic Search (text-embedding-3-small)
  AZURE_OPENAI_DEPLOYMENT_EMBEDDING: z.string().default('text-embedding-3-small'),
  // Fallback deployment name
  AZURE_OPENAI_DEPLOYMENT: z.string().optional().or(z.literal('')),

  // Azure Speech configuration (Preferred: AZURE_SPEECH_KEY, fallback: AZURE_OPENAI_API_KEY)
  AZURE_SPEECH_KEY: z.string().optional().or(z.literal('')),
  AZURE_SPEECH_REGION: z.string().default('eastus2'),

  // Phase 4C: Semantic Memory Storage Configuration
  MEMORY_STORE_TYPE: z.enum(['sqlite', 'in-memory']).default('sqlite'),
  SQLITE_DB_PATH: z.string().default('data/memory.db'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Environment validation failed:', result.error.format());
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
