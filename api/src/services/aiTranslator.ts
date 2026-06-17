import { AIProvider, TranslationItem, TranslationMode } from '../lib/validation.js';
import { DEFAULT_GEMINI_MODEL, testGeminiConnection, translateWithGemini } from './geminiTranslator.js';
import { DEFAULT_GROQ_MODEL, testGroqConnection, translateWithGroq } from './groqTranslator.js';
import { DEFAULT_AGENT_ROUTER_MODEL, testAgentRouterConnection, translateWithAgentRouter } from './agentRouterTranslator.js';
import { DEFAULT_OPENAI_MODEL, testOpenAIConnection, translateWithOpenAI } from './openAITranslator.js';
import { translateWithMock } from './mockTranslator.js';

export interface TranslationProviderConfig {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
}

function getEnvironmentProvider(): AIProvider | undefined {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'gemini' || provider === 'groq' || provider === 'agent-router' || provider === 'openai') return provider;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.AGENT_ROUTER_API_KEY || process.env.AGENT_ROUTER_TOKEN) return 'agent-router';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.AI_API_KEY) return 'gemini';
  return undefined;
}

function getEnvironmentKey(provider: AIProvider): string | undefined {
  if (provider === 'gemini') {
    return process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  }
  if (provider === 'agent-router') {
    return process.env.AGENT_ROUTER_API_KEY || process.env.AGENT_ROUTER_TOKEN || process.env.AI_API_KEY;
  }
  if (provider === 'openai') {
    return process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  }
  return process.env.GROQ_API_KEY || process.env.AI_API_KEY;
}

function getEnvironmentModel(provider: AIProvider): string {
  if (provider === 'gemini') {
    return process.env.GEMINI_MODEL || process.env.AI_MODEL || DEFAULT_GEMINI_MODEL;
  }
  if (provider === 'agent-router') {
    return process.env.AGENT_ROUTER_MODEL || process.env.AI_MODEL || DEFAULT_AGENT_ROUTER_MODEL;
  }
  if (provider === 'openai') {
    return process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_OPENAI_MODEL;
  }
  return process.env.GROQ_MODEL || process.env.AI_MODEL || DEFAULT_GROQ_MODEL;
}

export async function translateItems(
  items: TranslationItem[],
  mode: TranslationMode,
  config: TranslationProviderConfig = {}
): Promise<TranslationItem[]> {
  const provider = config.provider || getEnvironmentProvider();

  if (!provider) {
    return translateWithMock(items, mode);
  }

  const apiKey = config.apiKey || getEnvironmentKey(provider);
  if (!apiKey) {
    return translateWithMock(items, mode);
  }

  const model = config.model || getEnvironmentModel(provider);
  if (provider === 'gemini') {
    return translateWithGemini(items, mode, apiKey, model);
  }

  if (provider === 'agent-router') {
    return translateWithAgentRouter(items, mode, apiKey, model);
  }

  if (provider === 'openai') {
    return translateWithOpenAI(items, mode, apiKey, model);
  }

  return translateWithGroq(items, mode, apiKey, model);
}

export async function testProviderConnection(config: Required<TranslationProviderConfig>): Promise<void> {
  if (config.provider === 'gemini') {
    await testGeminiConnection(config.apiKey, config.model);
    return;
  }

  if (config.provider === 'agent-router') {
    await testAgentRouterConnection(config.apiKey, config.model);
    return;
  }

  if (config.provider === 'openai') {
    await testOpenAIConnection(config.apiKey, config.model);
    return;
  }

  await testGroqConnection(config.apiKey, config.model);
}
