import React from 'react';
import { Toggle } from './Toggle.js';
import { TranslationStatus, TranslationMode } from '../lib/types.js';

interface StatusCardProps {
  mode: TranslationMode;
  setMode: (mode: TranslationMode) => void;
  status: TranslationStatus;
  count?: number;
  errorMessage?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  mode,
  setMode,
  status,
  count,
  errorMessage
}) => {
  const isTranslating = status === 'translating';
  const hasPartialMessage = status === 'translated' && Boolean(errorMessage);
  const statusLabel: Record<TranslationStatus, string> = {
    'setup-required': 'Setup required',
    ready: 'Ready',
    translating: 'Translating',
    translated: 'Translated',
    error: 'Error',
    'testing-provider': 'Testing provider',
    'provider-test-success': 'Provider connected',
    'provider-test-error': 'Provider test failed',
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Unified glassmorphic card - contains only Mode Toggle */}
      <div className="flex flex-col gap-3.5 p-5 bg-[#0b0e14]/40 border border-white/10 rounded-[24px] backdrop-blur-xl shadow-xl shadow-black/10 select-none">
        <div className="flex items-start gap-3.5">
          {/* Blue globe/translation icon */}
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-md shadow-blue-500/10 shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 006-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m2.91-10.202a48.455 48.455 0 012.357 5.584m0-5.584a51.18 51.18 0 00-2.4 4.887" />
            </svg>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-bold text-white tracking-wide leading-none">Translation Mode</span>
            <span className="text-[10px] text-white/50 font-medium leading-relaxed">
              Convert webpage text to Arabizi or Arabic script.
            </span>
          </div>
        </div>

        <Toggle value={mode} onChange={setMode} disabled={isTranslating} />

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2">
            <div className="text-[9px] uppercase font-bold tracking-wider text-white/35">Status</div>
            <div className="text-[11px] font-semibold text-white/80">{statusLabel[status]}</div>
          </div>
          <div className="rounded-xl bg-black/20 border border-white/5 px-3 py-2">
            <div className="text-[9px] uppercase font-bold tracking-wider text-white/35">Translated</div>
            <div className="text-[11px] font-semibold text-white/80">{count ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Minimalist error callout - displayed only on failure */}
      {status === 'error' && (
        <div className="p-4 bg-rose-950/20 border border-rose-900/40 text-rose-300 rounded-[20px] text-[10px] leading-relaxed shadow-lg shadow-black/5 select-none animate-fadeIn">
          <div className="font-bold mb-0.5 flex items-center gap-1.5 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Translation Failed
          </div>
          <p className="opacity-90 leading-normal">{errorMessage || 'An error occurred during translation.'}</p>
        </div>
      )}

      {hasPartialMessage && (
        <div className="p-4 bg-amber-950/20 border border-amber-900/40 text-amber-200 rounded-[20px] text-[10px] leading-relaxed shadow-lg shadow-black/5 select-none animate-fadeIn">
          <div className="font-bold mb-0.5 flex items-center gap-1.5 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Partial Progress Saved
          </div>
          <p className="opacity-90 leading-normal">{errorMessage}</p>
        </div>
      )}
    </div>
  );
};
