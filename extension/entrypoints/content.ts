import { extractTextNodes, applyTranslations, restoreOriginalText } from '../src/lib/dom.js';
import {
  installFloatingSelectionToolbar,
  installSelectionPopup,
  showSelectionTranslation
} from '../src/lib/selectionPopup.js';
import { TranslationMode } from '../src/lib/types.js';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],

  main() {
    console.log('[Bdarija] Content script active');
    installSelectionPopup();
    installFloatingSelectionToolbar((mode: TranslationMode, text: string) => {
      chrome.runtime.sendMessage({
        type: 'TRANSLATE_SELECTION',
        payload: { mode, text }
      }).catch(() => {
        showSelectionTranslation({
          status: 'error',
          originalText: text,
          errorMessage: 'Could not start selection translation.',
          mode
        });
      });
    });

    let autoTranslateEnabled = false;
    let viewportTimer: number | undefined;

    const requestViewportTranslation = () => {
      if (!autoTranslateEnabled) return;
      window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'VIEWPORT_CHANGED' }).catch(() => {
          // The background worker may be asleep or unavailable on restricted pages.
        });
      }, 700);
    };

    const setAutoTranslate = (enabled: boolean) => {
      autoTranslateEnabled = enabled;
      window.clearTimeout(viewportTimer);

      if (enabled) {
        window.addEventListener('scroll', requestViewportTranslation, { passive: true });
        window.addEventListener('resize', requestViewportTranslation, { passive: true });
        requestViewportTranslation();
        return;
      }

      window.removeEventListener('scroll', requestViewportTranslation);
      window.removeEventListener('resize', requestViewportTranslation);
    };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, payload } = message;

      if (type === 'EXTRACT_TEXT') {
        try {
          const items = extractTextNodes(payload || {});
          sendResponse({ items });
        } catch (error) {
          console.error('[Bdarija] Extraction failed:', error);
          sendResponse({ error: (error as Error).message });
        }
      } else if (type === 'SET_AUTO_TRANSLATE') {
        try {
          const options = payload as { enabled?: boolean } | undefined;
          setAutoTranslate(Boolean(options?.enabled));
          sendResponse({ success: true });
        } catch (error) {
          console.error('[Bdarija] Setting auto translate failed:', error);
          sendResponse({ error: (error as Error).message });
        }
      } else if (type === 'APPLY_TRANSLATION') {
        try {
          const count = applyTranslations(payload || []);
          sendResponse({ count });
        } catch (error) {
          console.error('[Bdarija] Applying translation failed:', error);
          sendResponse({ error: (error as Error).message });
        }
      } else if (type === 'RESTORE_DOM') {
        try {
          const success = restoreOriginalText();
          sendResponse({ success });
        } catch (error) {
          console.error('[Bdarija] Restoring original text failed:', error);
          sendResponse({ error: (error as Error).message });
        }
      } else if (type === 'SHOW_SELECTION_TRANSLATION') {
        try {
          showSelectionTranslation(payload);
          sendResponse({ success: true });
        } catch (error) {
          console.error('[Bdarija] Showing selection translation failed:', error);
          sendResponse({ error: (error as Error).message });
        }
      }

      return true;
    });
  }
});
