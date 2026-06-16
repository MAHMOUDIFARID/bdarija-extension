import { z } from 'zod';

export const TranslationItemSchema = z.object({
  id: z.string().min(1, 'Item ID cannot be empty'),
  text: z.string()
});

export const TranslateRequestSchema = z.object({
  items: z.array(TranslationItemSchema).min(1, 'At least one translation item is required'),
  mode: z.enum(['arabizi', 'arabic'])
});

export const AIProviderSchema = z.enum(['gemini', 'groq', 'agent-router']);

export const ProviderTestRequestSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().trim().min(1, 'API key is required'),
  model: z.string().trim().optional()
});

export type TranslationItem = z.infer<typeof TranslationItemSchema>;
export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;
export type TranslationMode = 'arabizi' | 'arabic';
export type AIProvider = z.infer<typeof AIProviderSchema>;
export type ProviderTestRequest = z.infer<typeof ProviderTestRequestSchema>;
