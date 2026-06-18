import { SelectionTranslationPayload } from './types.js';

let savedRange: Range | null = null;
let popupHost: HTMLDivElement | null = null;
let toolbarHost: HTMLDivElement | null = null;
let toolbarTimer: number | undefined;
let manropeFontInstalled = false;

function installManropeFont(): void {
  if (manropeFontInstalled || document.getElementById('bdarija-manrope-font')) return;

  const link = document.createElement('link');
  link.id = 'bdarija-manrope-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap';
  document.head.appendChild(link);
  manropeFontInstalled = true;
}

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
  button.style.border = variant === 'primary'
    ? '1px solid rgba(20,184,166,0.55)'
    : '1px solid rgba(148,163,184,0.24)';
  button.style.borderRadius = '12px';
  button.style.padding = '9px 14px';
  button.style.fontFamily = 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif';
  button.style.fontSize = '12.5px';
  button.style.fontWeight = '800';
  button.style.cursor = 'pointer';
  button.style.color = variant === 'primary' ? '#06201c' : '#e5e7eb';
  button.style.background = variant === 'primary'
    ? 'linear-gradient(135deg, #5eead4, #2dd4bf)'
    : 'rgba(15,23,42,0.72)';
  button.style.boxShadow = variant === 'primary'
    ? '0 10px 22px rgba(20,184,166,0.22)'
    : 'inset 0 1px 0 rgba(255,255,255,0.06)';
  button.style.transition = 'transform 140ms ease, border-color 140ms ease, background 140ms ease';
  button.style.userSelect = 'none';
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'translateY(-1px)';
    button.style.borderColor = variant === 'primary' ? 'rgba(94,234,212,0.9)' : 'rgba(203,213,225,0.36)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'translateY(0)';
    button.style.borderColor = variant === 'primary' ? 'rgba(20,184,166,0.55)' : 'rgba(148,163,184,0.24)';
  });
  return button;
}

function closePopup(): void {
  popupHost?.remove();
  popupHost = null;
}

function closeToolbar(): void {
  toolbarHost?.remove();
  toolbarHost = null;
  window.clearTimeout(toolbarTimer);
}

function getSelectedText(): string {
  const selection = window.getSelection();
  return selection?.toString().replace(/\s+/g, ' ').trim() || '';
}

function shouldIgnoreSelectionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], #bdarija-selection-translation, #bdarija-selection-toolbar'));
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
  installManropeFont();

  const host = document.createElement('div');
  host.id = 'bdarija-selection-translation';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483647';
  host.style.width = 'min(390px, calc(100vw - 24px))';
  host.style.fontFamily = 'Manrope, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  host.style.color = '#f8fafc';
  host.style.userSelect = 'none';

  const rect = getAnchorRect();
  const width = Math.min(390, window.innerWidth - 24);
  const top = clamp(rect.bottom + 12, 12, window.innerHeight - 240);
  const left = clamp(rect.left + rect.width / 2 - width / 2, 12, window.innerWidth - width - 12);
  host.style.top = `${top}px`;
  host.style.left = `${left}px`;

  const card = document.createElement('div');
  card.style.position = 'relative';
  card.style.overflow = 'hidden';
  card.style.background = 'linear-gradient(160deg, rgba(12,18,32,0.985), rgba(3,7,18,0.985))';
  card.style.border = '1px solid rgba(148,163,184,0.20)';
  card.style.boxShadow = '0 22px 60px rgba(2,6,23,0.46), inset 0 1px 0 rgba(255,255,255,0.06)';
  card.style.borderRadius = '18px';
  card.style.padding = '16px';
  card.style.backdropFilter = 'blur(16px)';

  const accent = document.createElement('div');
  accent.style.position = 'absolute';
  accent.style.inset = '0';
  accent.style.pointerEvents = 'none';
  accent.style.background = 'radial-gradient(circle at 20% 0%, rgba(45,212,191,0.18), transparent 32%), radial-gradient(circle at 100% 30%, rgba(56,189,248,0.12), transparent 28%)';
  card.append(accent);

  const header = document.createElement('div');
  header.style.position = 'relative';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '12px';

  const brand = document.createElement('div');
  brand.style.display = 'flex';
  brand.style.alignItems = 'center';
  brand.style.gap = '9px';

  const mark = document.createElement('div');
  mark.textContent = 'B';
  mark.style.width = '26px';
  mark.style.height = '26px';
  mark.style.display = 'grid';
  mark.style.placeItems = 'center';
  mark.style.borderRadius = '9px';
  mark.style.background = 'linear-gradient(135deg, #5eead4, #38bdf8)';
  mark.style.color = '#04111d';
  mark.style.fontSize = '14px';
  mark.style.fontWeight = '900';
  mark.style.boxShadow = '0 10px 20px rgba(20,184,166,0.20)';

  const titleWrap = document.createElement('div');
  titleWrap.style.display = 'flex';
  titleWrap.style.flexDirection = 'column';
  titleWrap.style.gap = '1px';

  const title = document.createElement('div');
  title.textContent = payload.status === 'loading' ? 'Translating selection' : 'Bdarija selection';
  title.style.fontSize = '13.5px';
  title.style.fontWeight = '900';
  title.style.letterSpacing = '0';
  title.style.color = '#f8fafc';

  const subtitle = document.createElement('div');
  subtitle.textContent = payload.mode === 'arabizi' ? 'Arabizi mode' : 'Arabic script mode';
  subtitle.style.fontSize = '10.5px';
  subtitle.style.fontWeight = '800';
  subtitle.style.color = '#94a3b8';

  titleWrap.append(title, subtitle);
  brand.append(mark, titleWrap);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.style.border = '1px solid rgba(148,163,184,0.18)';
  closeButton.style.borderRadius = '999px';
  closeButton.style.background = 'rgba(15,23,42,0.58)';
  closeButton.style.color = 'rgba(226,232,240,0.72)';
  closeButton.style.padding = '6px 10px';
  closeButton.style.fontFamily = 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif';
  closeButton.style.fontSize = '11.5px';
  closeButton.style.fontWeight = '800';
  closeButton.style.cursor = 'pointer';
  closeButton.style.userSelect = 'none';
  closeButton.addEventListener('click', closePopup);

  header.append(brand, closeButton);

  const body = document.createElement('div');
  body.style.position = 'relative';
  body.style.marginTop = '14px';
  body.style.fontSize = '14px';
  body.style.fontWeight = '650';
  body.style.lineHeight = '1.62';
  body.style.whiteSpace = 'pre-wrap';
  body.style.overflowWrap = 'anywhere';
  body.style.maxHeight = '180px';
  body.style.overflowY = 'auto';
  body.style.padding = '12px';
  body.style.borderRadius = '14px';
  body.style.background = 'rgba(15,23,42,0.42)';
  body.style.border = '1px solid rgba(148,163,184,0.14)';
  body.style.userSelect = 'text';

  if (payload.status === 'loading') {
    body.textContent = 'Translating the selected text...';
    body.style.color = 'rgba(226,232,240,0.72)';
  } else if (payload.status === 'error') {
    body.textContent = payload.errorMessage || 'Selection translation failed.';
    body.style.color = '#fca5a5';
  } else {
    body.textContent = payload.translatedText || '';
    body.style.color = '#f8fafc';
  }

  const meta = document.createElement('div');
  meta.textContent = payload.status === 'success' ? 'Ready to copy or replace' : 'Bdarija uses your saved provider config';
  meta.style.position = 'relative';
  meta.style.marginTop = '10px';
  meta.style.fontSize = '11px';
  meta.style.fontWeight = '800';
  meta.style.color = 'rgba(148,163,184,0.82)';

  const actions = document.createElement('div');
  actions.style.position = 'relative';
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '14px';

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

  requestAnimationFrame(() => {
    card.animate(
      [
        { opacity: 0, transform: 'translateY(6px) scale(0.985)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ],
      {
        duration: 160,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      }
    );
  });

  return host;
}

export function installSelectionPopup(): void {
  document.addEventListener('selectionchange', rememberCurrentSelection);
  document.addEventListener('contextmenu', rememberCurrentSelection, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePopup();
      closeToolbar();
    }
  });
}

export function showSelectionTranslation(payload: SelectionTranslationPayload): void {
  rememberCurrentSelection();
  popupHost?.remove();
  popupHost = buildPopup(payload);
  document.documentElement.appendChild(popupHost);
}

function createToolbarButton(label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.style.border = '1px solid rgba(148,163,184,0.20)';
  button.style.borderRadius = '999px';
  button.style.padding = '7px 10px';
  button.style.background = 'rgba(15,23,42,0.76)';
  button.style.color = '#f8fafc';
  button.style.fontFamily = 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif';
  button.style.fontSize = '11px';
  button.style.fontWeight = '900';
  button.style.lineHeight = '1';
  button.style.cursor = 'pointer';
  button.style.userSelect = 'none';
  button.style.transition = 'background 140ms ease, border-color 140ms ease, transform 140ms ease';
  button.addEventListener('mouseenter', () => {
    button.style.background = 'rgba(20,184,166,0.24)';
    button.style.borderColor = 'rgba(94,234,212,0.48)';
    button.style.transform = 'translateY(-1px)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = 'rgba(15,23,42,0.76)';
    button.style.borderColor = 'rgba(148,163,184,0.20)';
    button.style.transform = 'translateY(0)';
  });
  return button;
}

