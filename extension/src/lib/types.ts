export type TranslationMode = 'arabizi' | 'arabic';
export type AIProvider = 'gemini' | 'groq' | 'agent-router' | 'openai';

export interface TranslationItem {
  id: string;
  text: string;
}

export type SelectionTranslationStatus = 'loading' | 'success' | 'error';

export interface SelectionTranslationPayload {
  status: SelectionTranslationStatus;
  originalText: string;
  translatedText?: string;
  errorMessage?: string;
  mode: TranslationMode;
}

export type TranslationStatus =
  | 'setup-required'
  | 'ready'
  | 'translating'
  | 'translated'
  | 'error'
  | 'testing-provider'
  | 'provider-test-success'
  | 'provider-test-error';

export interface UserAIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export interface TabState {
  status: TranslationStatus;
  translatedCount?: number;
  errorMessage?: string;
  mode?: TranslationMode;
  autoTranslate?: boolean;
}

export type MessageType =
  | 'START_TRANSLATION'
  | 'START_AUTO_TRANSLATION'
  | 'STOP_AUTO_TRANSLATION'
  | 'VIEWPORT_CHANGED'
  | 'SET_AUTO_TRANSLATE'
  | 'RESTORE_ORIGINAL'
  | 'EXTRACT_TEXT'
  | 'APPLY_TRANSLATION'
  | 'RESTORE_DOM'
  | 'SHOW_SELECTION_TRANSLATION';

export interface ExtensionMessage<T = any> {
  type: MessageType;
  payload?: T;
}
