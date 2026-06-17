import { Hono } from 'hono';
import { ProviderTestRequestSchema } from '../lib/validation.js';
import { testProviderConnection } from '../services/aiTranslator.js';
import { DEFAULT_AGENT_ROUTER_MODEL } from '../services/agentRouterTranslator.js';
import { DEFAULT_GEMINI_MODEL } from '../services/geminiTranslator.js';
import { DEFAULT_GROQ_MODEL } from '../services/groqTranslator.js';
import { DEFAULT_OPENAI_MODEL } from '../services/openAITranslator.js';
import { getFriendlyProviderError } from '../services/providerUtils.js';
import { AIProvider } from '../lib/validation.js';

export const providersRouter = new Hono();

function getDefaultModel(provider: AIProvider): string {
  if (provider === 'gemini') return DEFAULT_GEMINI_MODEL;
  if (provider === 'agent-router') return DEFAULT_AGENT_ROUTER_MODEL;
  if (provider === 'openai') return DEFAULT_OPENAI_MODEL;
  return DEFAULT_GROQ_MODEL;
}

providersRouter.post('/test', async (c) => {
  try {
    const body = await c.req.json();
    const parseResult = ProviderTestRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json({
        ok: false,
        message: 'Provider, API key, and model are required.'
      }, 400);
    }

    const { provider, apiKey, model } = parseResult.data;
    const selectedModel = model || getDefaultModel(provider);
    await testProviderConnection({
      provider,
      apiKey,
      model: selectedModel
    });

    return c.json({
      ok: true,
      provider,
      model: selectedModel
    });
  } catch (error) {
    return c.json({
      ok: false,
      message: getFriendlyProviderError(error)
    }, 200);
  }
});
