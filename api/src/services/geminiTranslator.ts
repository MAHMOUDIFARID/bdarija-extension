import { TranslationItem, TranslationMode } from '../lib/validation.js';
import { getSystemPrompt, getUserPrompt } from '../lib/prompts.js';
import { AITranslationError, parseJsonObject, validateTranslationsForItems } from './providerUtils.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export async function translateWithGemini(
  items: TranslationItem[],
  mode: TranslationMode,
  apiKey: string,
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
): Promise<TranslationItem[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [
      {
        parts: [{ text: getUserPrompt(items) }]
      }
    ],
    systemInstruction: {
      parts: [{ text: getSystemPrompt(mode) }]
    },
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          translations: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                id: { type: 'STRING' },
                text: { type: 'STRING' }
              },
              required: ['id', 'text']
            }
          }
        },
        required: ['translations']
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      throw new AITranslationError('The selected provider is rate-limited. Try again later or use another provider.', 'rate-limited');
    }
    throw new AITranslationError(`Gemini request failed with status ${status}.`);
  }

  const data = await response.json() as any;
  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new AITranslationError('Gemini returned an empty response.');
  }

  return validateTranslationsForItems(parseJsonObject(textOutput), items);
}

export async function testGeminiConnection(apiKey: string, model?: string): Promise<void> {
  await translateWithGemini(
    [{ id: 'test', text: 'hello' }],
    'arabizi',
    apiKey,
    model || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  );
}
