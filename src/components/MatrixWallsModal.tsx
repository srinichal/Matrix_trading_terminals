import React, { useState, useMemo } from 'react';
import { MatrixData, DepartureEvent } from '../types';
import { computeMatrix, scanCriticalDates } from '../lib/matrix';
import { X, Search, Shield, Layers, Sparkles, Copy, Check, Grid3X3, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MatrixWallsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix?: MatrixData;
  priceLo?: number;
  priceHi?: number;
  dateFrom?: string;
  dateTo?: string;
  orb?: number;
  minHighlight?: number;
}

export const MatrixWallsModal: React.FC<MatrixWallsModalProps> = ({
  isOpen,
  onClose,
  matrix: inputMatrix,
  priceLo = 21000,
  priceHi = 27000,
  dateFrom = '2026-01-01',
  dateTo = '2026-12-31',
  orb = 1.0,
  minHighlight = 3
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'perm' | 'strong' | 'signals'>('all');

  // Fallback compute matrix if not passed
  const matrix = useMemo(() => {
    if (inputMatrix && inputMatrix.dates && inputMatrix.dates.length > 0) {
      return inputMatrix;
    }
    const ringLo = Math.floor(Math.max(100, priceLo) / 100);
    const ringHi = Math.ceil(priceHi / 100);
    return computeMatrix(dateFrom, dateTo, ringLo, ringHi, 1, orb);
  }, [inputMatrix, dateFrom, dateTo, priceLo, priceHi, orb]);

  // Valid dates in range
  const validDates = useMemo(() => {
    if (!matrix || !matrix.dates) return [];
    return matrix.dates.filter((d) => (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo));
  }, [matrix, dateFrom, dateTo]);

  const nDays = validDates.length || 1;
  const ringLo = Math.floor(Math.max(100, priceLo) / 100);
  const ringHi = Math.ceil(priceHi / 100);

  // Compute Permanent S/R Walls and Strong Walls
  const { permWalls, strongWalls } = useMemo(() => {
    const perm: number[] = [];
    const strong: number[] = [];

    if (!matrix || !matrix.data) return { permWalls: perm, strongWalls: strong };

    for (let r = ringLo; r <= ringHi; r++) {
      let hitsCount = 0;
      for (const d of validDates) {
        if (
          matrix.data[d] &&
          matrix.data[d][r] &&
          matrix.data[d][r].length >= minHighlight
        ) {
          hitsCount++;
        }
      }
      const pct = hitsCount / nDays;
      const price = r * 100;
      if (pct >= 0.9) {
        perm.push(price);
      } else if (pct >= 0.5) {
        strong.push(price);
      }
    }

    return {
      permWalls: perm.sort((a, b) => a - b),
      strongWalls: strong.sort((a, b) => a - b)
    };
  }, [matrix, validDates, ringLo, ringHi, minHighlight, nDays]);

  // Compute Active Astro Departure Signals
  const criticalEvents = useMemo(() => {
    if (!matrix) return [];
    try {
      return scanCriticalDates(
        matrix,
        dateFrom || matrix.dates[0] || '2026-01-01',
        dateTo || matrix.dates[matrix.dates.length - 1] || '2026-12-31',
        priceLo,
        priceHi,
        orb,
        minHighlight
      );
    } catch (e) {
      return [];
    }
  }, [matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight]);

  // Search filtering
  const filteredPermWalls = useMemo(() => {
    if (!searchTerm) return permWalls;
    return permWalls.filter((p) => p.toString().includes(searchTerm));
  }, [permWalls, searchTerm]);

  const filteredStrongWalls = useMemo(() => {
    if (!searchTerm) return strongWalls;
    return strongWalls.filter((p) => p.toString().includes(searchTerm));
  }, [strongWalls, searchTerm]);

  const filteredSignals = useMemo(() => {
    if (!searchTerm) return criticalEvents;
    const q = searchTerm.toLowerCase();
    return criticalEvents.filter((e) => {
      return (
        e.price.toString().includes(q) ||
        e.date.includes(q) ||
        e.body.toLowerCase().includes(q) ||
        e.aspect.toLowerCase().includes(q) ||
        (e.sig?.tier && e.sig.tier.toLowerCase().includes(q))
      );
    });
  }, [criticalEvents, searchTerm]);

  const handleCopyLevels = () => {
    const text = [
      `PERMANENT S/R WALLS (≥90%):`,
      permWalls.join(', '),
      `\nSTRONG WALLS (50-89%):`,
      strongWalls.join(', ')
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-amber-200 flex items-center gap-2">
                Matrix Planetary Walls & Departure Signals
              </h3>
              <p className="text-xs font-mono text-slate-400">
                Key S/R price levels and high-probability departure signals
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
            title="Close Pop Box"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search level (e.g. 24000), date, or planet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none w-full placeholder-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setSelectedTab('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedTab === 'all'
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
            >
              All Overview
            </button>
            <button
              onClick={() => setSelectedTab('perm')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedTab === 'perm'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
            >
              Permanent ({permWalls.length})
            </button>
            <button
              onClick={() => setSelectedTab('strong')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedTab === 'strong'
                  ? 'bg-slate-800 text-slate-200 border border-slate-700 font-bold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
            >
              Strong ({strongWalls.length})
            </button>
            <button
              onClick={() => setSelectedTab('signals')}
              className={`px-3 py-1 rounded-lg transition-all ${
                selectedTab === 'signals'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800'
              }`}
            >
              Signals ({criticalEvents.length})
            </button>
          </div>
        </div>

        {/* Simple 3-Panel Content View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Panel 1: Permanent Walls */}
            {(selectedTab === 'all' || selectedTab === 'perm') && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h4 className="font-mono text-xs font-bold text-amber-200 flex items-center gap-1.5 uppercase tracking-wide">
                    <Shield className="w-4 h-4 text-amber-400" />
                    Permanent S/R Walls (≥90%)
                  </h4>
                  <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20 font-bold">
                    {filteredPermWalls.length} Levels
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 overflow-y-auto max-h-60 no-scrollbar">
                  {filteredPermWalls.length > 0 ? (
                    filteredPermWalls.map((price) => (
                      <span
                        key={price}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold hover:bg-amber-500/20 transition-all cursor-default"
                        title={`Permanent S/R Wall at ${price.toLocaleString()} pts`}
                      >
                        {price.toLocaleString()}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-mono text-slate-500 py-4">No Permanent Walls found</span>
                  )}
                </div>
              </div>
            )}

            {/* Panel 2: Strong Walls */}
            {(selectedTab === 'all' || selectedTab === 'strong') && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h4 className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wide">
                    <Layers className="w-4 h-4 text-slate-400" />
                    Strong Walls (50-89%)
                  </h4>
                  <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold">
                    {filteredStrongWalls.length} Levels
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1 overflow-y-auto max-h-60 no-scrollbar">
                  {filteredStrongWalls.length > 0 ? (
                    filteredStrongWalls.map((price) => (
                      <span
                        key={price}
                        className="px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-300 border border-slate-700 font-mono text-xs hover:bg-slate-700 transition-all cursor-default"
                        title={`Strong Wall at ${price.toLocaleString()} pts`}
                      >
                        {price.toLocaleString()}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-mono text-slate-500 py-4">No Strong Walls found</span>
                  )}
                </div>
              </div>
            )}

            {/* Panel 3: Active Astro Departure Signals */}
            {(selectedTab === 'all' || selectedTab === 'signals') && (
              <div className={`bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg flex flex-col ${selectedTab === 'signals' ? 'md:col-span-3' : ''}`}>
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h4 className="font-mono text-xs font-bold text-purple-200 flex items-center gap-1.5 uppercase tracking-wide">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    Active Astro Departure Signals
                  </h4>
                  <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20 font-bold">
                    {filteredSignals.length} Signals
                  </span>
                </div>

                <div className="space-y-1.5 pt-1 max-h-60 overflow-y-auto no-scrollbar font-mono text-xs text-slate-300">
                  {filteredSignals.length > 0 ? (
                    filteredSignals.slice(0, selectedTab === 'signals' ? 100 : 25).map((e, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] border-b border-slate-800/50 pb-1.5 hover:bg-slate-800/30 px-1 rounded transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              e.sig?.tier === 'gold'
                                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                                : e.sig?.tier === 'silver'
                                ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30'
                                : 'bg-orange-400/20 text-orange-300 border border-orange-400/30'
                            }`}
                          >
                            {e.sig?.tier?.toUpperCase() || 'GOLD'}
                          </span>
                          <span className="text-amber-200 font-semibold">{e.date}</span>
                        </div>

                        <span className="text-slate-300 font-medium">
                          {e.body} {e.aspect}
                        </span>

                        <span className={`font-bold flex items-center gap-0.5 ${e.sig?.direction === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {e.sig?.direction === 'UP' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          @{e.price.toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs font-mono text-slate-500 py-4">No departure signals match search filter</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90 text-xs font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyLevels}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span>{copied ? 'Levels Copied!' : 'Copy S/R Levels'}</span>
            </button>
            <span className="text-slate-500 hidden sm:inline">Range: {priceLo.toLocaleString()} ─ {priceHi.toLocaleString()} Pts</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
