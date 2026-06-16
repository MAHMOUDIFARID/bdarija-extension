import { TranslationItem } from './types.js';

/**
 * Packs TranslationItem objects into sub-arrays (chunks) so that no chunk
 * exceeds the max count or the cumulative character limit.
 */
export function chunkTranslationItems(
  items: TranslationItem[],
  maxCount: number,
  maxChars: number
): TranslationItem[][] {
  const chunks: TranslationItem[][] = [];
  let currentChunk: TranslationItem[] = [];
  let currentChars = 0;

  for (const item of items) {
    const itemLength = item.text.length;

    // If an item is single-handedly larger than the character limit,
    // put it in its own chunk or let it pass so it doesn't block processing.
    const wouldExceedCount = currentChunk.length >= maxCount;
    const wouldExceedChars = currentChars + itemLength > maxChars && currentChunk.length > 0;

    if (wouldExceedCount || wouldExceedChars) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }

    currentChunk.push(item);
    currentChars += itemLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}
