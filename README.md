<p align="center">
  <img src="extension/public/logo.png" width="96" alt="Bdarija logo" />
</p>

<h1 align="center">Bdarija</h1>

<p align="center">
  <a href="https://git.io/typing-svg">
    <img
      src="https://readme-typing-svg.demolab.com?font=Inter&weight=600&size=22&duration=2600&pause=900&color=38BDF8&center=true&vCenter=true&width=760&lines=Translate+webpages+into+Moroccan+Darija;BYOK+support+for+Gemini%2C+Groq%2C+Agent+Router%2C+and+OpenAI;Chrome+MV3+extension+with+a+local+Hono+API"
      alt="Animated Bdarija project tagline"
    />
  </a>
</p>

<p align="center">
  <a href="https://github.com/MAHMOUDIFARID/bdarija-extension">
    <img alt="GitHub repo" src="https://img.shields.io/badge/github-bdarija--extension-111827?style=for-the-badge&logo=github" />
  </a>
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Chrome MV3" src="https://img.shields.io/badge/chrome-MV3-34A853?style=for-the-badge&logo=googlechrome&logoColor=white" />
  <img alt="BYOK" src="https://img.shields.io/badge/BYOK-enabled-0F766E?style=for-the-badge" />
</p>

<p align="center">
  A Chrome extension that scans visible webpage text and translates it into Moroccan Darija using your own AI provider key.
</p>

---

## Why Bdarija

Bdarija is built for quick personal translation experiments without committing secrets to a backend. The extension stores your provider config locally in Chrome, sends translation requests to a local Hono API, and lets you restore the original page text at any time.

## Highlights

| Area | Details |
|---|---|
| Extension | WXT, React, TypeScript, Tailwind CSS, Chrome Manifest V3 |
| Backend | Hono, Node.js, Zod validation |
| Providers | Gemini, Groq, Agent Router, OpenAI |
| Modes | Arabizi and Arabic-script output |
| Privacy | BYOK config stored locally in `chrome.storage.local` |
| Cache | Provider, model, mode, and source text are included in cache keys |
| Recovery | Restore original page text after translation |
| Selection tools | Right-click selected text to translate, copy, or replace |
| Smart Auto | Translate newly visible text while scrolling |

## How It Works

```mermaid
flowchart LR
  Popup["Extension popup"] --> Background["Background worker"]
  Background --> Content["Content script"]
  Content --> Extract["Visible DOM text extraction"]
  Extract --> Cache["Local translation cache"]
  Cache --> API["Local Hono API"]
  API --> Provider["Gemini / Groq / Agent Router / OpenAI"]
  Provider --> API
  API --> Background
  Background --> Apply["Apply translated text"]
  Apply --> Page["Current webpage"]
```

## Quick Start

Install dependencies:

```bash
npm install
```

Start the local API:

```bash
npm run dev:api
```

Build the extension:

```bash
npm run build:extension
```

Load this folder as an unpacked Chrome extension:

```text
extension/.output/chrome-mv3
```

## BYOK Setup

1. Open the Bdarija popup.
2. Select `Gemini`, `Groq`, `Agent Router`, or `ChatGPT / OpenAI`.
3. Paste your API key.
4. Select a model.
5. Click **Test connection**.
6. Click **Save**.
7. Open a webpage and click **Scan & Translate**.

Your key is stored locally in the browser and is only sent to the local backend for translation requests.

## Selected Text Translation

You can translate a specific sentence or paragraph without scanning the whole page.

1. Select text on any webpage.
2. Right-click the selection.
3. Choose **Translate selection to Darija Arabizi** or **Translate selection to Darija Arabic script**.
4. Use the floating result panel to copy the translation, replace the selected text, or close the panel.

Selected text translation uses the same provider config and cache as full-page translation.

## Smart Viewport Auto Translate

Use **Smart Auto Translate** when a page is large. Bdarija translates the current viewport first, then watches scroll and resize events to translate newly visible text. Cached translations are reused, so repeated text is not sent back to the provider.

Click **Stop Smart Auto** to pause the watcher. Restore original text still works for text translated by full-page scan, selected text replacement, and smart viewport mode.

## Agent Router

Agent Router uses an OpenAI-compatible chat completions API.

| Setting | Value |
|---|---|
| Base URL | `https://agentrouter.org/v1` |
| Endpoint | `/chat/completions` |
| Recommended model | `gpt-5` |
| Token source | AgentRouter console token page |

Supported Agent Router model IDs:

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

Backend-only Agent Router diagnostic:

```bash
npm run test:agent-router --workspace=api
```

The diagnostic reads `AGENT_ROUTER_API_KEY` or `AGENT_ROUTER_TOKEN` from `api/.env` and prints only safe connection details.

## ChatGPT / OpenAI

OpenAI uses the official chat completions API.

| Setting | Value |
|---|---|
| Base URL | `https://api.openai.com/v1` |
| Endpoint | `/chat/completions` |
| Default model | `gpt-5.5` |
| Key source | OpenAI API dashboard |

Suggested OpenAI model IDs:

- `gpt-5.5`
- `gpt-5`
- `gpt-4.1-mini`
- `gpt-4.1`
- `gpt-4o-mini`
- `gpt-4o`

## Environment

Create a backend `.env` only if you want fallback keys for local testing:

```bash
cp api/.env.example api/.env
```

Example:

```env
AGENT_ROUTER_API_KEY=
AGENT_ROUTER_TOKEN=
AGENT_ROUTER_BASE_URL=https://agentrouter.org/v1
AGENT_ROUTER_MODEL=gpt-5
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5.5
GEMINI_API_KEY=
GROQ_API_KEY=
AI_API_KEY=
```

Never commit real `.env` files or API keys.

## Scripts

| Command | Description |
|---|---|
| `npm run dev:api` | Start the local API on `http://localhost:8787`. |
| `npm run dev:extension` | Start WXT development mode. |
| `npm run build:api` | Compile the API TypeScript project. |
| `npm run build:extension` | Build the Chrome MV3 extension. |
| `npm run test:agent-router --workspace=api` | Test Agent Router from the backend. |

## Project Structure

```text
.
+-- api
|   `-- src
|       +-- lib
|       +-- routes
|       +-- scripts
|       `-- services
`-- extension
    +-- entrypoints
    +-- public
    `-- src
        +-- components
        `-- lib
```

## Security Notes

- No API keys are hardcoded.
- `.env` files are ignored by Git.
- The backend never stores user-provided keys.
- Authorization headers are not logged.
- The current BYOK storage model is intended for local and personal testing.
- Production deployments should use authenticated backend sessions and proper secret management.

## License

MIT
