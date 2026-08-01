import React, { useState, useEffect } from 'react';
import { MatrixData, DepartureEvent } from '../types';
import { scanCriticalDates } from '../lib/matrix';
import { ASPECT_META, PLANET_META } from '../lib/astronomy';
import { TIER_META } from '../lib/signals';
import { Sparkles, Calendar, TrendingUp, TrendingDown, RefreshCw, Filter, ShieldCheck, Code2 } from 'lucide-react';

interface CriticalDatesTabProps {
  matrix: MatrixData;
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  orb: number;
  minHighlight: number;
}

export const CriticalDatesTab: React.FC<CriticalDatesTabProps> = ({
  matrix,
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  orb,
  minHighlight
}) => {
  const [filterTier, setFilterTier] = useState<string>(() => {
    try {
      return localStorage.getItem('cdt_filterTier') || 'all';
    } catch (e) {
      return 'all';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('cdt_filterTier', filterTier);
    } catch (e) {}
  }, [filterTier]);

  const events = scanCriticalDates(
    matrix,
    dateFrom,
    dateTo,
    priceLo,
    priceHi,
    orb,
    minHighlight
  );

  const goldEvents = events.filter((e) => e.sig && e.sig.tier === 'gold');
  const silverEvents = events.filter((e) => e.sig && e.sig.tier === 'silver');
  const bronzeEvents = events.filter((e) => e.sig && e.sig.tier === 'bronze');

  const filteredEvents = events.filter((e) => {
    if (filterTier === 'all') return true;
    if (filterTier === 'gold') return e.sig?.tier === 'gold';
    if (filterTier === 'silver') return e.sig?.tier === 'silver';
    if (filterTier === 'bronze') return e.sig?.tier === 'bronze';
    if (filterTier === 'depart' || filterTier === 'arrive') return e.action === filterTier;
    return true;
  });

  // Cluster analysis
  const dateClusters: Record<string, { gold: number; silver: number; bronze: number }> = {};
  events.forEach((e) => {
    if (!e.sig) return;
    if (!dateClusters[e.date]) dateClusters[e.date] = { gold: 0, silver: 0, bronze: 0 };
    dateClusters[e.date][e.sig.tier]++;
  });

  const highProbClusters = Object.entries(dateClusters)
    .filter(([_, counts]) => counts.gold + counts.silver >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]));

  const upGold = goldEvents.filter((e) => e.sig?.direction === 'UP').length;
  const downGold = goldEvents.filter((e) => e.sig?.direction === 'DOWN').length;

  return (
    <div className="space-y-6">
      {/* Top Banner with Pine Script trigger */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h4 className="font-serif text-sm font-bold text-amber-300">
              Critical Timing Dates & Breakout Signals
            </h4>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Identifies high-probability planetary departure catalyst dates and direction bias.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Gold & Silver Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GOLD Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden border-t-4 border-t-amber-400">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-serif text-sm font-bold text-amber-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              🥇 Gold Breakout Signals
            </h4>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
              {goldEvents.length} Events
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mb-4">
            ≥5 statistical methods agree, bootstrap CI &gt; 1.0. Confirmed historical timing catalysts.
          </p>

          {goldEvents.length > 0 ? (
            <div className="space-y-2 max-h-[280px] overflow-y-auto no-scrollbar pr-1">
              {goldEvents.slice(0, 15).map((e, idx) => {
                const pMeta = PLANET_META[e.body as keyof typeof PLANET_META];
                const aspMeta = ASPECT_META[e.aspect as keyof typeof ASPECT_META];
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="text-amber-300 font-bold">{e.date}</span> ·{' '}
                      <span className="text-slate-300 font-semibold">{e.price.toLocaleString()}</span>
                      <div className="text-slate-400 text-[11px] mt-0.5">
                        <span style={{ color: pMeta?.color }}>{pMeta?.sym}</span> {e.body}{' '}
                        <span style={{ color: aspMeta?.color }}>{aspMeta?.abbr || e.aspect}</span> {e.action}s
                      </div>
                    </div>
                    {e.sig && (
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold"
                        style={{
                          backgroundColor: TIER_META.gold.bg,
                          color: TIER_META.gold.color,
                          border: `1px solid ${TIER_META.gold.border}`
                        }}
                      >
                        {e.sig.lift.toFixed(1)}× {e.sig.direction}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs font-mono text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-lg">
              No Gold signals in this date/price window. Range-bound price action strongly favored.
            </div>
          )}
        </div>

        {/* SILVER + BRONZE Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden border-t-4 border-t-slate-400">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-serif text-sm font-bold text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              🥈 Silver & 🥉 Bronze Watch Events
            </h4>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-400/10 text-slate-300 border border-slate-400/30">
              {silverEvents.length + bronzeEvents.length} Events
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mb-4">
            Silver = 3-4 methods agree. Bronze = 1-2 methods. High-value when clustering with Gold signals.
          </p>

          <div className="space-y-2 max-h-[280px] overflow-y-auto no-scrollbar pr-1">
            {[...silverEvents, ...bronzeEvents].slice(0, 15).map((e, idx) => {
              const pMeta = PLANET_META[e.body as keyof typeof PLANET_META];
              const aspMeta = ASPECT_META[e.aspect as keyof typeof ASPECT_META];
              const tierKey = e.sig?.tier || 'bronze';

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs flex items-center justify-between"
                >
                  <div>
                    <span className="text-amber-300 font-bold">{e.date}</span> ·{' '}
                    <span className="text-slate-300 font-semibold">{e.price.toLocaleString()}</span>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      <span style={{ color: pMeta?.color }}>{pMeta?.sym}</span> {e.body}{' '}
                      <span style={{ color: aspMeta?.color }}>{aspMeta?.abbr || e.aspect}</span> {e.action}s
                    </div>
                  </div>
                  {e.sig && (
                    <span
                      className="px-2 py-1 rounded text-[10px] font-bold"
                      style={{
                        backgroundColor: TIER_META[tierKey].bg,
                        color: TIER_META[tierKey].color,
                        border: `1px solid ${TIER_META[tierKey].border}`
                      }}
                    >
                      {e.sig.lift.toFixed(1)}× {e.sig.direction}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Options Strategy & Clustering Analysis */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
        <h4 className="font-serif text-sm font-bold text-teal-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          Options Strategy & Signal Clustering Intelligence
        </h4>

        <div className="font-mono text-xs text-slate-300 leading-relaxed bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          {goldEvents.length === 0 ? (
            <p className="text-emerald-400 font-semibold">
              ✓ RANGE BOUND FAVORED: Zero Gold-tier breakout signals detected. Selling options premium (Iron Condors, Short Strangles) at containment corridor walls offers high statistical edge.
            </p>
          ) : (
            <div>
              <p className="text-amber-300 font-semibold">
                ⚡ BREAKOUT WATCH: {goldEvents.length} Gold signal event(s) detected.
              </p>
              <p className="text-slate-400 mt-1">
                Directional Bias:{' '}
                {upGold > downGold ? (
                  <b className="text-emerald-400">UPWARD BULLISH LIFT ({upGold} Gold-UP vs {downGold} Gold-DOWN)</b>
                ) : downGold > upGold ? (
                  <b className="text-rose-400">DOWNWARD BEARISH LIFT ({downGold} Gold-DOWN vs {upGold} Gold-UP)</b>
                ) : (
                  <b className="text-amber-300 font-semibold">NEUTRAL / BALANCED BREAKOUT</b>
                )}
              </p>
            </div>
          )}

          {highProbClusters.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-amber-400 font-bold">Signal Clusters (≥2 Gold/Silver on same date): </span>
              {highProbClusters.map(([date, c]) => (
                <span
                  key={date}
                  className="inline-block px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 font-bold border border-amber-400/30 mr-1.5 my-0.5"
                >
                  {date} ({c.gold}G+{c.silver}S)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Detailed Filterable Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-serif text-sm font-semibold text-amber-300">
            All Critical Events ({events.length})
          </h4>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-500 px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {['all', 'gold', 'silver', 'bronze', 'depart', 'arrive'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterTier(f)}
                className={`px-2.5 py-1 rounded text-xs capitalize transition-all ${
                  filterTier === f
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto no-scrollbar rounded-lg border border-slate-800">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Price</th>
                <th className="p-2.5">Tier</th>
                <th className="p-2.5">Body</th>
                <th className="p-2.5">Aspect</th>
                <th className="p-2.5">Action</th>
                <th className="p-2.5">Signal Description</th>
                <th className="p-2.5">Lift</th>
                <th className="p-2.5">Dir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {filteredEvents.map((e, idx) => {
                const pMeta = PLANET_META[e.body as keyof typeof PLANET_META];
                const aspMeta = ASPECT_META[e.aspect as keyof typeof ASPECT_META];
                const tierKey = e.sig?.tier || 'bronze';

                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-2.5 text-amber-300 font-semibold">{e.date}</td>
                    <td className="p-2.5 font-bold text-slate-200">{e.price.toLocaleString()}</td>
                    <td className="p-2.5">
                      {e.sig && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            backgroundColor: TIER_META[tierKey].bg,
                            color: TIER_META[tierKey].color,
                            border: `1px solid ${TIER_META[tierKey].border}`
                          }}
                        >
                          {TIER_META[tierKey].label}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span style={{ color: pMeta?.color }}>{pMeta?.sym}</span> {e.body}
                    </td>
                    <td className="p-2.5" style={{ color: aspMeta?.color }}>
                      {aspMeta?.sym} {e.aspect}
                    </td>
                    <td className="p-2.5 capitalize text-slate-300">{e.action}</td>
                    <td className="p-2.5 text-slate-300">{e.sig?.desc || '—'}</td>
                    <td className="p-2.5 font-bold text-amber-300">
                      {e.sig ? `${e.sig.lift.toFixed(1)}×` : '—'}
                    </td>
                    <td className="p-2.5 font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          e.sig?.direction === 'UP'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : e.sig?.direction === 'DOWN'
                            ? 'text-rose-400 bg-rose-500/10'
                            : 'text-amber-300 bg-amber-500/10'
                        }`}
                      >
                        {e.sig?.direction || 'ANY'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
