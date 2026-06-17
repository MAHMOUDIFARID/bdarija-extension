import { UserAIConfig } from './types.js';

const USER_AI_CONFIG_KEY = 'user_ai_config';
const DEFAULT_AGENT_ROUTER_MODEL = 'gpt-5';
const LEGACY_AGENT_ROUTER_DEFAULT_MODEL = 'gpt-5.5';

function isValidUserAIConfig(value: unknown): value is UserAIConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<UserAIConfig>;
  const provider = config.provider as string | undefined;
  return (
    typeof provider === 'string' &&
    ['gemini', 'groq', 'agent-router', 'agentrouter', 'openai'].includes(provider) &&
    typeof config.apiKey === 'string' &&
    config.apiKey.trim().length > 0 &&
    typeof config.model === 'string'
  );
}

export async function getUserAIConfig(): Promise<UserAIConfig | null> {
  const result = await chrome.storage.local.get(USER_AI_CONFIG_KEY);
  const value = result[USER_AI_CONFIG_KEY];
  if (!isValidUserAIConfig(value)) return null;
  const provider = (value.provider as string) === 'agentrouter' ? 'agent-router' : value.provider;
  const model = provider === 'agent-router' && value.model.trim() === LEGACY_AGENT_ROUTER_DEFAULT_MODEL
    ? DEFAULT_AGENT_ROUTER_MODEL
    : value.model.trim();
  const config: UserAIConfig = {
    ...value,
    provider,
    model,
  };

  if (config.provider !== value.provider || config.model !== value.model) {
    await saveUserAIConfig(config);
  }

  return config;
}

export async function saveUserAIConfig(config: UserAIConfig): Promise<void> {
  await chrome.storage.local.set({
    [USER_AI_CONFIG_KEY]: {
      provider: config.provider,
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
    }
  });
}

export async function clearUserAIConfig(): Promise<void> {
  await chrome.storage.local.remove(USER_AI_CONFIG_KEY);
}

export async function hasUserAIConfig(): Promise<boolean> {
  return (await getUserAIConfig()) !== null;
}
