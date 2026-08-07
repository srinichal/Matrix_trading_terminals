import React, { useState, useMemo, useEffect } from 'react';
import { TrendingUp, LayoutGrid, List, ChevronRight, X } from 'lucide-react';
import { NIFTY_SWINGS } from '../data/niftySwings';
import { SwingPivot } from '../types';
import { computeGannDates, GannDateEntry } from '../lib/gannSqrt';

interface GannSqrtTabProps {
  dateFrom: string;
  dateTo:   string;
  userSwings: SwingPivot[];
}

// ── Tier styling ──────────────────────────────────────────────────────────
const TIER_STYLE: Record<string, string> = {
  'apex-high': 'bg-rose-500/15 border-rose-500/50 ring-1 ring-rose-500/30',
  'apex':      'bg-amber-500/10 border-amber-500/40',
  's1':        'bg-teal-500/10  border-teal-500/30',
  's2':        'bg-purple-500/10 border-purple-500/30',
};
const TIER_BADGE: Record<string, string> = {
  'apex-high': 'bg-rose-500/30 text-rose-200 border-rose-500/50',
  'apex':      'bg-amber-500/20 text-amber-200 border-amber-500/40',
  's1':        'bg-teal-500/20  text-teal-300  border-teal-500/30',
  's2':        'bg-purple-500/20 text-purple-300 border-purple-500/30',
};
const TIER_LABEL: Record<string, string> = {
  'apex-high': '🔴 APEX HIGH',
  'apex':      '🟠 APEX',
  's1':        '🟡 Series 1',
  's2':        '🟡 Series 2',
};

