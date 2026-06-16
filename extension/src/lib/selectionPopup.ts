import { SelectionTranslationPayload } from './types.js';

let savedRange: Range | null = null;
let popupHost: HTMLDivElement | null = null;

function getSelectionRange(): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  return selection.getRangeAt(0).cloneRange();
}

function rememberCurrentSelection(): void {
  const range = getSelectionRange();
  if (range) {
    savedRange = range;
  }
}

function getAnchorRect(): DOMRect {
  const range = savedRange || getSelectionRange();
  const rect = range?.getBoundingClientRect();
  if (rect && (rect.width > 0 || rect.height > 0)) {
    return rect;
  }

  return new DOMRect(window.innerWidth / 2 - 160, 96, 320, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createButton(label: string, variant: 'primary' | 'secondary' = 'secondary'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.border = '1px solid rgba(255,255,255,0.14)';
  button.style.borderRadius = '10px';
  button.style.padding = '8px 10px';
  button.style.fontSize = '12px';
  button.style.fontWeight = '700';
  button.style.cursor = 'pointer';
  button.style.color = variant === 'primary' ? '#06110d' : '#f8fafc';
  button.style.background = variant === 'primary'
    ? 'linear-gradient(135deg, #34d399, #67e8f9)'
    : 'rgba(255,255,255,0.08)';
  return button;
}

function closePopup(): void {
  popupHost?.remove();
  popupHost = null;
}

function replaceSelection(text: string): void {
  const range = savedRange || getSelectionRange();
  if (!range) return;

  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function buildPopup(payload: SelectionTranslationPayload): HTMLDivElement {
  const host = document.createElement('div');
  host.id = 'bdarija-selection-translation';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.width = 'min(360px, calc(100vw - 24px))';
  host.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  host.style.color = '#f8fafc';

  const rect = getAnchorRect();
  const width = Math.min(360, window.innerWidth - 24);
  const top = clamp(rect.bottom + 12, 12, window.innerHeight - 220);
  const left = clamp(rect.left + rect.width / 2 - width / 2, 12, window.innerWidth - width - 12);
  host.style.top = `${top}px`;
  host.style.left = `${left}px`;

  const card = document.createElement('div');
  card.style.background = 'linear-gradient(160deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))';
  card.style.border = '1px solid rgba(148,163,184,0.24)';
  card.style.boxShadow = '0 18px 48px rgba(2,6,23,0.38)';
  card.style.borderRadius = '14px';
  card.style.padding = '14px';
  card.style.backdropFilter = 'blur(16px)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '12px';

  const title = document.createElement('div');
  title.textContent = payload.status === 'loading' ? 'Translating selection' : 'Bdarija selection';
  title.style.fontSize = '13px';
  title.style.fontWeight = '800';
  title.style.letterSpacing = '0';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.style.border = '0';
  closeButton.style.background = 'transparent';
  closeButton.style.color = 'rgba(248,250,252,0.62)';
  closeButton.style.fontSize = '12px';
  closeButton.style.fontWeight = '700';
  closeButton.style.cursor = 'pointer';
  closeButton.addEventListener('click', closePopup);

  header.append(title, closeButton);

  const body = document.createElement('div');
  body.style.marginTop = '10px';
  body.style.fontSize = '13px';
  body.style.lineHeight = '1.55';
  body.style.whiteSpace = 'pre-wrap';
  body.style.overflowWrap = 'anywhere';
  body.style.maxHeight = '180px';
  body.style.overflowY = 'auto';

  if (payload.status === 'loading') {
    body.textContent = 'Please wait while Bdarija translates the selected text.';
    body.style.color = 'rgba(248,250,252,0.72)';
  } else if (payload.status === 'error') {
    body.textContent = payload.errorMessage || 'Selection translation failed.';
    body.style.color = '#fca5a5';
  } else {
    body.textContent = payload.translatedText || '';
    body.style.color = '#f8fafc';
  }

  const meta = document.createElement('div');
  meta.textContent = payload.mode === 'arabizi' ? 'Arabizi mode' : 'Arabic script mode';
  meta.style.marginTop = '10px';
  meta.style.fontSize = '11px';
  meta.style.fontWeight = '700';
  meta.style.color = 'rgba(148,163,184,0.86)';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '12px';

  if (payload.status === 'success' && payload.translatedText) {
    const copyButton = createButton('Copy');
    copyButton.addEventListener('click', async () => {
      await copyText(payload.translatedText || '');
      copyButton.textContent = 'Copied';
    });

    const replaceButton = createButton('Replace', 'primary');
    replaceButton.addEventListener('click', () => {
      replaceSelection(payload.translatedText || '');
      closePopup();
    });

    actions.append(replaceButton, copyButton);
  }

  card.append(header, body, meta);
  if (actions.childElementCount > 0) {
    card.append(actions);
  }
  host.append(card);
  return host;
}

export function installSelectionPopup(): void {
  document.addEventListener('selectionchange', rememberCurrentSelection);
  document.addEventListener('contextmenu', rememberCurrentSelection, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePopup();
    }
  });
}

export function showSelectionTranslation(payload: SelectionTranslationPayload): void {
  rememberCurrentSelection();
  popupHost?.remove();
  popupHost = buildPopup(payload);
  document.documentElement.appendChild(popupHost);
}
