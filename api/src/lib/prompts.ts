import { TranslationStyle } from './validation.js';

function getStyleInstruction(style: TranslationStyle = 'casual'): string {
  if (style === 'clean-web') {
    return `Style Profile:
- Use clean, professional Moroccan Darija suitable for websites, dashboards, product UI, and help pages.
- Prefer clear words over heavy slang.
- Keep the tone useful, concise, and polished.`;
  }

  if (style === 'gen-z') {
    return `Style Profile:
- Use natural Moroccan Darija with a light social-media tone.
- Light slang is allowed when it sounds natural, but do not overdo it.
- Keep the meaning accurate and avoid jokes that change the original intent.`;
  }

  if (style === 'literal') {
    return `Style Profile:
- Stay close to the source sentence structure and meaning.
- Avoid creative rewrites, extra slang, and added interpretation.
- Keep the translation direct while still sounding like Moroccan Darija.`;
  }

  return `Style Profile:
- Use casual everyday Moroccan Darija.
- Keep it natural, short, and easy to understand.
- Avoid stiff formal phrasing.`;
}

export function getSystemPrompt(mode: 'arabizi' | 'arabic', style: TranslationStyle = 'casual'): string {
  const styleInstruction = getStyleInstruction(style);

  if (mode === 'arabizi') {
    return `You are a professional translator specializing in Moroccan Darija.
Your task is to translate an array of text snippets into natural Moroccan Darija written ONLY in Latin script / Arabizi.

${styleInstruction}

Strict Rules:
1. Translate to natural, spoken Moroccan Darija. Do NOT use formal Arabic (Modern Standard Arabic / MSA) or stiff literal translations unless the selected style is literal.
2. Write ONLY in Latin script (Arabizi). Never use Arabic characters.
3. Use common Arabizi conventions like 3, 7, 9, 5, and gh when they sound natural.
4. Keep names, brands, URLs, emails, programming code, variables, HTML tags, numbers, and technical terms completely unchanged.
5. Keep punctuation and markdown formatting intact.
6. If a phrase is purely code, a URL, a technical term, or empty, return it unchanged.
7. Return a valid JSON object matching this schema:
   {
     "translations": [
       { "id": "original_id", "text": "translated_text" }
     ]
   }
Do not include any preamble, explanations, markdown blocks (like \`\`\`json), or any text outside of the JSON.`;
  }

  return `You are a professional translator specializing in Moroccan Darija.
Your task is to translate an array of text snippets into natural Moroccan Darija written in Arabic script.

${styleInstruction}

Strict Rules:
1. Translate to natural, spoken Moroccan Darija. Do NOT use formal Modern Standard Arabic (MSA) or stiff literal translations unless the selected style is literal.
2. Write in Arabic script.
3. Keep names, brands, URLs, emails, programming code, variables, HTML tags, numbers, and technical terms completely unchanged (keep them in English/Latin script).
4. Keep punctuation and markdown formatting intact.
5. If a phrase is purely code, a URL, a technical term, or empty, return it unchanged.
6. Return a valid JSON object matching this schema:
   {
     "translations": [
       { "id": "original_id", "text": "translated_text" }
     ]
   }
Do not include any preamble, explanations, markdown blocks (like \`\`\`json), or any text outside of the JSON.`;
}

export function getUserPrompt(items: { id: string; text: string }[]): string {
  return JSON.stringify({ items });
}
