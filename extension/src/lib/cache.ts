import { TranslationMode, UserAIConfig } from './types.js';

/**
 * Computes a SHA-256 hash of a string using Web Crypto API.
 * This ensures storage keys are concise, unique, and safe.
 */
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retrieves a single cached translation.
 */
function getCachePrefix(mode: TranslationMode, config: UserAIConfig): string {
  const model = config.model.trim() || 'default';
  return `tr:${config.provider}:${model}:${mode}`;
}

export async function getCachedTranslation(
  text: string,
  mode: TranslationMode,
  config: UserAIConfig
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const hash = await sha256(trimmed);
  const key = `${getCachePrefix(mode, config)}:${hash}`;
  const result = await chrome.storage.local.get(key);
  return result[key] || null;
}

/**
 * Caches a single translation.
 */
export async function setCachedTranslation(
  text: string,
  mode: TranslationMode,
  translatedText: string,
  config: UserAIConfig
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const hash = await sha256(trimmed);
  const key = `${getCachePrefix(mode, config)}:${hash}`;
  await chrome.storage.local.set({ [key]: translatedText });
}

/**
 * Retrieves a batch of cached translations.
 * Returns a Map mapping the original text to the translated text.
 */
export async function getBatchCachedTranslations(
  texts: string[],
  mode: TranslationMode,
  config: UserAIConfig
): Promise<Map<string, string>> {
  const cacheMap = new Map<string, string>();
  const uniqueTexts = Array.from(new Set(texts.map(t => t.trim()).filter(Boolean)));

  if (uniqueTexts.length === 0) return cacheMap;

  // We need to associate storage keys back to their original text
  const keyToTextMap = new Map<string, string>();
  const keysToGet: string[] = [];

  for (const text of uniqueTexts) {
    const hash = await sha256(text);
    const key = `${getCachePrefix(mode, config)}:${hash}`;
    keyToTextMap.set(key, text);
    keysToGet.push(key);
  }

  const results = await chrome.storage.local.get(keysToGet);
  for (const [key, value] of Object.entries(results)) {
    const originalText = keyToTextMap.get(key);
    if (originalText && typeof value === 'string') {
      cacheMap.set(originalText, value);
    }
  }

  return cacheMap;
}

/**
 * Caches a batch of translations.
 */
export async function setBatchCachedTranslations(
  items: { original: string; translated: string }[],
  mode: TranslationMode,
  config: UserAIConfig
): Promise<void> {
  if (items.length === 0) return;

  const storageObject: Record<string, string> = {};
  for (const item of items) {
    const trimmedOriginal = item.original.trim();
    if (!trimmedOriginal) continue;
    const hash = await sha256(trimmedOriginal);
    const key = `${getCachePrefix(mode, config)}:${hash}`;
    storageObject[key] = item.translated;
  }

  await chrome.storage.local.set(storageObject);
}

/**
 * Clears all cached translations.
 */
export async function clearCache(): Promise<void> {
  const allData = await chrome.storage.local.get();
  const cacheKeys = Object.keys(allData).filter(key => key.startsWith('tr:'));
  if (cacheKeys.length > 0) {
    await chrome.storage.local.remove(cacheKeys);
  }
}
