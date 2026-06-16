import React, { useEffect, useState } from 'react';
import { StatusCard } from '../../src/components/StatusCard.js';
import { Button } from '../../src/components/Button.js';
import { AIProvider, TabState, TranslationMode, UserAIConfig } from '../../src/lib/types.js';
import { clearUserAIConfig, getUserAIConfig, saveUserAIConfig } from '../../src/lib/userConfig.js';
import { testProviderConnection } from '../../src/lib/api.js';

type PopupView = 'setup' | 'main' | 'settings';

const defaultModels: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.1-8b-instant',
  'agent-router': 'gpt-5',
};

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  gemini: [
    'gemini-2.5-flash'
  ],
  groq: [
    'llama-3.1-8b-instant'
  ],
  'agent-router': [
    'gpt-5',
    'gpt-5.5',
    'gpt-5.4',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'deepseek-v4-pro',
    'deepseek-v4-flash',
    'glm-5.1',
    'claude-opus-4-8',
    'claude-opus-4-7',
    'claude-opus-4-6'
  ]
};

function createDefaultConfig(): UserAIConfig {
  return {
    provider: 'gemini',
    apiKey: '',
    model: defaultModels.gemini,
  };
}

export default function App() {
  const [tabId, setTabId] = useState<number | null>(null);
  const [tabState, setTabState] = useState<TabState>({ status: 'setup-required' });
  const [mode, setMode] = useState<TranslationMode>('arabizi');
  const [view, setView] = useState<PopupView>('setup');
  const [aiConfig, setAiConfig] = useState<UserAIConfig | null>(null);
  const [draftConfig, setDraftConfig] = useState<UserAIConfig>(createDefaultConfig());
  const [testMessage, setTestMessage] = useState<string>('');
  const [isTestingProvider, setIsTestingProvider] = useState(false);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        setTabId(tabs[0].id);
      }
    });

    getUserAIConfig().then((config) => {
      if (config) {
        setAiConfig(config);
        setDraftConfig(config);
        setView('main');
        setTabState({ status: 'ready' });
      } else {
        setView('setup');
        setTabState({ status: 'setup-required' });
      }
    });
  }, []);

  useEffect(() => {
    if (tabId === null) return;
    const stateKey = `tab_state:${tabId}`;

    chrome.storage.local.get(stateKey, (result) => {
      if (result[stateKey]) {
        setTabState(result[stateKey]);
        if (result[stateKey].mode) {
          setMode(result[stateKey].mode);
        }
      }
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[stateKey]) {
        const newState = (changes[stateKey].newValue as TabState) || { status: 'ready' };
        setTabState(newState);
        if (newState.mode) {
          setMode(newState.mode);
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [tabId]);

  const updateDraftProvider = (provider: AIProvider) => {
    setDraftConfig({
      ...draftConfig,
      provider,
      model: defaultModels[provider],
    });
    setTestMessage('');
  };

  const handleTestConnection = async () => {
    const config = {
      ...draftConfig,
      apiKey: draftConfig.apiKey.trim(),
      model: draftConfig.model.trim() || defaultModels[draftConfig.provider],
    };

    if (!config.apiKey) {
      setTestMessage('Enter an API key first.');
      setTabState({ status: 'provider-test-error', errorMessage: 'Enter an API key first.' });
      return;
    }

    setIsTestingProvider(true);
    setTestMessage('Testing provider connection...');
    setTabState({ status: 'testing-provider' });
    const result = await testProviderConnection(config);
    setIsTestingProvider(false);

    if (result.ok) {
      setTestMessage('Connection successful.');
      setTabState({ status: 'provider-test-success' });
    } else {
      const message = result.message || 'Provider test failed.';
      setTestMessage(message);
      setTabState({ status: 'provider-test-error', errorMessage: message });
    }
  };

  const handleSaveConfig = async () => {
    const config = {
      ...draftConfig,
      apiKey: draftConfig.apiKey.trim(),
      model: draftConfig.model.trim() || defaultModels[draftConfig.provider],
    };

    if (!config.apiKey) {
      setTestMessage('Enter an API key first.');
      return;
    }

    await saveUserAIConfig(config);
    setAiConfig(config);
    setDraftConfig(config);
    setView('main');
    setTabState({ status: 'ready' });
    setTestMessage('');
  };

  const handleClearConfig = async () => {
    await clearUserAIConfig();
    const emptyConfig = createDefaultConfig();
    setAiConfig(null);
    setDraftConfig(emptyConfig);
    setView('setup');
    setTabState({ status: 'setup-required' });
    setTestMessage('');
  };

  const handleTranslate = async () => {
    if (tabId === null) return;
    if (!aiConfig) {
      setView('setup');
      setTabState({ status: 'setup-required', errorMessage: 'Add an API key before translating.' });
      return;
    }

    const stateKey = `tab_state:${tabId}`;
    await chrome.storage.local.set({
      [stateKey]: { status: 'translating', mode }
    });

    chrome.runtime.sendMessage({ type: 'START_TRANSLATION', payload: mode }, (response) => {
      if (chrome.runtime.lastError) {
        setTabState({
          status: 'error',
          errorMessage: 'Could not connect to the local backend. Make sure npm run dev:api is running.'
        });
        return;
      }
      if (response?.error) {
        setTabState({ status: 'error', errorMessage: response.error, mode });
      }
    });
  };

  const handleRestore = () => {
    if (tabId === null) return;

    chrome.runtime.sendMessage({ type: 'RESTORE_ORIGINAL' }, (response) => {
      if (chrome.runtime.lastError) {
        setTabState({ status: 'error', errorMessage: 'Could not restore the page.' });
        return;
      }
      if (response?.error) {
        setTabState({ status: 'error', errorMessage: response.error });
      }
    });
  };

  const renderConfigForm = (isSettings: boolean) => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center text-center gap-2">
        <div className="w-12 h-12 flex items-center justify-center shrink-0 mb-1 select-none">
          <img src="/logo.png" alt="Bdarija Logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-[25px] font-extrabold tracking-tight text-white leading-[1.2] px-1">
          Bdarija
        </h1>
        <p className="text-[11px] text-white/55 leading-relaxed px-2">
          Add your AI API key to start translating webpages into Moroccan Darija.
        </p>
      </div>

      <div className="flex flex-col gap-3.5 p-5 bg-[#0b0e14]/40 border border-white/10 rounded-[24px] backdrop-blur-xl shadow-xl shadow-black/10">
        <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-white/70">
          Provider
          <select
            value={draftConfig.provider}
            onChange={(event) => updateDraftProvider(event.target.value as AIProvider)}
            className="w-full rounded-xl bg-black/30 border border-white/10 text-white px-3 py-2.5 outline-none"
          >
            <option value="gemini">Gemini</option>
            <option value="groq">Groq</option>
            <option value="agent-router">Agent Router</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-white/70">
          API key
          <input
            type="password"
            value={draftConfig.apiKey}
            onChange={(event) => setDraftConfig({ ...draftConfig, apiKey: event.target.value })}
            className="w-full rounded-xl bg-black/30 border border-white/10 text-white px-3 py-2.5 outline-none"
            placeholder="Paste your API key"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-white/70">
          Model
          <input
            list={`models-${draftConfig.provider}`}
            type="text"
            value={draftConfig.model}
            onChange={(event) => setDraftConfig({ ...draftConfig, model: event.target.value })}
            className="w-full rounded-xl bg-black/30 border border-white/10 text-white px-3 py-2.5 outline-none"
            placeholder={defaultModels[draftConfig.provider]}
          />
          <datalist id={`models-${draftConfig.provider}`}>
            {PROVIDER_MODELS[draftConfig.provider].map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </datalist>
        </label>

        <p className="text-[10px] text-white/45 leading-relaxed">
          Your key is stored locally in your browser and is only used to translate pages.
        </p>

        {testMessage && (
          <p className="text-[10px] text-white/70 leading-relaxed">{testMessage}</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5 mt-auto">
        <Button onClick={handleTestConnection} disabled={isTestingProvider}>
          {isTestingProvider ? 'Testing...' : 'Test connection'}
        </Button>
        <Button onClick={handleSaveConfig} variant="secondary">
          Save
        </Button>
        {isSettings && (
          <>
            <Button onClick={handleClearConfig} variant="secondary">
              Clear API key
            </Button>
            <Button onClick={() => setView('main')} variant="secondary">
              Back
            </Button>
          </>
        )}
      </div>
    </div>
  );

  const isTranslating = tabState.status === 'translating';

  return (
    <div className="flex flex-col p-6 w-full min-h-[490px] gap-6 relative select-none">
      <button
        onClick={() => window.close()}
        className="absolute top-5 right-5 text-white/40 hover:text-white/80 transition-colors p-1"
        type="button"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {view === 'setup' && renderConfigForm(false)}
      {view === 'settings' && renderConfigForm(true)}

      {view === 'main' && (
        <>
          <div className="flex flex-col items-center text-center mt-3 gap-2">
            <div className="w-12 h-12 flex items-center justify-center shrink-0 mb-1 select-none">
              <img src="/logo.png" alt="Bdarija Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-[9px] font-bold text-white/50 uppercase tracking-[0.25em] leading-none">
              Welcome to Bdarija
            </span>
            <h1 className="text-[25px] font-extrabold tracking-tight text-white leading-[1.2] px-1">
              Unlock powerful Darija translation
            </h1>
          </div>

          <StatusCard
            mode={mode}
            setMode={setMode}
            status={tabState.status}
            count={tabState.translatedCount}
            errorMessage={tabState.errorMessage}
          />

          <div className="flex flex-col gap-2.5 mt-auto">
            <Button onClick={handleTranslate} disabled={isTranslating}>
              {isTranslating ? 'Translating...' : 'Scan & Translate'}
            </Button>

            {tabState.status === 'translated' && (
              <Button onClick={handleRestore} variant="secondary">
                Restore Original
              </Button>
            )}

            <button
              type="button"
              onClick={() => {
                if (aiConfig) setDraftConfig(aiConfig);
                setTestMessage('');
                setView('settings');
              }}
              className="text-[11px] font-semibold text-white/45 hover:text-white/80 transition-colors"
            >
              Settings
            </button>
          </div>

          <div className="text-center text-[10px] text-white/30 font-semibold tracking-wide select-none mt-2">
            <a
              href="https://github.com/MAHMOUDIFARID"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline hover:text-white/60 transition-colors"
            >
              By FARID
            </a>
          </div>
        </>
      )}
    </div>
  );
}
