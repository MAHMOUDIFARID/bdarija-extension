// Configuration constants for the Bdarija extension
export const CONFIG = {
  // Local Hono backend URL
  backendUrl: 'http://localhost:8787',

  // Timeout for API requests in milliseconds (e.g. 30 seconds)
  apiTimeoutMs: 90000,

  // Chunking parameters
  chunkSize: 1,           // Translate one visible text node at a time
  chunkCharLimit: 500,    // Maximum cumulative character count per translate API call
  requestDelayMs: 1500,   // Delay between line-by-line provider requests
  rateLimitDelayMs: 8000, // Extra wait before retrying a rate-limited line

  // Page scanning limits. Large pages can contain thousands of DOM text nodes,
  // so scan first and translate the most useful visible text.
  scanMaxNodes: 180,
  scanMaxChars: 12000,
};
