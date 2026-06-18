import https from 'node:https';
import { TranslationItem, TranslationMode, TranslationStyle } from '../lib/validation.js';
import { getSystemPrompt, getUserPrompt } from '../lib/prompts.js';
import { AITranslationError, parseJsonObject, validateTranslationsForItems } from './providerUtils.js';

const DEFAULT_AGENT_ROUTER_BASE_URL = 'https://agentrouter.org/v1';
const DEPRECATED_AGENT_ROUTER_BASE_URL = 'https://api.agentrouter.com/v1';

export const AGENT_ROUTER_BASE_URL = normalizeAgentRouterBaseUrl(process.env.AGENT_ROUTER_BASE_URL);
export const DEFAULT_AGENT_ROUTER_MODEL = 'gpt-5';

type AgentRouterMessage = {
  role: 'system' | 'user';
  content: string;
};

type AgentRouterHttpResponse = {
  ok: boolean;
  status: number;
  text: string;
};

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function normalizeAgentRouterBaseUrl(value?: string): string {
  const baseUrl = value?.trim().replace(/\/$/, '');
  if (!baseUrl || baseUrl.toLowerCase() === DEPRECATED_AGENT_ROUTER_BASE_URL) {
    return DEFAULT_AGENT_ROUTER_BASE_URL;
  }
  return baseUrl;
}

function getAgentRouterBaseUrl(): string {
  return AGENT_ROUTER_BASE_URL;
}

function getAgentRouterEndpoint(baseUrl = getAgentRouterBaseUrl()): string {
  return `${baseUrl}/chat/completions`;
}

function getSafeProviderMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'No provider message returned.';

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: unknown; code?: unknown };
      message?: unknown;
    };
    const message = parsed.error?.message || parsed.message || trimmed;
    return String(message).replace(/\s+/g, ' ').slice(0, 300);
  } catch {
    return trimmed.replace(/\s+/g, ' ').slice(0, 300);
  }
}

function getSafeLoggedUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return value.split('?')[0].replace(/\/$/, '');
  }
}

function logAgentRouterFailure(
  model: string,
  baseUrl: string,
  endpoint: string,
  status: number | 'timeout' | 'parse',
  message: string
): void {
  if (!isDevelopmentMode()) return;
  console.error('[Agent Router] Request failed', {
    provider: 'agent-router',
    model,
    baseUrl: getSafeLoggedUrl(baseUrl),
    endpoint: getSafeLoggedUrl(endpoint),
    status,
    message
  });
}

function logAgentRouterNetworkFailure(
  model: string,
  baseUrl: string,
  endpoint: string,
  error: unknown
): void {
  if (!isDevelopmentMode()) return;
  console.error('[Agent Router] Network request failed', {
    provider: 'agent-router',
    model,
    baseUrl: getSafeLoggedUrl(baseUrl),
    endpoint: getSafeLoggedUrl(endpoint),
    message: error instanceof Error ? error.message : 'Unknown network error'
  });
}

function mapAgentRouterStatus(status: number, safeMessage: string): AITranslationError {
  if (/model.*(unsupported|not available|not found|does not exist)|unsupported model|model/i.test(safeMessage)) {
    return new AITranslationError(
      `Agent Router rejected the request: ${safeMessage || 'unsupported model.'}`,
      'unsupported-model'
    );
  }
  if (status === 401 || status === 403) {
    if (/unauthorized client detected/i.test(safeMessage)) {
      return new AITranslationError(
        'Agent Router rejected this token. Regenerate a token from the AgentRouter console token page and paste it again.',
        'invalid-key'
      );
    }
    return new AITranslationError('The Agent Router API key appears to be invalid.', 'invalid-key');
  }
  if (status === 404) {
    return new AITranslationError('Agent Router endpoint was not found. Check AGENT_ROUTER_BASE_URL.', 'invalid-endpoint');
  }
  if (status === 429) {
    return new AITranslationError('Agent Router is rate-limited. Try another model or try again later.', 'rate-limited');
  }
  if (status >= 500) {
    return new AITranslationError('Agent Router service is temporarily unavailable.', 'provider-error');
  }

  return new AITranslationError(
    `Agent Router rejected the request: ${safeMessage || `status ${status}`}`,
    'provider-error'
  );
}

