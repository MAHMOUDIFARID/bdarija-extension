import React from 'react';

interface ProgressBarProps {
  translated: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ translated, total }) => {
  if (total <= 0) {
    return (
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse" style={{ width: '100%' }} />
        </div>
        <span className="text-[9px] font-semibold text-white/40 tabular-nums whitespace-nowrap">
          Scanning...
        </span>
      </div>
    );
  }

  const pct = Math.min(Math.round((translated / total) * 100), 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 px-1">
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[9px] font-semibold text-white/40 tabular-nums whitespace-nowrap">
          {pct}%
        </span>
      </div>
      <div className="flex items-center justify-between text-[9px] text-white/35 font-medium px-1">
        <span>
          {translated} / {total} nodes
        </span>
        {pct < 100 && (
          <span className="text-white/25 animate-pulse">Translating…</span>
        )}
        {pct === 100 && (
          <span className="text-emerald-400/70">Done</span>
        )}
      </div>
    </div>
  );
};