export const GannSqrtTab: React.FC<GannSqrtTabProps> = ({
  dateFrom, dateTo, userSwings
}) => {

  // ── Filters ──────────────────────────────────────────────────────────
  const [tierFilter, setTierFilter] = useState<'all' | 'apex-high' | 'apex' | 's1' | 's2'>('all');
  const [monthFilter, setMonthFilter] = useState<string>(() => {
    try { return localStorage.getItem('gannsqrt_month') || 'all'; } catch { return 'all'; }
  });
  const [viewMode,   setViewMode]   = useState<'grid' | 'table'>('grid');
  const [selected,   setSelected]   = useState<GannDateEntry | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('gannsqrt_month', monthFilter);
    } catch {}
  }, [monthFilter]);

  // ── Merged swing pool ─────────────────────────────────────────────────
  const allSwings = useMemo(() => {
    const map = new Map<string, SwingPivot>();
    for (const s of NIFTY_SWINGS) map.set(s.date, s);
    for (const s of userSwings)   map.set(s.date, s);
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [userSwings]);

  // ── Compute ───────────────────────────────────────────────────────────
  const allDates = useMemo<GannDateEntry[]>(() => {
    if (!dateFrom || !dateTo) return [];
    return computeGannDates(allSwings, { windowStart: dateFrom, windowEnd: dateTo });
  }, [allSwings, dateFrom, dateTo]);

  // ── Stats ─────────────────────────────────────────────────────────────
  const apexHighCount = allDates.filter(d => d.tag === 'apex-high').length;
  const apexCount     = allDates.filter(d => d.tag === 'apex').length;
  const s1Count       = allDates.filter(d => d.tag === 's1').length;
  const s2Count       = allDates.filter(d => d.tag === 's2').length;

  // ── Month Filter & Filtered Dates ─────────────────────────────────────
  const availableMonths = useMemo(() =>
    Array.from(new Set(allDates.map(d => d.date.slice(0, 7)))).sort(),
    [allDates]
  );

  const filtered = useMemo(() => {
    return allDates.filter(d => {
      if (tierFilter !== 'all' && d.tag !== tierFilter) return false;
      if (monthFilter !== 'all' && !d.date.startsWith(monthFilter)) return false;
      return true;
    });
  }, [allDates, tierFilter, monthFilter]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const getDow = (ds: string) =>
    new Date(ds + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4">

      {/* Stats banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4
                      flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-serif text-base font-bold text-amber-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Gann Square-Root Series
          </h4>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            √HL cascade · {allSwings.length.toLocaleString()} pivot pool ·{' '}
            {dateFrom} → {dateTo}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300
                          px-3 py-1.5 rounded-lg font-bold">
            🔴 {apexHighCount} Apex High
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300
                          px-3 py-1.5 rounded-lg font-bold">
            🟠 {apexCount} Apex
          </div>
          <div className="bg-teal-500/10 border border-teal-500/30 text-teal-300
                          px-3 py-1.5 rounded-lg">
            S1: {s1Count}
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 text-purple-300
                          px-3 py-1.5 rounded-lg">
            S2: {s2Count}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4
                      flex flex-wrap items-center gap-3">
        {/* Tier filter */}
        {(['all','apex-high','apex','s1','s2'] as const).map(t => (
          <button key={t}
            onClick={() => setTierFilter(t)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              tierFilter === t
                ? 'bg-amber-400/20 border-amber-500/50 text-amber-200 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}>
            {t === 'all' ? 'All Tiers' :
             t === 'apex-high' ? '🔴 Apex High' :
             t === 'apex'      ? '🟠 Apex' :
             t === 's1'        ? '🟡 Series 1' : '🟡 Series 2'}
          </button>
        ))}

        {/* Month filter */}
        <select
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono
                     text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer">
          <option value="all">All Months ({allDates.length})</option>
          {availableMonths.map(m => {
            const count = allDates.filter(d => d.date.startsWith(m)).length;
            const [yr, mo] = m.split('-');
            const dateObj = new Date(parseInt(yr), parseInt(mo) - 1, 1);
            const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            return (
              <option key={m} value={m}>
                {label} ({count})
              </option>
            );
          })}
        </select>

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'grid' ? 'bg-amber-400/20 text-amber-300' : 'text-slate-500'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'table' ? 'bg-amber-400/20 text-amber-300' : 'text-slate-500'}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date list — grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(d => (
            <div key={d.date} onClick={() => setSelected(d)}
              className={`p-3.5 rounded-xl border font-mono cursor-pointer
                          hover:scale-[1.02] transition-all shadow-lg space-y-2
                          ${TIER_STYLE[d.tag] ?? 'bg-slate-900/70 border-slate-700/50'}`}>

              {/* Tier ribbon */}
              <div className={`flex items-center justify-between px-2 py-1 rounded
                               text-[10px] font-bold border ${TIER_BADGE[d.tag]}`}>
                <span>{TIER_LABEL[d.tag]}</span>
                <span className="font-mono">score {d.totalScore}</span>
              </div>

              {/* Date */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <span className="text-sm font-bold text-slate-100">{d.date}</span>
                  <span className="text-xs text-slate-400 ml-2">({getDow(d.date)})</span>
                </div>
              </div>

              {/* Stream counts */}
              <div className="flex gap-2 text-[11px]">
                {d.s1Count > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-teal-500/15
                                   border border-teal-500/30 text-teal-300">
                    S1: {d.s1Count}× / {d.s1Anchors}
                  </span>
                )}
                {d.s2Count > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/15
                                   border border-purple-500/30 text-purple-300">
                    S2: {d.s2Count}× / {d.s2Anchors}
                  </span>
                )}
              </div>

              <div className="text-[9px] text-slate-600 flex items-center justify-end gap-1">
                <ChevronRight className="w-3 h-3" /> inspect
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-slate-500 font-mono text-sm py-12">
              No dates match current filter.
            </div>
          )}
        </div>
      ) : (
        /* Table view */
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800
                                text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Day</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">S1 ×/anc</th>
                  <th className="p-3">S2 ×/anc</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={d.date} onClick={() => setSelected(d)}
                    className={`border-b border-slate-800/50 cursor-pointer
                                hover:bg-slate-800/30 transition-all ${
                      i % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/20'
                    }`}>
                    <td className="p-3 font-bold text-slate-200">{d.date}</td>
                    <td className="p-3 text-slate-400">{getDow(d.date)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border
                                        ${TIER_BADGE[d.tag]}`}>
                        {TIER_LABEL[d.tag]}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">{d.totalScore}</td>
                    <td className="p-3 text-teal-300">{d.s1Count > 0 ? `${d.s1Count}/${d.s1Anchors}` : '—'}</td>
                    <td className="p-3 text-purple-300">{d.s2Count > 0 ? `${d.s2Count}/${d.s2Anchors}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6
                          max-w-lg w-full shadow-2xl space-y-4 font-mono text-xs
                          max-h-[85vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-serif text-xl font-bold text-slate-100">{selected.date}</h3>
                <div className={`mt-1 inline-flex px-2 py-0.5 rounded text-[10px]
                                  font-bold border ${TIER_BADGE[selected.tag]}`}>
                  {TIER_LABEL[selected.tag]} · score {selected.totalScore}
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                className="p-1 rounded bg-slate-800 text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stream summary */}
            <div className="flex gap-3">
              {selected.s1Count > 0 && (
                <div className="px-3 py-2 rounded bg-teal-500/10 border
                                border-teal-500/30 text-teal-300 text-center">
                  <div className="text-lg font-bold">{selected.s1Count}</div>
                  <div className="text-[10px] opacity-70">S1 projections</div>
                  <div className="text-[10px]">{selected.s1Anchors} anchors</div>
                </div>
              )}
              {selected.s2Count > 0 && (
                <div className="px-3 py-2 rounded bg-purple-500/10 border
                                border-purple-500/30 text-purple-300 text-center">
                  <div className="text-lg font-bold">{selected.s2Count}</div>
                  <div className="text-[10px] opacity-70">S2 projections</div>
                  <div className="text-[10px]">{selected.s2Anchors} anchors</div>
                </div>
              )}
            </div>

            {/* Formula explainer */}
            <div className="bg-slate-950 rounded-lg p-3 space-y-1 text-[10px] text-slate-400">
              <div className="text-slate-300 font-bold mb-1">How this date was found:</div>
              <div>Stream 1: consecutive swing pairs → x₀=√HL → xₙ=(√xₙ₋₁+2)²</div>
              <div>Stream 2: individual pivot prices → x₀=√Price → xₙ=(√xₙ₋₁+2)²</div>
              <div className="text-amber-300 mt-1">
                {selected.tag === 'apex-high' || selected.tag === 'apex'
                  ? '★ Both streams project independently onto this date'
                  : selected.tag === 's1'
                  ? 'Stream 1 only: multiple swing-pair HL series converge'
                  : 'Stream 2 only: multiple pivot-price series converge'}
              </div>
            </div>

            {/* Sample projections (first 12) */}
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">
                Contributing projections (sample)
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto no-scrollbar pr-1">
                {selected.projs.slice(0, 12).map((p, idx) => (
                  <div key={idx}
                    className="flex items-center justify-between p-2 rounded
                               bg-slate-950 border border-slate-800 text-[10px]">
                    <span className={p.stream === 1 ? 'text-teal-300' : 'text-purple-300'}>
                      S{p.stream}
                    </span>
                    <span className="text-slate-300 font-bold">{p.anchor}</span>
                    <span className="text-slate-500">+{Math.round(p.xval)}d</span>
                    <span className="text-slate-500 truncate max-w-[100px]">{p.src}</span>
                    <span className="text-amber-300">step {p.step}</span>
                  </div>
                ))}
                {selected.projs.length > 12 && (
                  <div className="text-center text-slate-500 text-[10px]">
                    +{selected.projs.length - 12} more
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button onClick={() => setSelected(null)}
                className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950
                           font-bold hover:bg-amber-300 transition-all text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
