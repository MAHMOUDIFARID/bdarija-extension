import { TranslationItem, TranslationMode } from '../lib/validation.js';

const mockDictionary: Record<string, string> = {
  "home": "ddar",
  "house": "ddar",
  "welcome": "marhba",
  "hello": "salam",
  "thank you": "shokran",
  "thanks": "shokran",
  "please": "3afak",
  "good morning": "sbah lkhir",
  "good night": "tseb7 3la khir",
  "how are you": "labas / ki dayer",
  "good": "mzyan",
  "yes": "iyeh",
  "no": "lla",
  "beautiful": "zwina",
  "food": "lmakla",
  "water": "lma",
  "love": "lhob",
  "work": "lkhdma",
  "today": "lyoum",
  "tomorrow": "ghdda",
  "yesterday": "lbare7",
  "now": "daba",
  "later": "mn b3d",
  "friend": "sadi9",
  "brother": "khouya",
  "sister": "khti"
};

const mockDictionaryArabic: Record<string, string> = {
  "home": "ddar",
  "house": "ddar",
  "welcome": "marhba",
  "hello": "salam",
  "thank you": "shokran",
  "thanks": "shokran",
  "please": "3afak",
  "good morning": "sbah lkhir",
  "good night": "tseb7 3la khir",
  "how are you": "labas / ki dayer",
  "good": "mzyan",
  "yes": "iyeh",
  "no": "lla",
  "beautiful": "zwina",
  "food": "lmakla",
  "water": "lma",
  "love": "lhob",
  "work": "lkhdma",
  "today": "lyoum",
  "tomorrow": "ghdda",
  "yesterday": "lbare7",
  "now": "daba",
  "later": "mn b3d",
  "friend": "sadi9",
  "brother": "khouya",
  "sister": "khti"
};

function runMockTranslation(text: string, mode: TranslationMode): string {
  if (!text.trim()) return text;

  if (/^(https?:\/\/|www\.|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.test(text.trim())) {
    return text;
  }

  const words = text.split(/(\s+)/);
  const dict = mode === 'arabizi' ? mockDictionary : mockDictionaryArabic;

  const translatedWords = words.map(word => {
    if (/^\s+$/.test(word)) return word;
    const cleanWord = word.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    if (dict[cleanWord]) {
      const translated = dict[cleanWord];
      const hasPunctuation = /[.,/#!$%^&*;:{}=\-_`~()]/.test(word.slice(-1));
      return hasPunctuation ? translated + word.slice(-1) : translated;
    }
    return word;
  });

  const baseText = translatedWords.join('');
  return mode === 'arabizi' ? `[Mock] ${baseText} chwia` : `[Mock] ${baseText}`;
}

export function translateWithMock(
  items: TranslationItem[],
  mode: TranslationMode
): TranslationItem[] {
  return items.map(item => ({
    id: item.id,
    text: runMockTranslation(item.text, mode)
  }));
}
