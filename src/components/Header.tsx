import React from 'react';
import { Compass, Sparkles, FileSpreadsheet, Layers } from 'lucide-react';
import { MarketPreset } from '../types';

interface HeaderProps {
  onSelectPreset: (preset: MarketPreset) => void;
  onOpenSignalsModal: () => void;
  onExportCsv: () => void;
  activePresetName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectPreset,
  onOpenSignalsModal,
  onExportCsv,
  activePresetName
}) => {
  const PRESETS: MarketPreset[] = [
    { name: 'Nifty 50', symbol: 'NIFTY', priceLo: 23000, priceHi: 26000, defaultRangeDays: 90 },
    { name: 'Nifty Spot (24k-25k)', symbol: 'NIFTY_SPOT', priceLo: 24000, priceHi: 25000, defaultRangeDays: 90 },
    { name: 'Nifty Wide (22k-27k)', symbol: 'NIFTY_WIDE', priceLo: 22000, priceHi: 27000, defaultRangeDays: 90 }
  ];

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800/80">
      <div className="flex items-center gap-3 min-w-[320px]">
        <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-teal-500/20 border border-amber-500/30 shadow-lg shadow-amber-500/5">
          <Compass className="w-6 h-6 text-amber-400 animate-spin-slow" />
          <div className="absolute inset-0 rounded-xl bg-amber-400/10 blur-sm -z-10" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-slate-400">
              Gann Wheel · 11-Aspect Pressure Matrix
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
              Nifty Calibrated Model v4.0
            </span>
          </div>
          <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-amber-200 flex items-center gap-2">
            Nifty Planetary Matrix
            <span className="font-sans font-normal italic text-teal-400 text-sm">
              Timing Intelligence
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            42 statistical signals calibrated on 6,595-day Nifty dataset · Live Trading Terminal
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 px-2 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" /> Presets:
          </span>
          {PRESETS.map((p) => {
            const isActive = activePresetName === p.name;
            return (
              <button
                key={p.symbol}
                onClick={() => onSelectPreset(p)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-all ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                    : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800/80'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenSignalsModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          42 Signals Catalog
        </button>

        <button
          onClick={onExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 transition-all shadow-sm"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
          Export CSV
        </button>
      </div>
    </header>
  );
};

