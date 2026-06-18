// Configuration constants for the Bdarija extension
export const CONFIG = {
  // Local Hono backend URL
  backendUrl: 'http://localhost:8787',

  // Timeout for API requests in milliseconds (e.g. 30 seconds)
  apiTimeoutMs: 90000,

  // Default queue pacing. Providers can override these values below.
  chunkSize: 1,
  chunkCharLimit: 500,
  requestDelayMs: 1500,
  rateLimitDelayMs: 8000,
  maxRetryAttempts: 1,
  autoViewportIdleMs: 900,

  // Gemini free keys need slower line-by-line translation to avoid burning RPM/TPM.
  providerPacing: {
    gemini: {
      chunkSize: 1,
      chunkCharLimit: 450,
      requestDelayMs: 3500,
      rateLimitDelayMs: 65000,
      maxRetryAttempts: 2,
    },
    groq: {
      chunkSize: 1,
      chunkCharLimit: 500,
      requestDelayMs: 1800,
      rateLimitDelayMs: 12000,
      maxRetryAttempts: 1,
    },
    'agent-router': {
      chunkSize: 1,
      chunkCharLimit: 700,
      requestDelayMs: 1200,
      rateLimitDelayMs: 10000,
      maxRetryAttempts: 1,
    },
    openai: {
      chunkSize: 1,
      chunkCharLimit: 700,
      requestDelayMs: 1200,
      rateLimitDelayMs: 12000,
      maxRetryAttempts: 1,
    },
  },

  // Page scanning limits. Large pages can contain thousands of DOM text nodes,
  // so scan first and translate the most useful visible text.
  scanMaxNodes: 220,
  scanMaxChars: 16000,
};
