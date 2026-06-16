# Bdarija

Bdarija is a Chrome extension that translates visible webpage text into Moroccan Darija. It uses a local Hono backend and BYOK provider setup, so you can test with your own Gemini, Groq, or Agent Router API key.

## Features

- Chrome Manifest V3 extension built with WXT, React, TypeScript, and Tailwind CSS.
- Local Hono backend for AI translation requests.
- BYOK setup screen for Gemini, Groq, and Agent Router.
- Arabizi and Arabic-script translation modes.
- DOM text extraction that skips scripts, styles, code blocks, form inputs, canvases, and empty nodes.
- Line-by-line translation flow for larger pages.
- Local cache using `chrome.storage.local`, keyed by provider, model, mode, and original text.
- Restore button to put translated pages back to their original text.

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- Google Chrome or another Chromium browser that supports unpacked extensions

## Install

```bash
npm install
```

Optional backend fallback keys can be configured from the example file:

```bash
cp api/.env.example api/.env
```

The extension can also send a user-provided key per request. If no request key and no backend key exist, the backend uses the local mock translator.

## Development

Start the local API:

```bash
npm run dev:api
```

Build the extension:

```bash
npm run build:extension
```

Load the unpacked Chrome extension from:

```text
extension/.output/chrome-mv3
```

Build checks:

```bash
npm run build:api
npm run build:extension
```

## Using Your Own API Key

1. Open the Bdarija popup.
2. Select Gemini, Groq, or Agent Router.
3. Paste your API key.
4. Select a model if needed.
5. Click **Test connection**.
6. Click **Save**.
7. Open a webpage and click **Scan & Translate**.

Your key is stored locally in your browser and is only sent to the local backend for translation requests.

For production use, replace local BYOK storage with an authenticated backend and proper secret management.

## Agent Router

Agent Router uses an OpenAI-compatible chat completions endpoint.

Base URL:

```text
https://agentrouter.org/v1
```

Recommended model:

```text
gpt-5
```

The API key comes from the AgentRouter console token page.

Supported Agent Router models in the extension:

- `gpt-5`
- `gpt-5.5`
- `gpt-5.4`
- `claude-sonnet-4-6`
- `claude-sonnet-4-5`
- `deepseek-v4-pro`
- `deepseek-v4-flash`
- `glm-5.1`
- `claude-opus-4-8`
- `claude-opus-4-7`
- `claude-opus-4-6`

Backend-only Agent Router diagnostics:

```bash
npm run test:agent-router --workspace=api
```

This command reads `AGENT_ROUTER_API_KEY` or `AGENT_ROUTER_TOKEN` from `api/.env`, calls `/chat/completions`, and prints only safe connection details.

## Environment Variables

`api/.env.example` includes:

```env
AGENT_ROUTER_API_KEY=
AGENT_ROUTER_TOKEN=
AGENT_ROUTER_BASE_URL=https://agentrouter.org/v1
GEMINI_API_KEY=
GROQ_API_KEY=
AI_API_KEY=
```

Do not commit real `.env` files or API keys.

## Project Layout

```text
api/
  src/
    lib/
    routes/
    scripts/
    services/
extension/
  entrypoints/
  public/
  src/
    components/
    lib/
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev:api` | Start the local Hono API on port 8787. |
| `npm run dev:extension` | Start WXT development mode. |
| `npm run build:api` | Compile the API TypeScript project. |
| `npm run build:extension` | Build the Chrome MV3 extension. |
| `npm run test:agent-router --workspace=api` | Test Agent Router from the backend only. |

## Security Notes

- API keys are not hardcoded.
- User-provided keys are stored in `chrome.storage.local`.
- The backend uses request keys only for the current request.
- Authorization headers and API keys are not logged.
- `.env` files are ignored by Git.
