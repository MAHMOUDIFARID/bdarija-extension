import dns from 'node:dns';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // DNS preference is best-effort for local diagnostics.
}

const DEFAULT_BASE_URL = 'https://agentrouter.org/v1';
const DEPRECATED_BASE_URL = 'https://api.agentrouter.com/v1';
const MODEL = 'gpt-5';
const apiKey = (process.env.AGENT_ROUTER_API_KEY || process.env.AGENT_ROUTER_TOKEN)?.trim();
const configuredBaseUrl = process.env.AGENT_ROUTER_BASE_URL?.trim().replace(/\/$/, '');
const baseUrl = !configuredBaseUrl || configuredBaseUrl.toLowerCase() === DEPRECATED_BASE_URL
  ? DEFAULT_BASE_URL
  : configuredBaseUrl;
const endpoint = `${baseUrl}/chat/completions`;

function getSafeMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'No response body.';

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: unknown };
      message?: unknown;
      choices?: { message?: { content?: unknown } }[];
    };
    const message = parsed.error?.message || parsed.message || parsed.choices?.[0]?.message?.content || 'OK';
    return String(message).replace(/\s+/g, ' ').slice(0, 300);
  } catch {
    return trimmed.replace(/\s+/g, ' ').slice(0, 300);
  }
}

function printResult(status: string | number, safeMessage: string): void {
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Model: ${MODEL}`);
  console.log(`HTTP status: ${status}`);
  console.log(`Safe message: ${safeMessage}`);
}

function postDiagnosticRequest(body: Record<string, unknown>): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const bodyText = JSON.stringify(body);
    const request = https.request(
      new URL(endpoint),
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyText)
        },
        timeout: 30000
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode || 0,
            text
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('Agent Router request timed out.'));
    });
    request.on('error', reject);
    request.end(bodyText);
  });
}

if (!apiKey) {
  printResult('not sent', 'Missing AGENT_ROUTER_API_KEY or AGENT_ROUTER_TOKEN in api/.env.');
  process.exit(1);
}

try {
  const response = await postDiagnosticRequest({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Return only valid JSON.'
      },
      {
        role: 'user',
        content: 'Return {"ok":true}'
      }
    ],
    temperature: 0.2,
    response_format: {
      type: 'json_object'
    }
  });

  printResult(response.status, getSafeMessage(response.text));
  process.exit(response.status >= 200 && response.status < 300 ? 0 : 1);
} catch (error) {
  printResult('network', error instanceof Error ? error.message : 'Unknown network error');
  process.exit(1);
}
