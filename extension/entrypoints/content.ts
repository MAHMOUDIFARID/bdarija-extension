import { extractTextNodes, applyTranslations, restoreOriginalText } from '../src/lib/dom.js';
import { installSelectionPopup, showSelectionTranslation } from '../src/lib/selectionPopup.js';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],

  main() {
    console.log('[Bdarija] Content script active');
    installSelectionPopup();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, payload } = message;

      if (type === 'EXTRACT_TEXT') {
        try {
          const items = extractTextNodes();
          sendResponse({ items });
        } catch (error) {
          console.error('[Bdarija] Extraction failed:', error);
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