function positionToolbar(host: HTMLDivElement): void {
  const rect = getAnchorRect();
  const width = host.offsetWidth || 210;
  const height = host.offsetHeight || 44;
  const top = clamp(rect.top - height - 10, 10, window.innerHeight - height - 10);
  const left = clamp(rect.left + rect.width / 2 - width / 2, 10, window.innerWidth - width - 10);

  host.style.top = `${top}px`;
  host.style.left = `${left}px`;
}

function buildSelectionToolbar(onTranslate: (mode: 'arabizi' | 'arabic', text: string) => void): HTMLDivElement {
  installManropeFont();

  const host = document.createElement('div');
  host.id = 'bdarija-selection-toolbar';
  host.style.position = 'fixed';
  host.style.zIndex = '2147483646';
  host.style.display = 'flex';
  host.style.alignItems = 'center';
  host.style.gap = '6px';
  host.style.padding = '7px';
  host.style.borderRadius = '999px';
  host.style.background = 'linear-gradient(160deg, rgba(12,18,32,0.96), rgba(3,7,18,0.96))';
  host.style.border = '1px solid rgba(148,163,184,0.22)';
  host.style.boxShadow = '0 18px 44px rgba(2,6,23,0.42), inset 0 1px 0 rgba(255,255,255,0.06)';
  host.style.backdropFilter = 'blur(14px)';
  host.style.fontFamily = 'Manrope, Inter, ui-sans-serif, system-ui, sans-serif';
  host.style.userSelect = 'none';

  const label = document.createElement('div');
  label.textContent = 'Bdarija';
  label.style.padding = '0 6px 0 8px';
  label.style.color = 'rgba(226,232,240,0.78)';
  label.style.fontSize = '11px';
  label.style.fontWeight = '900';

  const arabiziButton = createToolbarButton('Arabizi', 'Translate selection to Darija Arabizi');
  arabiziButton.addEventListener('mousedown', (event) => event.preventDefault());
  arabiziButton.addEventListener('click', () => {
    const text = getSelectedText();
    if (!text) return;
    rememberCurrentSelection();
    closeToolbar();
    onTranslate('arabizi', text);
  });

  const arabicButton = createToolbarButton('Arabic', 'Translate selection to Darija Arabic script');
  arabicButton.addEventListener('mousedown', (event) => event.preventDefault());
  arabicButton.addEventListener('click', () => {
    const text = getSelectedText();
    if (!text) return;
    rememberCurrentSelection();
    closeToolbar();
    onTranslate('arabic', text);
  });

  const closeButton = createToolbarButton('x', 'Close toolbar');
  closeButton.style.width = '28px';
  closeButton.style.padding = '7px 0';
  closeButton.addEventListener('mousedown', (event) => event.preventDefault());
  closeButton.addEventListener('click', closeToolbar);

  host.append(label, arabiziButton, arabicButton, closeButton);
  requestAnimationFrame(() => {
    positionToolbar(host);
    host.animate(
      [
        { opacity: 0, transform: 'translateY(4px) scale(0.98)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ],
      { duration: 120, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
    );
  });

  return host;
}

export function installFloatingSelectionToolbar(
  onTranslate: (mode: 'arabizi' | 'arabic', text: string) => void
): void {
  document.addEventListener('selectionchange', () => {
    window.clearTimeout(toolbarTimer);
    toolbarTimer = window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        closeToolbar();
        return;
      }

      const anchorNode = selection.anchorNode;
      const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
      if (shouldIgnoreSelectionTarget(anchorElement || null)) {
        closeToolbar();
        return;
      }

      rememberCurrentSelection();
      toolbarHost?.remove();
      toolbarHost = buildSelectionToolbar(onTranslate);
      document.documentElement.appendChild(toolbarHost);
    }, 180);
  });

  document.addEventListener('mousedown', (event) => {
    if (shouldIgnoreSelectionTarget(event.target)) return;
    closeToolbar();
  }, true);

  window.addEventListener('scroll', closeToolbar, { passive: true });
  window.addEventListener('resize', closeToolbar, { passive: true });
}
