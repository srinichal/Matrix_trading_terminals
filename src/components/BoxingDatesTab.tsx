import React, { useState, useMemo, useEffect } from 'react';
import { MatrixData, SwingPivot } from '../types';
import {
  computeMultiAnchorDates, MultiAnchorDate,
  selectDiverseSwingAnchors, fromIso, iso
} from '../lib/matrix';
import { NIFTY_SWINGS } from '../data/niftySwings';
import {
  CalendarRange, LayoutGrid, List, Search,
  ChevronRight, Check, X
} from 'lucide-react';

interface BoxingDatesTabProps {
  matrix: MatrixData;
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  orb: number;
  minHighlight: number;
  userSwings: SwingPivot[];
  onAddUserSwing: (s: SwingPivot) => void;
  onRemoveUserSwing: (date: string) => void;
}

function AddSwingForm({ onAdd }: { onAdd: (s: SwingPivot) => void }) {
  const [date, setDate]   = useState('');
  const [type, setType]   = useState<'High' | 'Low'>('High');
  const [price, setPrice] = useState('');

  const handleAdd = () => {
    const p = parseFloat(price.replace(/,/g, ''));
    if (!date || isNaN(p) || p <= 0) return;
    const ring  = Math.floor(p / 100);
    const spoke = ring % 36;
    onAdd({ date, type, price: p, ring, spoke });
    setDate(''); setPrice('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
      <input
        type="date" value={date} onChange={e => setDate(e.target.value)}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1
                   text-slate-200 text-xs focus:outline-none focus:border-amber-500" />
      <select
        value={type} onChange={e => setType(e.target.value as 'High' | 'Low')}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1
                   text-slate-200 text-xs focus:outline-none">
        <option value="High">High</option>
        <option value="Low">Low</option>
      </select>
      <input
        type="text" placeholder="Price e.g. 24500"
        value={price} onChange={e => setPrice(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        className="bg-slate-950 border border-slate-700 rounded px-2 py-1
                   text-slate-200 text-xs w-36 focus:outline-none
                   focus:border-amber-500 placeholder-slate-600" />
      <button
        onClick={handleAdd}
        className="px-3 py-1 rounded bg-amber-400 text-slate-950 font-bold
                   hover:bg-amber-300 transition-all text-xs">
        + Add
      </button>
    </div>
  );
}

export const BoxingDatesTab: React.FC<BoxingDatesTabProps> = ({
  dateFrom, dateTo, userSwings, onAddUserSwing, onRemoveUserSwing
}) => {

  // ── Persist filters ───────────────────────────────────────────────
  const [snapTradingDay, setSnapTradingDay] = useState(() => {
    try { return localStorage.getItem('bd_snap') === 'true'; } catch { return false; }
  });
  const [confluenceOnly, setConfluenceOnly] = useState(() => {
    try { return localStorage.getItem('bd_confOnly') === 'true'; } catch { return false; }
  });
  const [monthFilter, setMonthFilter] = useState(() => {
    try { return localStorage.getItem('bd_month') || 'all'; } catch { return 'all'; }
  });
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try { return (localStorage.getItem('bd_view') as 'grid' | 'table') || 'grid'; }
    catch { return 'grid'; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<MultiAnchorDate | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('bd_snap',     String(snapTradingDay));
      localStorage.setItem('bd_confOnly', String(confluenceOnly));
      localStorage.setItem('bd_month',    monthFilter);
      localStorage.setItem('bd_view',     viewMode);
    } catch {}
  }, [snapTradingDay, confluenceOnly, monthFilter, viewMode]);

  // ── Merged swing pool: static + user ─────────────────────────────
  const allSwings = useMemo<SwingPivot[]>(() => {
    const map = new Map<string, SwingPivot>();
    for (const s of NIFTY_SWINGS) map.set(s.date, s);
    for (const s of userSwings)   map.set(s.date, s);
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [userSwings]);

  // ── Primary computation ───────────────────────────────────────────
  const allDates = useMemo<MultiAnchorDate[]>(() => {
    return computeMultiAnchorDates(allSwings, dateFrom, dateTo, 18, snapTradingDay);
  }, [allSwings, dateFrom, dateTo, snapTradingDay]);

  // ── Stats ─────────────────────────────────────────────────────────
  const confluenceCount = useMemo(
    () => allDates.filter(d => d.isConfluence).length,
    [allDates]
  );

  const diverseAnchors = useMemo(
    () => selectDiverseSwingAnchors(allSwings, dateFrom, 18),
    [allSwings, dateFrom]
  );

  // ── Filters ───────────────────────────────────────────────────────
  const availableMonths = useMemo(() =>
    Array.from(new Set(allDates.map(d => d.date.slice(0, 7)))).sort(),
    [allDates]
  );

  const filteredDates = useMemo<MultiAnchorDate[]>(() => {
    return allDates.filter(d => {
      if (confluenceOnly && !d.isConfluence) return false;
      if (monthFilter !== 'all' && !d.date.startsWith(monthFilter)) return false;
      if (searchQuery.trim() && !d.date.includes(searchQuery.trim())) return false;
      return true;
    });
  }, [allDates, confluenceOnly, monthFilter, searchQuery]);

  // ── Helpers ───────────────────────────────────────────────────────
  const getDow = (dateStr: string) =>
    fromIso(dateStr).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4">

      {/* Stats banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4
                      flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-serif text-base font-bold text-amber-300">
            Multi-Anchor Boxing Dates
          </h4>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            K=18 diverse spoke-anchors · 36-day cycle ·{' '}
            {allSwings.length.toLocaleString()} pivot pool
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="text-slate-400">Total: </span>
            <b className="text-slate-100">{allDates.length}</b>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/20
                          text-purple-300 px-3 py-1.5 rounded-lg font-bold">
            ◈ {confluenceCount} Confluence
          </div>
          <div className="bg-slate-900 border border-slate-700
                          text-slate-400 px-3 py-1.5 rounded-lg">
            · {allDates.length - confluenceCount} Single
          </div>
        </div>
      </div>

      {/* Add swing pivot */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-mono uppercase tracking-wider
                       text-amber-300 font-bold">
          Add Swing Pivot (post 2026-07-24)
        </h4>
        <AddSwingForm onAdd={onAddUserSwing} />
        {userSwings.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-mono uppercase">
              User-entered ({userSwings.length}):
            </div>
            {userSwings.map(s => (
              <div key={s.date}
                className="flex items-center justify-between px-2 py-1 rounded
                           bg-slate-950 border border-slate-800 font-mono text-[11px]">
                <span className="text-slate-300">
                  {s.date} · {s.type} · {s.price.toLocaleString()} · spoke {s.spoke}
                </span>
                <button
                  onClick={() => onRemoveUserSwing(s.date)}
                  className="text-rose-400 hover:text-rose-300 font-bold ml-2">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4
                      flex flex-wrap items-center gap-3">
        {/* Snap toggle */}
        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border
                           cursor-pointer transition-all text-xs font-mono ${
          snapTradingDay
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
            : 'bg-slate-950 border-slate-800 text-slate-400'
        }`}>
          <input type="checkbox" checked={snapTradingDay}
            onChange={e => setSnapTradingDay(e.target.checked)} className="hidden" />
          <Check className={`w-3 h-3 ${snapTradingDay ? 'opacity-100' : 'opacity-0'}`} />
          Snap weekends to Mon
        </label>

        {/* Confluence filter */}
        <button
          onClick={() => setConfluenceOnly(v => !v)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
            confluenceOnly
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-200 font-bold'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
          }`}>
          ◈ Confluence only
        </button>

        {/* Month filter */}
        <select
          value={monthFilter}
          onChange={e => setMonthFilter(e.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5
                     text-xs font-mono text-slate-300 focus:outline-none">
          <option value="all">All months</option>
          {availableMonths.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        {/* Search */}
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800
                        rounded-lg px-2 py-1.5">
          <Search className="w-3 h-3 text-slate-500" />
          <input
            type="text" placeholder="date…"
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs font-mono text-slate-300
                       outline-none w-24 placeholder-slate-600" />
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'grid'
                ? 'bg-amber-400/20 text-amber-300'
                : 'text-slate-500 hover:text-slate-400'
            }`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-all ${
              viewMode === 'table'
                ? 'bg-amber-400/20 text-amber-300'
                : 'text-slate-500 hover:text-slate-400'
            }`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Date list */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
                        xl:grid-cols-4 gap-3">
          {filteredDates.map(d => (
            <div
              key={d.date}
              onClick={() => setSelectedDate(d)}
              className={`p-3.5 rounded-xl border font-mono cursor-pointer
                          hover:scale-[1.02] transition-all shadow-lg space-y-2 ${
                d.isConfluence
                  ? 'bg-slate-900 border-purple-500/50 ring-1 ring-purple-500/30'
                  : 'bg-slate-900/70 border-slate-700/50 hover:border-slate-600'
              }`}>
              {d.isConfluence && (
                <div className="flex items-center justify-between px-2 py-1 rounded
                                bg-purple-500/15 border border-purple-500/40
                                text-[10px] font-bold text-purple-200">
                  <span>◈ CONFLUENCE</span>
                  <span>{d.spokeCount} spokes · {d.highAnchors}H {d.lowAnchors}L</span>
                </div>
              )}
              <div className="flex items-center justify-between
                              border-b border-slate-800 pb-2">
                <div>
                  <div className="text-sm font-bold text-slate-100">
                    {d.date}
                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                      ({getDow(d.date)})
                    </span>
                  </div>
                  {d.snappedDate && (
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      snapped from {d.snappedDate}
                    </div>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  d.isConfluence
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {d.convergenceCount}×
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {d.anchors.map((a, idx) => (
                  <span key={idx}
                    className={`px-1.5 py-0.5 rounded text-[10px] border font-mono ${
                      a.type === 'High'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                    title={`${a.date} @ ${a.price.toLocaleString()} · ${a.spoke}+36×${a.cycleK}=${a.daysProjected}d`}>
                    {a.type === 'High' ? '▲' : '▼'} {a.date.slice(2)} s{a.spoke}
                  </span>
                ))}
              </div>
              <div className="text-[9px] text-slate-600 flex items-center
                              justify-end gap-1">
                <ChevronRight className="w-3 h-3" /> inspect
              </div>
            </div>
          ))}
          {filteredDates.length === 0 && (
            <div className="col-span-full text-center text-slate-500
                            font-mono text-sm py-12">
              No dates match current filters.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800
                                text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Day</th>
                  <th className="p-3">Anchors</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Contributing spokes</th>
                </tr>
              </thead>
              <tbody>
                {filteredDates.map((d, i) => (
                  <tr key={d.date}
                    onClick={() => setSelectedDate(d)}
                    className={`border-b border-slate-800/50 cursor-pointer
                                hover:bg-slate-800/30 transition-all ${
                      i % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/20'
                    }`}>
                    <td className="p-3 font-bold text-slate-200">{d.date}</td>
                    <td className="p-3 text-slate-400">{getDow(d.date)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        d.isConfluence
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {d.convergenceCount}
                      </span>
                    </td>
                    <td className="p-3">
                      {d.isConfluence
                        ? <span className="text-purple-300 font-bold">◈ Confluence</span>
                        : <span className="text-slate-500">Single</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {d.anchors.map((a, idx) => (
                          <span key={idx}
                            className={`text-[10px] px-1 rounded ${
                              a.type === 'High'
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}>
                            s{a.spoke}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl
                          p-6 max-w-lg w-full shadow-2xl space-y-4 font-mono
                          text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between
                            border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-serif text-xl font-bold text-slate-100">
                  {selectedDate.date}
                </h3>
                <p className="text-slate-400 mt-1">
                  {selectedDate.convergenceCount} anchor
                  {selectedDate.convergenceCount !== 1 ? 's' : ''} converge here
                  {selectedDate.isConfluence &&
                    <span className="ml-2 text-purple-300 font-bold">◈ CONFLUENCE</span>
                  }
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)}
                className="p-1 rounded bg-slate-800 text-slate-400
                           hover:text-slate-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <span className="px-2 py-1 rounded bg-emerald-500/10
                               border border-emerald-500/20 text-emerald-300">
                ▲ {selectedDate.highAnchors} High
              </span>
              <span className="px-2 py-1 rounded bg-rose-500/10
                               border border-rose-500/20 text-rose-300">
                ▼ {selectedDate.lowAnchors} Low
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase text-slate-400
                             font-bold tracking-wider">
                Contributing anchors
              </h4>
              {selectedDate.anchors.map((a, idx) => (
                <div key={idx}
                  className="flex items-center justify-between p-2.5 rounded
                             bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold
                                      border ${
                      a.type === 'High'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}>
                      {a.type === 'High' ? '▲' : '▼'} {a.type}
                    </span>
                    <span className="text-slate-200 font-bold">{a.date}</span>
                    <span className="text-slate-500">
                      @ {a.price.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right text-slate-400 text-[10px]">
                    <div>Ring {a.ring} · Spoke {a.spoke}</div>
                    <div>{a.spoke}+36×{a.cycleK}={a.daysProjected}d</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3 space-y-2">
              <h4 className="text-[10px] uppercase text-slate-400
                             font-bold tracking-wider">
                Active anchor pool (K=18 diverse spokes)
              </h4>
              <div className="flex flex-wrap gap-1">
                {diverseAnchors.map((a, i) => (
                  <span key={i}
                    className={`px-1.5 py-0.5 rounded text-[10px] border
                                font-mono ${
                      selectedDate.anchors.some(sa => sa.spoke === a.spoke)
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}>
                    s{a.spoke}·{a.date.slice(5)}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">
                Purple = contributed · Grey = did not
              </p>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button onClick={() => setSelectedDate(null)}
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
