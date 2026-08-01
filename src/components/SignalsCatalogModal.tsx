import React, { useState } from 'react';
import { SIGNALS, TIER_META } from '../lib/signals';
import { PlanetName, AspectName, SignalTier } from '../types';
import { PLANET_META, ASPECT_META } from '../lib/astronomy';
import { X, Sparkles, Search, ShieldCheck } from 'lucide-react';

interface SignalsCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignalsCatalogModal: React.FC<SignalsCatalogModalProps> = ({
  isOpen,
  onClose
}) => {
  const [searchTerm, setSearchText] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('all');

  if (!isOpen) return null;

  const signalEntries = Object.entries(SIGNALS).map(([key, sig]) => {
    const parts = key.split('|');
    return {
      key,
      planet: parts[0] as PlanetName,
      aspect: parts[1] as AspectName,
      action: parts[2],
      boundary: parts[3],
      direction: parts[4],
      ...sig
    };
  });

  const filteredSignals = signalEntries.filter((sig) => {
    if (tierFilter !== 'all' && sig.tier !== tierFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        sig.planet.toLowerCase().includes(q) ||
        sig.aspect.toLowerCase().includes(q) ||
        sig.desc.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const goldCount = signalEntries.filter((s) => s.tier === 'gold').length;
  const silverCount = signalEntries.filter((s) => s.tier === 'silver').length;
  const bronzeCount = signalEntries.filter((s) => s.tier === 'bronze').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-amber-300">
                Master 42 Statistical Breakout Signals Reference
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Union of 5 rigorous statistical tests: Chi², Fisher, Permutation, Benjamini-Hochberg FDR, Bootstrap CI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 w-64">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search planet, aspect, or signal..."
              value={searchTerm}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setTierFilter('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                tierFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({signalEntries.length})
            </button>
            <button
              onClick={() => setTierFilter('gold')}
              className={`px-3 py-1 rounded-lg transition-all ${
                tierFilter === 'gold'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-amber-300 hover:bg-amber-400/10'
              }`}
            >
              🥇 Gold ({goldCount})
            </button>
            <button
              onClick={() => setTierFilter('silver')}
              className={`px-3 py-1 rounded-lg transition-all ${
                tierFilter === 'silver'
                  ? 'bg-slate-300 text-slate-950 font-bold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              🥈 Silver ({silverCount})
            </button>
            <button
              onClick={() => setTierFilter('bronze')}
              className={`px-3 py-1 rounded-lg transition-all ${
                tierFilter === 'bronze'
                  ? 'bg-amber-700 text-slate-950 font-bold'
                  : 'text-amber-600 hover:bg-slate-800'
              }`}
            >
              🥉 Bronze ({bronzeCount})
            </button>
          </div>
        </div>

        {/* Signals Table */}
        <div className="p-4 overflow-y-auto no-scrollbar flex-1 bg-slate-950/40">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase z-10">
              <tr>
                <th className="p-2.5">Tier</th>
                <th className="p-2.5">Body</th>
                <th className="p-2.5">Aspect</th>
                <th className="p-2.5">Action & Boundary</th>
                <th className="p-2.5">Lift</th>
                <th className="p-2.5">Dir</th>
                <th className="p-2.5">p-Value</th>
                <th className="p-2.5">Methods</th>
                <th className="p-2.5">Bootstrap 95% CI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {filteredSignals.map((sig) => {
                const pMeta = PLANET_META[sig.planet];
                const aspMeta = ASPECT_META[sig.aspect];
                const tierMeta = TIER_META[sig.tier as SignalTier];

                return (
                  <tr key={sig.key} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-2.5">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          backgroundColor: tierMeta.bg,
                          color: tierMeta.color,
                          border: `1px solid ${tierMeta.border}`
                        }}
                      >
                        {tierMeta.icon} {tierMeta.label}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span style={{ color: pMeta?.color }}>{pMeta?.sym}</span> {sig.planet}
                    </td>
                    <td className="p-2.5" style={{ color: aspMeta?.color }}>
                      {aspMeta?.sym} {sig.aspect}
                    </td>
                    <td className="p-2.5 text-slate-300">
                      {sig.action}s {sig.boundary}
                    </td>
                    <td className="p-2.5 font-bold text-amber-300">
                      {sig.lift.toFixed(2)}×
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          sig.direction === 'UP'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : sig.direction === 'DOWN'
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-amber-300 bg-amber-500/10'
                        }`}
                      >
                        {sig.direction}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-400">
                      {sig.p.toFixed(4)}
                    </td>
                    <td className="p-2.5 text-slate-300 font-bold">
                      {sig.nM}/5
                    </td>
                    <td className="p-2.5 text-slate-400 text-[11px]">
                      [{sig.ci[0].toFixed(2)}, {sig.ci[1].toFixed(2)}]
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 text-xs font-mono text-slate-400 flex items-center justify-between">
          <span>Study period: 2000–2026 Nifty index daily history (6,595 trading days, 735 boxing episodes)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-all"
          >
            Close Catalog
          </button>
        </div>
      </div>
    </div>
  );
};
