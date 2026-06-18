import { CONFIG } from '../src/lib/config.js';
import {
  getBatchCachedTranslations,
  getCachedTranslation,
  setBatchCachedTranslations,
  setCachedTranslation
} from '../src/lib/cache.js';
import { chunkTranslationItems } from '../src/lib/chunking.js';
import { sendToTab } from '../src/lib/messaging.js';
import {
  ExtensionMessage,
  SelectionTranslationPayload,
  TranslationItem,
  TabState,
  TranslationMode,
  AIProvider
} from '../src/lib/types.js';
import { getUserAIConfig } from '../src/lib/userConfig.js';
import { translateItems as translateItemsWithApi } from '../src/lib/api.js';

const SELECTION_MAX_CHARS = 3000;

export default defineBackground(() => {
  console.log('[Bdarija] Background service worker active');

  const activeTranslations = new Set<number>();
  const autoTranslations = new Map<number, { mode: TranslationMode; translatedCount: number }>();
  const pendingViewportTranslations = new Set<number>();
  const selectionMenuItems = [
    {
      id: 'bdarija-translate-selection-arabizi',
      title: 'Translate selection to Darija Arabizi',
      mode: 'arabizi' as TranslationMode
    },
    {
      id: 'bdarija-translate-selection-arabic',
      title: 'Translate selection to Darija Arabic script',
      mode: 'arabic' as TranslationMode
    }
  ];

  setupContextMenus();

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const item = selectionMenuItems.find((menuItem) => menuItem.id === info.menuItemId);
    if (!item || !tab?.id) return;

    handleSelectionTranslation(tab.id, info.selectionText || '', item.mode).catch((error) => {
      console.error('[Bdarija] Selection translation error:', error);
    });
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message;

    if (type === 'START_TRANSLATION') {
      const mode = payload as TranslationMode;
      handleTranslationStart(mode)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    }

    if (type === 'START_AUTO_TRANSLATION') {
      const mode = payload as TranslationMode;
      handleAutoTranslationStart(mode)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    }

    if (type === 'STOP_AUTO_TRANSLATION') {
      handleAutoTranslationStop()
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    }

    if (type === 'VIEWPORT_CHANGED') {
      const tabId = sender.tab?.id;
      if (tabId && autoTranslations.has(tabId)) {
        handleViewportTranslation(tabId).catch((error) => {
          console.error('[Bdarija] Viewport translation error:', error);
        });
      }
      sendResponse({ success: true });
      return true;
    }

    if (type === 'RESTORE_ORIGINAL') {
      handleRestoreOriginal()
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ error: err.message }));
      return true;
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
      const stateKey = `tab_state:${tabId}`;
      chrome.storage.local.remove(stateKey);
      activeTranslations.delete(tabId);
      autoTranslations.delete(tabId);
      pendingViewportTranslations.delete(tabId);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    const stateKey = `tab_state:${tabId}`;
    chrome.storage.local.remove(stateKey);
    activeTranslations.delete(tabId);
    autoTranslations.delete(tabId);
    pendingViewportTranslations.delete(tabId);
  });

  function setupContextMenus(): void {
    chrome.contextMenus.removeAll(() => {
      for (const item of selectionMenuItems) {
        chrome.contextMenus.create({
          id: item.id,
          title: item.title,
          contexts: ['selection'],
        });
      }
    });
  }

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

  function isRetryableTranslationError(error: unknown): boolean {
    const message = (error as Error).message || '';
    return /rate-limited|rate limit|429|timeout|timed out|aborted|temporarily unavailable|503/i.test(message);
  }

  function getProviderPacing(provider: AIProvider) {
    return CONFIG.providerPacing[provider] || {
      chunkSize: CONFIG.chunkSize,
      chunkCharLimit: CONFIG.chunkCharLimit,
      requestDelayMs: CONFIG.requestDelayMs,
      rateLimitDelayMs: CONFIG.rateLimitDelayMs,
      maxRetryAttempts: CONFIG.maxRetryAttempts,
    };
  }

  function getPartialProgressMessage(provider: AIProvider, failureMessage: string): string {
    if (provider === 'gemini' && /rate-limited|rate limit|429/i.test(failureMessage)) {
      return 'Gemini free limit reached. Cached progress was saved. Wait a bit and run Scan & Translate again to continue.';
    }

    if (/rate-limited|rate limit|429/i.test(failureMessage)) {
      return 'Provider rate limit reached. Cached progress was saved. Try again later to continue.';
    }

    return 'Some text could not be translated. Cached progress was saved. Run Scan & Translate again to continue.';
  }

  async function translateChunkWithRetries(
    chunk: TranslationItem[],
    mode: TranslationMode,
    aiConfig: NonNullable<Awaited<ReturnType<typeof getUserAIConfig>>>
  ): Promise<TranslationItem[]> {
    const pacing = getProviderPacing(aiConfig.provider);
    let lastError: unknown;

    for (let attempt = 0; attempt <= pacing.maxRetryAttempts; attempt++) {
      try {
        return await translateItemsWithApi(chunk, mode, aiConfig);
      } catch (error) {
        lastError = error;
        if (!isRetryableTranslationError(error) || attempt >= pacing.maxRetryAttempts) {
          break;
        }

        const delayMs = isRateLimitError(error)
          ? pacing.rateLimitDelayMs
          : pacing.requestDelayMs * (attempt + 2);

        console.warn(
          `[Bdarija] Provider issue. Waiting ${Math.round(delayMs / 1000)}s before retry ${attempt + 1}/${pacing.maxRetryAttempts}.`
        );
        await sleep(delayMs);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Translation failed. Please try again.');
  }

  async function showSelectionResult(
    tabId: number,
    payload: SelectionTranslationPayload
  ): Promise<void> {
    const response = await sendToContentScript<{ success?: boolean; error?: string }>(tabId, {
      type: 'SHOW_SELECTION_TRANSLATION',
      payload,
    });

    if (response.error) {
      throw new Error(response.error);
    }
  }

  async function handleSelectionTranslation(
    tabId: number,
    selectionText: string,
    mode: TranslationMode
  ): Promise<void> {
    const originalText = selectionText.replace(/\s+/g, ' ').trim();
    if (!originalText) return;

    if (originalText.length > SELECTION_MAX_CHARS) {
      await showSelectionResult(tabId, {
        status: 'error',
        originalText,
        errorMessage: 'Selected text is too long. Select a shorter passage and try again.',
        mode,
      });
      return;
    }

    await showSelectionResult(tabId, {
      status: 'loading',
      originalText,
      mode,
    });

    try {
      const aiConfig = await getUserAIConfig();
      if (!aiConfig) {
        throw new Error('Add an API key before translating.');
      }

      const cached = await getCachedTranslation(originalText, mode, aiConfig);
      if (cached) {
        await showSelectionResult(tabId, {
          status: 'success',
          originalText,
          translatedText: cached,
          mode,
        });
        return;
      }

      const [translation] = await translateItemsWithApi(
        [{ id: 'selection', text: originalText }],
        mode,
        aiConfig
      );
      const translatedText = translation?.text?.trim();
      if (!translatedText) {
        throw new Error('Translation failed. Please try again.');
      }

      if (translatedText !== originalText) {
        await setCachedTranslation(originalText, mode, translatedText, aiConfig);
      }

      await showSelectionResult(tabId, {
        status: 'success',
        originalText,
        translatedText,
        mode,
      });
    } catch (error) {
      await showSelectionResult(tabId, {
        status: 'error',
        originalText,
        errorMessage: (error as Error).message || 'Selection translation failed.',
        mode,
      });
    }
  }

  async function applyTranslatedItems(
    tabId: number,
    stateKey: string,
    mode: TranslationMode,
    translatedItems: TranslationItem[],
    currentCount: number,
    autoTranslate = false
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
    const translatingState: TabState = {
      status: 'translating',
      translatedCount: nextCount,
      mode,
      autoTranslate
    };
    await chrome.storage.local.set({ [stateKey]: translatingState });
    return nextCount;
  }

  async function setContentAutoTranslate(tabId: number, enabled: boolean): Promise<void> {
    await sendToContentScript<{ success?: boolean; error?: string }>(tabId, {
      type: 'SET_AUTO_TRANSLATE',
      payload: { enabled },
    }).catch((error) => {
      if (enabled) throw error;
      console.warn('[Bdarija] Could not disable content auto translate:', (error as Error).message);
      return { success: false };
    });
  }

  async function translateViewportOnce(tabId: number): Promise<void> {
    const session = autoTranslations.get(tabId);
    if (!session) return;

    if (activeTranslations.has(tabId)) {
      pendingViewportTranslations.add(tabId);
      return;
    }

    activeTranslations.add(tabId);
    pendingViewportTranslations.delete(tabId);
    const stateKey = `tab_state:${tabId}`;

    try {
      const aiConfig = await getUserAIConfig();
      if (!aiConfig) {
        throw new Error('Add an API key before translating.');
      }

      const extractResult = await sendToContentScript<{ items?: TranslationItem[]; error?: string }>(
        tabId,
        { type: 'EXTRACT_TEXT', payload: { viewportOnly: true } }
      );

      if (extractResult.error) {
        throw new Error(extractResult.error);
      }

      const items = extractResult.items || [];
      if (items.length === 0) {
        await chrome.storage.local.set({
          [stateKey]: {
            status: 'translating',
            translatedCount: session.translatedCount,
            mode: session.mode,
            autoTranslate: true
          } satisfies TabState
        });
        return;
      }

      const cachedTranslationsMap = await getBatchCachedTranslations(
        items.map((item) => item.text),
        session.mode,
        aiConfig
      );
      const pacing = getProviderPacing(aiConfig.provider);
      const missingItems: TranslationItem[] = [];
      let translatedCount = session.translatedCount;

      for (const item of items) {
        const cached = cachedTranslationsMap.get(item.text.trim());
        if (cached !== undefined) {
          translatedCount = await applyTranslatedItems(
            tabId,
            stateKey,
            session.mode,
            [{ id: item.id, text: cached }],
            translatedCount,
            true
          );
        } else {
          missingItems.push(item);
        }
      }

      const chunks = chunkTranslationItems(missingItems, pacing.chunkSize, pacing.chunkCharLimit);
      for (const chunk of chunks) {
        if (!autoTranslations.has(tabId)) break;

        let translations: TranslationItem[] = [];
        try {
          translations = await translateChunkWithRetries(chunk, session.mode, aiConfig);
        } catch (error) {
          const failureMessage = (error as Error).message || 'Translation failed. Please try again.';
          const errorState: TabState = {
            status: 'translated',
            translatedCount,
            mode: session.mode,
            autoTranslate: true,
            errorMessage: getPartialProgressMessage(aiConfig.provider, failureMessage)
          };
          await chrome.storage.local.set({ [stateKey]: errorState });
          if (isRateLimitError(error)) {
            autoTranslations.set(tabId, { ...session, translatedCount });
            return;
          }
          await sleep(pacing.requestDelayMs);
          continue;
        }

        translatedCount = await applyTranslatedItems(
          tabId,
          stateKey,
          session.mode,
          translations,
          translatedCount,
          true
        );

        const cacheEntries = chunk.flatMap((item) => {
          const matchedResult = translations.find((translation) => translation.id === item.id);
          return matchedResult && matchedResult.text.trim() !== item.text.trim()
            ? [{ original: item.text, translated: matchedResult.text }]
            : [];
        });

        await setBatchCachedTranslations(cacheEntries, session.mode, aiConfig);
        autoTranslations.set(tabId, { ...session, translatedCount });
        await sleep(pacing.requestDelayMs);
      }

      autoTranslations.set(tabId, { ...session, translatedCount });
      await chrome.storage.local.set({
        [stateKey]: {
          status: 'translating',
          translatedCount,
          mode: session.mode,
          autoTranslate: true
        } satisfies TabState
      });
    } catch (error) {
      console.error('[Bdarija] Smart viewport translation error:', error);
      const errorState: TabState = {
        status: 'error',
        errorMessage: (error as Error).message,
        mode: session.mode,
        autoTranslate: false
      };
      await chrome.storage.local.set({ [stateKey]: errorState });
      autoTranslations.delete(tabId);
      await setContentAutoTranslate(tabId, false);
    } finally {
      activeTranslations.delete(tabId);
      if (pendingViewportTranslations.has(tabId) && autoTranslations.has(tabId)) {
        pendingViewportTranslations.delete(tabId);
        setTimeout(() => {
          handleViewportTranslation(tabId).catch((error) => {
            console.error('[Bdarija] Pending viewport translation error:', error);
          });
        }, CONFIG.autoViewportIdleMs);
      }
    }
  }

  async function handleViewportTranslation(tabId: number): Promise<void> {
    await translateViewportOnce(tabId);
  }

  async function handleAutoTranslationStart(mode: TranslationMode): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      throw new Error('No active tab found');
    }

    const aiConfig = await getUserAIConfig();
    if (!aiConfig) {
      throw new Error('Add an API key before translating.');
    }

    const stateKey = `tab_state:${tabId}`;
    autoTranslations.set(tabId, { mode, translatedCount: 0 });
    await chrome.storage.local.set({
      [stateKey]: { status: 'translating', translatedCount: 0, mode, autoTranslate: true } satisfies TabState
    });
    await setContentAutoTranslate(tabId, true);
    await translateViewportOnce(tabId);
  }

  async function handleAutoTranslationStop(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      throw new Error('No active tab found');
    }

    const session = autoTranslations.get(tabId);
    autoTranslations.delete(tabId);
    pendingViewportTranslations.delete(tabId);
    await setContentAutoTranslate(tabId, false);

    const stateKey = `tab_state:${tabId}`;
    await chrome.storage.local.set({
      [stateKey]: {
        status: 'translated',
        translatedCount: session?.translatedCount ?? 0,
        mode: session?.mode,
        autoTranslate: false
      } satisfies TabState
    });
  }

  async function handleTranslationStart(mode: TranslationMode): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      throw new Error('No active tab found');
    }

    autoTranslations.delete(tabId);
    pendingViewportTranslations.delete(tabId);
    await setContentAutoTranslate(tabId, false);

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

      const startState: TabState = { status: 'translating', mode, autoTranslate: false };
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
      const pacing = getProviderPacing(aiConfig.provider);

      const missingItems: TranslationItem[] = [];
      let translatedCount = 0;
      const failedItems: TranslationItem[] = [];
      let firstFailureMessage = '';
      let stoppedForProviderLimit = false;

      for (const item of items) {
        const trimmed = item.text.trim();
        const cached = cachedTranslationsMap.get(trimmed);
        if (cached !== undefined) {
          translatedCount = await applyTranslatedItems(
            tabId,
            stateKey,
            mode,
            [{ id: item.id, text: cached }],
            translatedCount,
            false
          );
        } else {
          missingItems.push(item);
        }
      }

      console.log(
        `[Bdarija] DOM nodes extracted: ${items.length}. Cached: ${translatedCount}. Missing: ${missingItems.length}.`
      );

      if (missingItems.length > 0) {
        const chunks = chunkTranslationItems(missingItems, pacing.chunkSize, pacing.chunkCharLimit);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(`[Bdarija] Processing chunk ${i + 1}/${chunks.length} (size: ${chunk.length})`);

          let translations: TranslationItem[] = [];
          try {
            translations = await translateChunkWithRetries(chunk, mode, aiConfig);
          } catch (error) {
            const failureMessage = (error as Error).message;
            firstFailureMessage ||= failureMessage;
            console.warn('[Bdarija] Skipping text node after translation failed:', failureMessage);
            failedItems.push(...chunk);

            if (isRateLimitError(error)) {
              stoppedForProviderLimit = true;
              failedItems.push(...chunks.slice(i + 1).flat());
              break;
            }

            await sleep(pacing.requestDelayMs);
            continue;
          }

          translatedCount = await applyTranslatedItems(tabId, stateKey, mode, translations, translatedCount, false);

          const cacheEntries = chunk.flatMap((item) => {
            const matchedResult = translations.find((t) => t.id === item.id);
            return matchedResult && matchedResult.text.trim() !== item.text.trim()
              ? [{ original: item.text, translated: matchedResult.text }]
              : [];
          });

          await setBatchCachedTranslations(cacheEntries, mode, aiConfig);
          await sleep(pacing.requestDelayMs);
        }
      }

      if (translatedCount === 0 && failedItems.length > 0) {
        throw new Error(firstFailureMessage || 'Translation failed. Please try again.');
      }

      const finalState: TabState = { status: 'translated', translatedCount, mode, autoTranslate: false };
      if (failedItems.length > 0 && (stoppedForProviderLimit || firstFailureMessage)) {
        finalState.errorMessage = getPartialProgressMessage(aiConfig.provider, firstFailureMessage);
      }
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

  async function handleRestoreOriginal(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;
    if (!tabId) {
      throw new Error('No active tab found');
    }

    const stateKey = `tab_state:${tabId}`;

    try {
      autoTranslations.delete(tabId);
      pendingViewportTranslations.delete(tabId);
      await setContentAutoTranslate(tabId, false);

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
