export type TranslationMode = 'arabizi' | 'arabic';
export type AIProvider = 'gemini' | 'groq' | 'agent-router';

export interface TranslationItem {
  id: string;
  text: string;
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
}

export type MessageType =
  | 'START_TRANSLATION'
  | 'RESTORE_ORIGINAL'
  | 'EXTRACT_TEXT'
  | 'APPLY_TRANSLATION'
  | 'RESTORE_DOM';

export interface ExtensionMessage<T = any> {
  type: MessageType;
  payload?: T;
}
