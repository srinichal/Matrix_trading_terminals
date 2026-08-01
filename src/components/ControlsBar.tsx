import React, { useState } from 'react';
import { Settings, Play, Sliders, ShieldAlert, Sparkles, Filter } from 'lucide-react';

interface ControlsBarProps {
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  dateStep: number;
  orb: number;
  minHighlight: number;
  aspectMode: 'all' | 'major';
  isDirty?: boolean;
  onChange: (fields: Partial<{
    dateFrom: string;
    dateTo: string;
    priceLo: number;
    priceHi: number;
    dateStep: number;
    orb: number;
    minHighlight: number;
    aspectMode: 'all' | 'major';
  }>) => void;
  onCompute: () => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  dateStep,
  orb,
  minHighlight,
  aspectMode,
  isDirty,
  onChange,
  onCompute
}) => {
  const [openAdv, setOpenAdv] = useState(false);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 mb-4 shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-end gap-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Date From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onChange({ dateFrom: e.target.value })}
            className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-all w-36"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Date To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onChange({ dateTo: e.target.value })}
            className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-all w-36"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Price Range
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={priceLo === 0 ? '' : priceLo}
              step={100}
              onChange={(e) => onChange({ priceLo: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 transition-all w-24"
              placeholder="Min"
            />
            <span className="text-slate-500 text-xs font-mono">-</span>
            <input
              type="number"
              value={priceHi === 0 ? '' : priceHi}
              step={100}
              onChange={(e) => onChange({ priceHi: e.target.value === '' ? 0 : Number(e.target.value) })}
              className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 transition-all w-24"
              placeholder="Max"
            />
          </div>
        </div>

        <button
          onClick={() => setOpenAdv(!openAdv)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs transition-all ${
            openAdv
              ? 'bg-amber-400/10 border-amber-400 text-amber-300'
              : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings {openAdv ? '▴' : '▾'}
        </button>

        <button
          onClick={onCompute}
          className={`flex items-center gap-2 px-5 py-1.5 rounded-lg font-sans font-bold text-xs shadow-lg active:scale-95 transition-all ml-auto ${
            isDirty
              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-950 animate-pulse'
              : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-amber-500/20'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isDirty ? 'Compute Changes' : 'Compute Matrix'}
        </button>
      </div>

      {openAdv && (
        <div className="mt-3.5 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-end gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Date Step
            </label>
            <select
              value={dateStep}
              onChange={(e) => onChange({ dateStep: Number(e.target.value) })}
              className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 transition-all w-28"
            >
              <option value={1}>Daily (1d)</option>
              <option value={2}>2 Days</option>
              <option value={7}>Weekly (7d)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Orb Tolerance (°)
            </label>
            <input
              type="number"
              value={orb}
              step={0.5}
              min={0.5}
              max={15}
              onChange={(e) => onChange({ orb: Number(e.target.value) })}
              className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 transition-all w-24"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Min Wall Strength
            </label>
            <select
              value={minHighlight}
              onChange={(e) => onChange({ minHighlight: Number(e.target.value) })}
              className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 transition-all w-32"
            >
              <option value={2}>≥2 Planets</option>
              <option value={3}>≥3 Planets (PP)</option>
              <option value={4}>≥4 Planets (Strong)</option>
              <option value={5}>≥5 Planets (Wall)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              Aspect Mode
            </label>
            <div className="inline-flex rounded-lg border border-slate-700 p-0.5 bg-slate-950">
              <button
                onClick={() => onChange({ aspectMode: 'all' })}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                  aspectMode === 'all'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All 11 Aspects
              </button>
              <button
                onClick={() => onChange({ aspectMode: 'major' })}
                className={`px-3 py-1 text-xs font-mono rounded-md transition-all ${
                  aspectMode === 'major'
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Major 5
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
