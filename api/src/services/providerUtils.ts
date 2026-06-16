import { TranslationItem } from '../lib/validation.js';

export class AITranslationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid-key'
      | 'rate-limited'
      | 'backend-unreachable'
      | 'unsupported-model'
      | 'invalid-endpoint'
      | 'provider-timeout'
      | 'invalid-response'
      | 'provider-error' = 'provider-error'
  ) {
    super(message);
  }
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new AITranslationError('AI response did not contain JSON.');
    return JSON.parse(match[0]);
  }
}

export function validateTranslationsForItems(payload: unknown, items: TranslationItem[]): TranslationItem[] {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { translations?: unknown }).translations)
  ) {
    throw new AITranslationError('AI response did not contain translations.');
  }

  const translations = (payload as { translations: TranslationItem[] }).translations;
  const originalsById = new Map(items.map(item => [item.id, item.text.trim()]));
  const validTranslations = translations.filter(item => (
    item &&
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    originalsById.has(item.id)
  ));
  const translatedIds = new Set(validTranslations.map(item => item.id));

  if (validTranslations.length === 0) {
    throw new AITranslationError('AI response did not contain usable translations.');
  }

  const meaningfulItems = items.filter(item => /\p{L}/u.test(item.text) && item.text.trim().length > 3);
  if (meaningfulItems.length > 0) {
    const allMeaningfulItemsUnchanged = meaningfulItems.every(item => {
      const translated = validTranslations.find(t => t.id === item.id)?.text.trim();
      return translated === originalsById.get(item.id);
    });

    if (allMeaningfulItemsUnchanged) {
      throw new AITranslationError('AI response returned untranslated text.');
    }
  }

  const missingItems = items.filter(item => !translatedIds.has(item.id));
  if (missingItems.length > 0) {
    console.warn(`AI response missed ${missingItems.length}/${items.length} item(s). Keeping missed text unchanged.`);
  }

  return [
    ...validTranslations,
    ...missingItems.map(item => ({ id: item.id, text: item.text }))
  ];
}

export function getFriendlyProviderError(error: unknown): string {
  if (error instanceof AITranslationError) {
    if (
      error.message.startsWith('Agent Router rejected') ||
      error.message.startsWith('Agent Router returned') ||
      error.message.startsWith('Could not reach Agent Router') ||
      error.message.startsWith('The Agent Router API key') ||
      error.message.startsWith('Agent Router endpoint') ||
      error.message.startsWith('Agent Router is rate-limited') ||
      error.message.startsWith('Agent Router service')
    ) {
      return error.message;
    }
    if (error.code === 'invalid-key') return 'The API key appears to be invalid.';
    if (error.code === 'rate-limited') return 'The selected provider is rate-limited. Try again later or use another provider.';
    if (error.code === 'backend-unreachable') return 'Could not connect to the backend.';
    if (error.code === 'unsupported-model') return 'This model is not available for your API key.';
    if (error.code === 'invalid-endpoint') return 'The provider endpoint could not be found.';
    if (error.code === 'provider-timeout') return 'The AI provider request timed out.';
    if (error.code === 'invalid-response') return 'The AI provider returned an invalid response.';
    return error.message;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/unsupported model|not available for your api key|model.*not.*available|model.*not.*found/i.test(message)) {
    return 'This model is not available for your API key.';
  }
  if (/401|403|invalid key|unauthorized/i.test(message)) {
    return 'The API key appears to be invalid.';
  }
  if (/429|rate/i.test(message)) {
    return 'The selected provider is rate-limited. Try again later or use another provider.';
  }
  if (/timeout|aborted/i.test(message)) {
    return 'The AI provider request timed out.';
  }
  if (/fetch failed|network/i.test(message)) {
    return 'Could not connect to the AI provider.';
  }
  return 'Translation failed. Please try again.';
}
