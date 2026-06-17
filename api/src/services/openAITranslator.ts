import { TranslationItem, TranslationMode } from '../lib/validation.js';
import { getSystemPrompt, getUserPrompt } from '../lib/prompts.js';
import { AITranslationError, parseJsonObject, validateTranslationsForItems } from './providerUtils.js';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const OPENAI_BASE_URL = normalizeOpenAIBaseUrl(process.env.OPENAI_BASE_URL);
export const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

type OpenAIMessage = {
  role: 'system' | 'user';
  content: string;
};

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function normalizeOpenAIBaseUrl(value?: string): string {
  const baseUrl = value?.trim().replace(/\/$/, '');
  return baseUrl || DEFAULT_OPENAI_BASE_URL;
}

function getOpenAIBaseUrl(): string {
  return OPENAI_BASE_URL;
}

function getOpenAIEndpoint(baseUrl = getOpenAIBaseUrl()): string {
  return `${baseUrl}/chat/completions`;
}

function getSafeProviderMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'No provider message returned.';

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: unknown; code?: unknown; type?: unknown };
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

function logOpenAIFailure(
  model: string,
  baseUrl: string,
  endpoint: string,
  status: number | 'network' | 'timeout' | 'parse',
  message: string
): void {
  if (!isDevelopmentMode()) return;
  console.error('[OpenAI] Request failed', {
    provider: 'openai',
    model,
    baseUrl: getSafeLoggedUrl(baseUrl),
    endpoint: getSafeLoggedUrl(endpoint),
    status,
    message
  });
}

function mapOpenAIStatus(status: number, safeMessage: string): AITranslationError {
  if (/model.*(unsupported|not available|not found|does not exist)|unsupported model|model/i.test(safeMessage)) {
    return new AITranslationError(
      `OpenAI rejected the request: ${safeMessage || 'unsupported model.'}`,
      'unsupported-model'
    );
  }
  if (status === 401 || status === 403) {
    return new AITranslationError('The OpenAI API key appears to be invalid.', 'invalid-key');
  }
  if (status === 404) {
    return new AITranslationError('OpenAI endpoint was not found. Check OPENAI_BASE_URL.', 'invalid-endpoint');
  }
  if (status === 429) {
    return new AITranslationError('OpenAI is rate-limited. Try another model or try again later.', 'rate-limited');
  }
  if (status >= 500) {
    return new AITranslationError('OpenAI service is temporarily unavailable.', 'provider-error');
  }

  return new AITranslationError(
    `OpenAI rejected the request: ${safeMessage || `status ${status}`}`,
    'provider-error'
  );
}

function getMessageContent(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return undefined;

  const text = content
    .map((part) => {
      if (part && typeof part === 'object' && 'text' in part) {
        return String((part as { text?: unknown }).text || '');
      }
      return '';
    })
    .join('');

  return text.trim() ? text : undefined;
}

async function requestOpenAIChat(
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
  timeoutMs: number
): Promise<any> {
  const baseUrl = getOpenAIBaseUrl();
  const endpoint = getOpenAIEndpoint(baseUrl);
  const selectedModel = model.trim() || DEFAULT_OPENAI_MODEL;

  const requestBody = {
    model: selectedModel,
    messages,
    temperature: 0.2,
    response_format: {
      type: 'json_object'
    }
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    if (/timeout|aborted|abort/i.test(message)) {
      logOpenAIFailure(selectedModel, baseUrl, endpoint, 'timeout', 'Provider request timed out.');
      throw new AITranslationError('OpenAI request timed out.', 'provider-timeout');
    }

    logOpenAIFailure(selectedModel, baseUrl, endpoint, 'network', message);
    throw new AITranslationError('Could not reach OpenAI. Check OPENAI_BASE_URL or your internet connection.', 'provider-error');
  }

  const responseText = await response.text();
  if (!response.ok) {
    const safeMessage = getSafeProviderMessage(responseText);
    logOpenAIFailure(selectedModel, baseUrl, endpoint, response.status, safeMessage);
    throw mapOpenAIStatus(response.status, safeMessage);
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    logOpenAIFailure(selectedModel, baseUrl, endpoint, 'parse', (error as Error).message);
    throw new AITranslationError('OpenAI returned an invalid provider response.', 'invalid-response');
  }
}

export async function translateWithOpenAI(
  items: TranslationItem[],
  mode: TranslationMode,
  apiKey: string,
  model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL
): Promise<TranslationItem[]> {
  const selectedModel = model.trim() || DEFAULT_OPENAI_MODEL;
  const data = await requestOpenAIChat(
    apiKey,
    selectedModel,
    [
      { role: 'system', content: getSystemPrompt(mode) },
      { role: 'user', content: getUserPrompt(items) }
    ],
    45000
  );

  const textOutput = getMessageContent(data.choices?.[0]?.message?.content);
  if (!textOutput) {
    logOpenAIFailure(selectedModel, getOpenAIBaseUrl(), getOpenAIEndpoint(), 'parse', 'Missing choices[0].message.content.');
    throw new AITranslationError('OpenAI returned an invalid provider response.', 'invalid-response');
  }

  try {
    return validateTranslationsForItems(parseJsonObject(textOutput), items);
  } catch (error) {
    logOpenAIFailure(selectedModel, getOpenAIBaseUrl(), getOpenAIEndpoint(), 'parse', (error as Error).message);
    throw new AITranslationError('OpenAI returned an invalid provider response.', 'invalid-response');
  }
}

export async function testOpenAIConnection(apiKey: string, model?: string): Promise<void> {
  const selectedModel = model?.trim() || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const data = await requestOpenAIChat(
    apiKey,
    selectedModel,
    [
      { role: 'system', content: 'Return only valid JSON.' },
      { role: 'user', content: 'Return {"ok":true}' }
    ],
    30000
  );

  const textOutput = getMessageContent(data.choices?.[0]?.message?.content);
  if (!textOutput) {
    logOpenAIFailure(selectedModel, getOpenAIBaseUrl(), getOpenAIEndpoint(), 'parse', 'Missing choices[0].message.content.');
    throw new AITranslationError('OpenAI returned an invalid provider response.', 'invalid-response');
  }

  try {
    parseJsonObject(textOutput);
  } catch (error) {
    logOpenAIFailure(selectedModel, getOpenAIBaseUrl(), getOpenAIEndpoint(), 'parse', (error as Error).message);
    throw new AITranslationError('OpenAI returned an invalid provider response.', 'invalid-response');
  }
}
