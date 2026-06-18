import { TranslationItem } from './types.js';
import { CONFIG } from './config.js';

// Global maps to keep references to the DOM nodes and their original text values
const nodeMap = new Map<string, Text>();
const originalTextsMap = new WeakMap<Text, string>();
const originalNodes = new Set<Text>();
let nodeCounter = 0;

interface TextCandidate {
  node: Text;
  text: string;
  index: number;
  inViewport: boolean;
}

interface ExtractTextOptions {
  viewportOnly?: boolean;
}

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE',
  'INPUT', 'TEXTAREA', 'SELECT', 'SVG', 'CANVAS'
]);

/**
 * Checks whether a text node should be skipped for translation.
 */
function shouldSkipNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return true;

  // Walk up ancestors to check if we are nested inside any excluded tags (e.g., <pre>, <code>)
  let ancestor: HTMLElement | null = parent;
  while (ancestor) {
    if (SKIP_TAGS.has(ancestor.tagName)) {
      return true;
    }
    ancestor = ancestor.parentElement;
  }

  if (parent.closest('[hidden], [aria-hidden="true"], [inert]')) {
    return true;
  }

  if (parent.isContentEditable) {
    return true;
  }

  const style = window.getComputedStyle(parent);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    style.pointerEvents === 'none'
  ) {
    return true;
  }

  if (parent.getClientRects().length === 0) {
    return true;
  }

  const value = node.nodeValue;
  if (!value) return true;

  const trimmed = value.trim();
  if (!trimmed) return true;

  // Skip if it contains no letter characters (e.g., only numbers, symbols, whitespace)
  if (!/\p{L}/u.test(trimmed)) return true;

  // Skip typical URLs
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) return true;

  // Skip typical email addresses
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return true;

  // Skip very short fragments that don't have enough meaning (e.g., single symbols)
  if (trimmed.length < 2 && !/[a-zA-Z]/.test(trimmed)) return true;

  // Skip compact code-like tokens that usually do not benefit from translation.
  if (
    trimmed.length <= 24 &&
    !/\s/.test(trimmed) &&
    /[_{}[\]().:=/\\-]/.test(trimmed) &&
    !/[.!?]$/.test(trimmed)
  ) {
    return true;
  }

  return false;
}

function normalizeForDeduplication(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return (
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth
  );
}

function getScannedCandidates(): TextCandidate[] {
  const candidates: TextCandidate[] = [];
  const seenTexts = new Set<string>();
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (shouldSkipNode(node as Text)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let index = 0;
  let currentNode = walker.nextNode();
  while (currentNode) {
    const textNode = currentNode as Text;
    const text = originalTextsMap.get(textNode) || textNode.nodeValue || '';
    const normalized = normalizeForDeduplication(text);

    if (!seenTexts.has(normalized)) {
      seenTexts.add(normalized);
      candidates.push({
        node: textNode,
        text,
        index,
        inViewport: isInViewport(textNode.parentElement as HTMLElement),
      });
    }

    index++;
    currentNode = walker.nextNode();
  }

  return candidates;
}

function selectCandidatesForTranslation(
  candidates: TextCandidate[],
  options: ExtractTextOptions = {}
): TextCandidate[] {
  const selected: TextCandidate[] = [];
  let selectedChars = 0;
  const candidatePool = options.viewportOnly
    ? candidates.filter((candidate) => candidate.inViewport)
    : candidates;

  const orderedCandidates = [...candidatePool].sort((a, b) => {
    if (a.inViewport !== b.inViewport) {
      return a.inViewport ? -1 : 1;
    }
    return a.index - b.index;
  });

  for (const candidate of orderedCandidates) {
    const charCount = candidate.text.trim().length;
    if (selected.length >= CONFIG.scanMaxNodes) break;
    if (selectedChars + charCount > CONFIG.scanMaxChars && selected.length > 0) break;

    selected.push(candidate);
    selectedChars += charCount;
  }

  return selected.sort((a, b) => a.index - b.index);
}

/**
 * Extracts visible text nodes from the DOM, assigns them IDs, and preserves original text.
 */
export function extractTextNodes(options: ExtractTextOptions = {}): TranslationItem[] {
  // Clear map and reset counter for a fresh translation run
  nodeMap.clear();
  nodeCounter = 0;

  const items: TranslationItem[] = [];
  const candidates = selectCandidatesForTranslation(getScannedCandidates(), options);

  for (const candidate of candidates) {
    const textNode = candidate.node;
    const value = candidate.text;

    // Store original text if not already stored
    if (!originalTextsMap.has(textNode)) {
      originalTextsMap.set(textNode, value);
      originalNodes.add(textNode);
    }

    const id = `node-${nodeCounter++}`;
    nodeMap.set(id, textNode);
    items.push({ id, text: value });
  }

  const scanLabel = options.viewportOnly ? 'viewport' : 'page';
  console.log(`[Bdarija] Scanned ${items.length} useful ${scanLabel} text nodes for translation.`);
  return items;
}

/**
 * Replaces the values of the extracted text nodes with their translated text.
 */
export function applyTranslations(translations: TranslationItem[]): number {
  let count = 0;
  for (const item of translations) {
    const node = nodeMap.get(item.id);
    // Ensure the node exists, is still connected to the DOM, and has a value
    if (node && node.isConnected && node.nodeValue !== item.text) {
      node.nodeValue = item.text;
      count++;
    }
  }
  return count;
}

/**
 * Restores all modified text nodes back to their original values.
 */
export function restoreOriginalText(): boolean {
  if (originalNodes.size === 0) return false;

  originalNodes.forEach((node) => {
    if (node.isConnected && originalTextsMap.has(node)) {
      const original = originalTextsMap.get(node);
      if (original !== undefined) {
        node.nodeValue = original;
      }
    }
  });

  nodeMap.clear();
  originalNodes.clear();
  nodeCounter = 0;

  return true;
}
