import { CONFIG } from '../src/lib/config.js';
import { getBatchCachedTranslations, setBatchCachedTranslations } from '../src/lib/cache.js';
import { chunkTranslationItems } from '../src/lib/chunking.js';
import { sendToTab } from '../src/lib/messaging.js';
import { ExtensionMessage, TranslationItem, TabState, TranslationMode } from '../src/lib/types.js';
import { getUserAIConfig } from '../src/lib/userConfig.js';
import { translateItems as translateItemsWithApi } from '../src/lib/api.js';

export default defineBackground(() => {
  console.log('[Bdarija] Background service worker active');

  // Concurrency guard to prevent parallel runs on the same tab
  const activeTranslations = new Set<number>();

  // Handle messages from the Popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    if (type === 'START_TRANSLATION') {
      const mode = payload as TranslationMode;
      handleTranslationStart(mode)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true; // Keep channel open for async response
    }

    else if (type === 'RESTORE_ORIGINAL') {
      handleRestoreOriginal()
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true; // Keep channel open for async response
    }
  });

  // Listen for tab changes/updates to reset states if appropriate
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading') {
      const stateKey = `tab_state:${tabId}`;
      chrome.storage.local.remove(stateKey);
      activeTranslations.delete(tabId);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    const stateKey = `tab_state:${tabId}`;
    chrome.storage.local.remove(stateKey);
    activeTranslations.delete(tabId);
  });

  async function sendToContentScript<R>(
    tabId: number,
    message: ExtensionMessage<unknown>
  ): Promise<R> {
    try {
      return await sendToTab<unknown, R>(tabId, message);
    } catch (error) {
      const messageText = (error as Error).message || '';
      if (!messageText.includes('Receiving end does not exist')) {
        throw error;
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content.js'],
      });

      return sendToTab<unknown, R>(tabId, message);
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isRateLimitError(error: unknown): boolean {
    return /rate-limited|rate limit|429/i.test((error as Error).message || '');
  }

  async function applyTranslatedItems(
    tabId: number,
    stateKey: string,
    mode: TranslationMode,
    translatedItems: TranslationItem[],
    currentCount: number
  ): Promise<number> {
    if (translatedItems.length === 0) return currentCount;

    const applyResult = await sendToContentScript<{ count?: number; error?: string }>(tabId, {
      type: 'APPLY_TRANSLATION',
      payload: translatedItems,
    });

    if (applyResult.error) {
      throw new Error(applyResult.error);
    }

    const nextCount = currentCount + (applyResult.count ?? 0);
    const translatingState: TabState = { status: 'translating', translatedCount: nextCount, mode };
    await chrome.storage.local.set({ [stateKey]: translatingState });
    return nextCount;
  }

  /**
   * Orchestrates the full page translation flow.
   */
  async function handleTranslationStart(mode: TranslationMode): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      throw new Error('No active tab found');
    }

    if (activeTranslations.has(tabId)) {
      console.warn(`[Bdarija] Translation already running on tab ${tabId}`);
      return;
    }

    activeTranslations.add(tabId);
    const stateKey = `tab_state:${tabId}`;

    try {
      const aiConfig = await getUserAIConfig();
      if (!aiConfig) {
        throw new Error('Add an API key before translating.');
      }

      const startState: TabState = { status: 'translating', mode };
      await chrome.storage.local.set({ [stateKey]: startState });

      const extractResult = await sendToContentScript<{ items?: TranslationItem[]; error?: string }>(
        tabId,
        { type: 'EXTRACT_TEXT' }
      );

      if (extractResult.error) {
        throw new Error(extractResult.error);
      }

      const items = extractResult.items || [];
      if (items.length === 0) {
        const successState: TabState = { status: 'translated', translatedCount: 0, mode };
        await chrome.storage.local.set({ [stateKey]: successState });
        return;
      }

      const originalTexts = items.map((i) => i.text);
      const cachedTranslationsMap = await getBatchCachedTranslations(originalTexts, mode, aiConfig);

      const missingItems: TranslationItem[] = [];
      let translatedCount = 0;
      const failedItems: TranslationItem[] = [];
      let firstFailureMessage = '';

      for (const item of items) {
        const trimmed = item.text.trim();
        const cached = cachedTranslationsMap.get(trimmed);
        if (cached !== undefined) {
          translatedCount = await applyTranslatedItems(
            tabId,
            stateKey,
            mode,
            [{ id: item.id, text: cached }],
            translatedCount
          );
        } else {
          missingItems.push(item);
        }
      }

      console.log(
        `[Bdarija] DOM nodes extracted: ${items.length}. Cached: ${translatedCount}. Missing: ${missingItems.length}.`
      );

      if (missingItems.length > 0) {
        const chunks = chunkTranslationItems(missingItems, CONFIG.chunkSize, CONFIG.chunkCharLimit);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`[Bdarija] Processing chunk ${i + 1}/${chunks.length} (size: ${chunk.length})`);

          let translations: TranslationItem[] = [];
          try {
            translations = await translateItemsWithApi(chunk, mode, aiConfig);
          } catch (error) {
            if (isRateLimitError(error)) {
              console.warn('[Bdarija] Rate limited. Waiting before retrying this line.');
              await sleep(CONFIG.rateLimitDelayMs);
              try {
                translations = await translateItemsWithApi(chunk, mode, aiConfig);
              } catch (retryError) {
                const retryMessage = (retryError as Error).message;
                firstFailureMessage ||= retryMessage;
                console.warn('[Bdarija] Skipping one text node after retry failed:', retryMessage);
                failedItems.push(...chunk);
                await sleep(CONFIG.requestDelayMs);
                continue;
              }
            } else {
              const failureMessage = (error as Error).message;
              firstFailureMessage ||= failureMessage;
              console.warn('[Bdarija] Skipping one text node after translation failed:', failureMessage);
              failedItems.push(...chunk);
              await sleep(CONFIG.requestDelayMs);
              continue;
            }
          }

          translatedCount = await applyTranslatedItems(tabId, stateKey, mode, translations, translatedCount);

          const cacheEntries = chunk.flatMap((item) => {
            const matchedResult = translations.find((t) => t.id === item.id);
            return matchedResult && matchedResult.text.trim() !== item.text.trim()
              ? [{ original: item.text, translated: matchedResult.text }]
              : [];
          });

          await setBatchCachedTranslations(cacheEntries, mode, aiConfig);
          await sleep(CONFIG.requestDelayMs);
        }
      }

      if (translatedCount === 0 && failedItems.length > 0) {
        throw new Error(firstFailureMessage || 'Translation failed. Please try again.');
      }

      const finalState: TabState = { status: 'translated', translatedCount, mode };
      await chrome.storage.local.set({ [stateKey]: finalState });

    } catch (error) {
      console.error('[Bdarija] Background translation error:', error);
      let errorMessage = (error as Error).message;
      if (errorMessage.includes('Receiving end does not exist')) {
        errorMessage = 'Please refresh the page. The extension cannot translate pages loaded before installation or restricted system pages (like chrome://).';
      }
      const errorState: TabState = {
        status: 'error',
        errorMessage,
        mode,
      };
      await chrome.storage.local.set({ [stateKey]: errorState });
      throw error;
    } finally {
      activeTranslations.delete(tabId);
    }
  }

  /**
   * Handles requesting the DOM to restore its original state.
   */
  async function handleRestoreOriginal(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      throw new Error('No active tab found');
    }

    const stateKey = `tab_state:${tabId}`;

    try {
      const restoreResult = await sendToContentScript<{ success?: boolean; error?: string }>(tabId, {
        type: 'RESTORE_DOM',
      });

      if (restoreResult.error) {
        throw new Error(restoreResult.error);
      }

      const readyState: TabState = { status: 'ready' };
      await chrome.storage.local.set({ [stateKey]: readyState });
    } catch (error) {
      console.error('[Bdarija] Background restore error:', error);
      let errorMessage = (error as Error).message;
      if (errorMessage.includes('Receiving end does not exist')) {
        errorMessage = 'Please refresh the page. The extension cannot translate pages loaded before installation or restricted system pages (like chrome://).';
      }
      const errorState: TabState = {
        status: 'error',
        errorMessage,
      };
      await chrome.storage.local.set({ [stateKey]: errorState });
      throw error;
    }
  }
});
