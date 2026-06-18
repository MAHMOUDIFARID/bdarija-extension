import { CONFIG } from './config.js';
import { TranslationItem, TranslationMode, UserAIConfig } from './types.js';

function getProviderModel(config: UserAIConfig): string {
  if (config.model.trim()) return config.model.trim();
  if (config.provider === 'gemini') return 'gemini-2.5-flash';
  if (config.provider === 'agent-router') return 'gpt-5';
  if (config.provider === 'openai') return 'gpt-5.5';
  return 'llama-3.1-8b-instant';
}

function getHeaders(config: UserAIConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-bdarija-provider': config.provider,
    'x-bdarija-model': getProviderModel(config),
    'x-bdarija-style': config.style || 'casual',
    'Authorization': `Bearer ${config.apiKey}`,
  };
}

function getFriendlyApiError(message: string, provider?: UserAIConfig['provider']): string {
  if (/failed to fetch|network|load failed/i.test(message)) {
    return 'Could not connect to the local backend. Make sure npm run dev:api is running.';
  }

  if (provider === 'agent-router') {
    if (/Could not reach Agent Router/i.test(message)) {
      return 'Could not reach Agent Router. Confirm AGENT_ROUTER_BASE_URL is https://agentrouter.org/v1 and check your internet connection.';
    }
    if (/Agent Router rejected this token|unauthorized client detected/i.test(message)) {
      return 'Agent Router rejected this token. Regenerate a token from the AgentRouter console token page and paste it again.';
    }
    if (/invalid API key|api key appears|unauthorized|401|403/i.test(message)) {
      return 'The Agent Router API key appears to be invalid.';
    }
    if (/rate|429/i.test(message)) {
      return 'Agent Router is rate-limited. Try another model or try again later.';
    }
    if (/service is temporarily unavailable|5\d\d/i.test(message)) {
      return 'Agent Router service is temporarily unavailable.';
    }
    if (/endpoint was not found|invalid base URL|unsupported endpoint|404/i.test(message)) {
      return 'Agent Router endpoint was not found. Check AGENT_ROUTER_BASE_URL.';
    }
    if (/unsupported model|not available for your API key|model.*not|model.*unsupported|does not exist/i.test(message)) {
      return 'This Agent Router model is not available for your API key.';
    }
    if (/timeout|aborted|invalid provider response|provider endpoint|AI provider|Agent Router/i.test(message)) {
      return 'Agent Router returned an error. Check the backend terminal for details.';
    }
    return message || 'Agent Router returned an error. Check the backend terminal for details.';
  }

  if (provider === 'openai') {
    if (/Could not reach OpenAI/i.test(message)) {
      return 'Could not reach OpenAI. Check OPENAI_BASE_URL or your internet connection.';
    }
    if (/invalid API key|api key appears|unauthorized|401|403/i.test(message)) {
      return 'The OpenAI API key appears to be invalid.';
    }
    if (/rate|429/i.test(message)) {
      return 'OpenAI is rate-limited. Try another model or try again later.';
    }
    if (/service is temporarily unavailable|5\d\d/i.test(message)) {
      return 'OpenAI service is temporarily unavailable.';
    }
    if (/endpoint was not found|invalid base URL|unsupported endpoint|404/i.test(message)) {
      return 'OpenAI endpoint was not found. Check OPENAI_BASE_URL.';
    }
    if (/unsupported model|not available for your API key|model.*not|model.*unsupported|does not exist/i.test(message)) {
      return 'This OpenAI model is not available for your API key.';
    }
    if (/timeout|aborted|invalid provider response|provider endpoint|AI provider|OpenAI/i.test(message)) {
      return 'OpenAI returned an error. Check the backend terminal for details.';
    }
    return message || 'OpenAI returned an error. Check the backend terminal for details.';
  }

  if (/invalid|unauthorized|401|403/i.test(message)) {
    return 'The API key appears to be invalid.';
  }
  if (/rate|429/i.test(message)) {
    return 'The selected provider is rate-limited. Try again later or use another provider.';
  }
  return message || 'Translation failed. Please try again.';
}

export async function translateItems(
  items: TranslationItem[],
  mode: TranslationMode,
  config: UserAIConfig
): Promise<TranslationItem[]> {
  try {
    const response = await fetch(`${CONFIG.backendUrl}/translate`, {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify({ items, mode }),
      signal: AbortSignal.timeout(CONFIG.apiTimeoutMs),
    });

    const data = await response.json().catch(() => ({})) as {
      translations?: TranslationItem[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || `Translation API failed with status ${response.status}`);
    }

    if (!Array.isArray(data.translations)) {
      throw new Error('API returned an invalid translation payload.');
    }

    return data.translations;
  } catch (error) {
    throw new Error(getFriendlyApiError((error as Error).message, config.provider));
  }
}

export async function testProviderConnection(config: UserAIConfig): Promise<{ ok: boolean; message?: string }> {
  try {
    const response = await fetch(`${CONFIG.backendUrl}/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: config.provider,
        apiKey: config.apiKey,
        model: getProviderModel(config),
      }),
      signal: AbortSignal.timeout(CONFIG.apiTimeoutMs),
    });

    const data = await response.json().catch(() => ({})) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !data.ok) {
      return { ok: false, message: getFriendlyApiError(data.message || 'Provider test failed.', config.provider) };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, message: getFriendlyApiError((error as Error).message, config.provider) };
  }
}
