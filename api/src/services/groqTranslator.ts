import { TranslationItem, TranslationMode, TranslationStyle } from '../lib/validation.js';
import { getSystemPrompt, getUserPrompt } from '../lib/prompts.js';
import { AITranslationError, parseJsonObject, validateTranslationsForItems } from './providerUtils.js';

export const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';

function getGroqModels(preferredModel?: string): string[] {
  const configuredFallbacks = process.env.GROQ_FALLBACK_MODELS?.split(',') || [];
  const defaultFallbacks = [
    'llama-3.1-8b-instant',
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-120b'
  ];

  return Array.from(
    new Set(
      [preferredModel, ...configuredFallbacks, ...defaultFallbacks]
        .map(model => model?.trim())
        .filter((model): model is string => Boolean(model))
    )
  );
}

export async function translateWithGroq(
  items: TranslationItem[],
  mode: TranslationMode,
  apiKey: string,
  model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
  style: TranslationStyle = 'casual'
): Promise<TranslationItem[]> {
  let lastError: AITranslationError | null = null;

  for (const candidateModel of getGroqModels(model)) {
    const requestBody = {
      model: candidateModel,
      messages: [
        { role: 'system', content: getSystemPrompt(mode, style) },
        { role: 'user', content: getUserPrompt(items) }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const status = response.status;
      await response.text();
      if (status === 401 || status === 403 || status === 400) {
        throw new AITranslationError('The API key appears to be invalid.', 'invalid-key');
      }
      if (status === 429) {
        lastError = new AITranslationError(
          'The selected provider is rate-limited. Try again later or use another provider.',
          'rate-limited'
        );
        console.log(`Groq model ${candidateModel} is rate-limited. Trying fallback model...`);
        continue;
      }
      lastError = new AITranslationError(`Groq request failed with status ${status}.`);
      console.log(`Groq model ${candidateModel} failed with status ${status}. Trying fallback model...`);
      continue;
    }

    const data = await response.json() as any;
    const textOutput = data.choices?.[0]?.message?.content;
    if (!textOutput) {
      lastError = new AITranslationError(`Groq model ${candidateModel} returned an empty response.`);
      console.log(`Groq model ${candidateModel} returned an empty response. Trying fallback model...`);
      continue;
    }

    return validateTranslationsForItems(parseJsonObject(textOutput), items);
  }

  throw lastError || new AITranslationError('Groq translation failed.');
}

export async function testGroqConnection(apiKey: string, model?: string): Promise<void> {
  await translateWithGroq(
    [{ id: 'test', text: 'hello' }],
    'arabizi',
    apiKey,
    model || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
  );
}
