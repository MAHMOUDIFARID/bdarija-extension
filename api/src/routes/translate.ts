import { Hono } from 'hono';
import { AIProviderSchema, TranslateRequestSchema, TranslationStyleSchema } from '../lib/validation.js';
import { getFriendlyProviderError } from '../services/providerUtils.js';
import { translateItems } from '../services/aiTranslator.js';

export const translateRouter = new Hono();

translateRouter.get('/', (c) => {
  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bdarija Translation Test</title>
    <style>
      body {
        max-width: 760px;
        margin: 48px auto;
        padding: 0 24px;
        font-family: Arial, sans-serif;
        line-height: 1.6;
      }
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <h1>Welcome to the Bdarija translation test page</h1>
    <p>Hello friend. Today is a good day to test the browser extension.</p>
    <p>Please translate this page into Moroccan Darija and restore the original text when you finish.</p>
    <p>The backend API is online at <code>POST /translate</code>.</p>
  </body>
</html>`);
});

translateRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const parseResult = TranslateRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return c.json({
        error: 'Invalid request payload',
        details: parseResult.error.flatten()
      }, 400);
    }

    const { items, mode } = parseResult.data;
    const providerHeader = c.req.header('x-bdarija-provider');
    const providerResult = providerHeader ? AIProviderSchema.safeParse(providerHeader) : undefined;
    const provider = providerResult?.success ? providerResult.data : undefined;
    const model = c.req.header('x-bdarija-model')?.trim() || undefined;
    const styleHeader = c.req.header('x-bdarija-style');
    const styleResult = styleHeader ? TranslationStyleSchema.safeParse(styleHeader) : undefined;
    const style = styleResult?.success ? styleResult.data : undefined;
    const authorization = c.req.header('authorization');
    const apiKey = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;

    const translations = await translateItems(items, mode, {
      provider,
      apiKey,
      model,
      style,
    });

    return c.json({ translations });
  } catch (error) {
    console.error('Error in translate router:', error instanceof Error ? error.message : error);
    return c.json({
      error: getFriendlyProviderError(error)
    }, 500);
  }
});
