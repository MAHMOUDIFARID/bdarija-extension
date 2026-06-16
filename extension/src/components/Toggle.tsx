import React from 'react';
import { TranslationMode } from '../lib/types.js';

interface ToggleProps {
  value: TranslationMode;
  onChange: (value: TranslationMode) => void;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ value, onChange, disabled }) => {
  return (
    <div className="flex p-0.5 bg-black/30 border border-white/5 rounded-xl select-none w-full relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('arabizi')}
        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-300 z-10 ${
          value === 'arabizi'
            ? 'bg-white/15 text-white border border-white/10 shadow-sm'
            : 'text-white/50 hover:text-white border border-transparent'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Arabizi
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('arabic')}
        className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all duration-300 z-10 ${
          value === 'arabic'
            ? 'bg-white/15 text-white border border-white/10 shadow-sm'
            : 'text-white/50 hover:text-white border border-transparent'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Arabic Script
      </button>
    </div>
  );
};