function postAgentRouterChat(
  endpoint: string,
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<AgentRouterHttpResponse> {
  return new Promise((resolve, reject) => {
    const bodyText = JSON.stringify(body);
    const url = new URL(endpoint);
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyText)
        },
        timeout: timeoutMs
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          text += chunk;
        });
        response.on('end', () => {
          const status = response.statusCode || 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
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

async function requestAgentRouterChat(
  apiKey: string,
  model: string,
  messages: AgentRouterMessage[],
  timeoutMs: number
): Promise<any> {
  const baseUrl = getAgentRouterBaseUrl();
  const endpoint = getAgentRouterEndpoint(baseUrl);
  const selectedModel = model.trim() || DEFAULT_AGENT_ROUTER_MODEL;

  try {
    const response = await postAgentRouterChat(
      endpoint,
      apiKey,
      {
        model: selectedModel,
        messages,
        temperature: 0.2,
        response_format: {
          type: 'json_object'
        }
      },
      timeoutMs
    );

    if (!response.ok) {
      const status = response.status;
      const safeMessage = getSafeProviderMessage(response.text);
      logAgentRouterFailure(selectedModel, baseUrl, endpoint, status, safeMessage);
      throw mapAgentRouterStatus(status, safeMessage);
    }

    try {
      return JSON.parse(response.text);
    } catch (error) {
      logAgentRouterFailure(selectedModel, baseUrl, endpoint, 'parse', (error as Error).message);
      throw new AITranslationError('Agent Router rejected the request: invalid provider response.', 'invalid-response');
    }
  } catch (error) {
    if (error instanceof AITranslationError) {
      throw error;
    }

    const message = (error as Error).message || '';
    const name = (error as Error).name || '';
    if (/timeout|aborted|abort/i.test(`${name} ${message}`)) {
      logAgentRouterFailure(selectedModel, baseUrl, endpoint, 'timeout', 'Provider request timed out.');
      throw new AITranslationError('Agent Router rejected the request: provider timeout.', 'provider-timeout');
    }

    logAgentRouterNetworkFailure(selectedModel, baseUrl, endpoint, error);
    throw new AITranslationError(
      'Could not reach Agent Router. Confirm AGENT_ROUTER_BASE_URL is https://agentrouter.org/v1 and check your internet connection.',
      'backend-unreachable'
    );
  }
}

export async function translateWithAgentRouter(
  items: TranslationItem[],
  mode: TranslationMode,
  apiKey: string,
  model = process.env.AGENT_ROUTER_MODEL || DEFAULT_AGENT_ROUTER_MODEL,
  style: TranslationStyle = 'casual'
): Promise<TranslationItem[]> {
  const selectedModel = model.trim() || DEFAULT_AGENT_ROUTER_MODEL;
  const data = await requestAgentRouterChat(
    apiKey,
    selectedModel,
    [
      { role: 'system', content: getSystemPrompt(mode, style) },
      { role: 'user', content: getUserPrompt(items) }
    ],
    45000
  );

  const textOutput = data.choices?.[0]?.message?.content;
  if (!textOutput) {
    logAgentRouterFailure(
      selectedModel,
      getAgentRouterBaseUrl(),
      getAgentRouterEndpoint(),
      'parse',
      'Missing choices[0].message.content.'
    );
    throw new AITranslationError('Agent Router rejected the request: invalid provider response.', 'invalid-response');
  }

  try {
    return validateTranslationsForItems(parseJsonObject(textOutput), items);
  } catch (error) {
    logAgentRouterFailure(
      selectedModel,
      getAgentRouterBaseUrl(),
      getAgentRouterEndpoint(),
      'parse',
      (error as Error).message
    );
    throw new AITranslationError('Agent Router rejected the request: invalid provider response.', 'invalid-response');
  }
}

export async function testAgentRouterConnection(
  apiKey: string,
  model?: string
): Promise<void> {
  const selectedModel = model?.trim() || process.env.AGENT_ROUTER_MODEL || DEFAULT_AGENT_ROUTER_MODEL;
  const data = await requestAgentRouterChat(
    apiKey,
    selectedModel,
    [
      { role: 'system', content: 'Return only valid JSON.' },
      { role: 'user', content: 'Return {"ok":true}' }
    ],
    30000
  );

  const textOutput = data.choices?.[0]?.message?.content;
  if (!textOutput) {
    logAgentRouterFailure(
      selectedModel,
      getAgentRouterBaseUrl(),
      getAgentRouterEndpoint(),
      'parse',
      'Missing choices[0].message.content.'
    );
    throw new AITranslationError('Agent Router rejected the request: invalid provider response.', 'invalid-response');
  }

  try {
    parseJsonObject(textOutput);
  } catch (error) {
    logAgentRouterFailure(
      selectedModel,
      getAgentRouterBaseUrl(),
      getAgentRouterEndpoint(),
      'parse',
      (error as Error).message
    );
    throw new AITranslationError('Agent Router rejected the request: invalid provider response.', 'invalid-response');
  }
}
