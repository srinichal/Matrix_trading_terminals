import React, { useState, useMemo, useEffect } from 'react';
import { MatrixData, SwingPivot, BoxingDate } from '../types';
import {
  computeRawBoxingDates,
  selectDiverseSwingAnchors, fromIso
} from '../lib/matrix';
import { NIFTY_SWINGS } from '../data/niftySwings';
import {
  CalendarRange, LayoutGrid, List, Search,
  ChevronRight, Check, X, ShieldAlert, Sparkles
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
  matrix, dateFrom, dateTo, priceLo, priceHi, minHighlight, userSwings, onAddUserSwing, onRemoveUserSwing
}) => {

  // ── Persist filters (default snapTradingDay to TRUE to match terminal chart) ──────
  const [snapTradingDay, setSnapTradingDay] = useState(() => {
    try {
      const val = localStorage.getItem('bd_snap');
      return val === null ? true : val === 'true';
    } catch { return true; }
  });
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'confluence' | 'perm'>(() => {
    try {
      const val = localStorage.getItem('bd_catFilter');
      return (val as 'all' | 'confluence' | 'perm') || 'all';
    } catch { return 'all'; }
  });
  const [sortOrder, setSortOrder] = useState<'confluence_first' | 'chronological'>(() => {
    try {
      const val = localStorage.getItem('bd_sortOrder');
      return (val as 'confluence_first' | 'chronological') || 'confluence_first';
    } catch { return 'confluence_first'; }
  });
  const [monthFilter, setMonthFilter] = useState(() => {
    try { return localStorage.getItem('bd_month') || 'all'; } catch { return 'all'; }
  });
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try { return (localStorage.getItem('bd_view') as 'grid' | 'table') || 'grid'; }
    catch { return 'grid'; }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<BoxingDate | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('bd_snap',      String(snapTradingDay));
      localStorage.setItem('bd_catFilter', categoryFilter);
      localStorage.setItem('bd_sortOrder', sortOrder);
      localStorage.setItem('bd_month',     monthFilter);
      localStorage.setItem('bd_view',      viewMode);
    } catch {}
  }, [snapTradingDay, categoryFilter, sortOrder, monthFilter, viewMode]);

  // ── Compute matrix perm walls (matching chart) ─────────────
  const validDates = useMemo(() => {
    return matrix.dates.filter((d) => d >= dateFrom && d <= dateTo);
  }, [matrix, dateFrom, dateTo]);

  const nDays = validDates.length || 1;
  const ringLo = Math.floor(priceLo / 100);
  const ringHi = Math.ceil(priceHi / 100);

  const { permWalls, strongWalls } = useMemo(() => {
    const perm: number[] = [];
    const strong: number[] = [];

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
      if (pct >= 0.90) {
        perm.push(r * 100);
      } else if (pct >= 0.50) {
        strong.push(r * 100);
      }
    }

    return {
      permWalls: perm.sort((a, b) => a - b),
      strongWalls: strong.filter((r) => !perm.includes(r)).sort((a, b) => a - b)
    };
  }, [matrix, validDates, nDays, ringLo, ringHi, minHighlight]);

  // ── Primary computation (Exact match with Trading Terminal Chart) ────
  const allDates = useMemo<BoxingDate[]>(() => {
    return computeRawBoxingDates(dateFrom, dateTo, permWalls, strongWalls, userSwings, snapTradingDay);
  }, [dateFrom, dateTo, permWalls, strongWalls, userSwings, snapTradingDay]);

  // ── Merged swing pool for diverse anchor stats ────────────────────────
  const allSwings = useMemo<SwingPivot[]>(() => {
    const map = new Map<string, SwingPivot>();
    for (const s of NIFTY_SWINGS) map.set(s.date, s);
    for (const s of userSwings)   map.set(s.date, s);
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [userSwings]);

  // ── Stats ─────────────────────────────────────────────────────────
  const confluenceCount = useMemo(
    () => allDates.filter(d => d.swingConfluence?.anchors && d.swingConfluence.anchors.length > 0).length,
    [allDates]
  );
  const permCount = useMemo(
    () => allDates.filter(d => d.perm && d.perm.length > 0).length,
    [allDates]
  );

  const diverseAnchors = useMemo(
    () => selectDiverseSwingAnchors(allSwings, dateTo, 18),
    [allSwings, dateTo]
  );

  // ── Filters & Sorting ─────────────────────────────────────────────
  const availableMonths = useMemo(() =>
    Array.from(new Set(allDates.map(d => d.date.slice(0, 7)))).sort(),
    [allDates]
  );

  const filteredDates = useMemo<BoxingDate[]>(() => {
    let list = allDates.filter(d => {
      const hasConfluence = d.swingConfluence?.anchors && d.swingConfluence.anchors.length > 0;
      const hasPerm = d.perm && d.perm.length > 0;

      if (categoryFilter === 'confluence' && !hasConfluence) return false;
      if (categoryFilter === 'perm' && !hasPerm) return false;
      if (monthFilter !== 'all' && !d.date.startsWith(monthFilter)) return false;
      if (searchQuery.trim() && !d.date.includes(searchQuery.trim())) return false;
      return true;
    });

    if (sortOrder === 'confluence_first') {
      list.sort((a, b) => {
        const aConf = a.swingConfluence?.anchors?.length || 0;
        const bConf = b.swingConfluence?.anchors?.length || 0;
        if (aConf > 0 && bConf === 0) return -1;
        if (aConf === 0 && bConf > 0) return 1;
        if (aConf !== bConf) return bConf - aConf;
        return a.date.localeCompare(b.date);
      });
    } else {
      list.sort((a, b) => a.date.localeCompare(b.date));
    }

    return list;
  }, [allDates, categoryFilter, monthFilter, searchQuery, sortOrder]);

  // ── Helpers ───────────────────────────────────────────────────────
  const getDow = (dateStr: string) => {
    try {
      return fromIso(dateStr).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    } catch {
      return '';
    }
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4">

      {/* Stats banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4
                      flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-serif text-base font-bold text-amber-300 flex items-center gap-2">
            <span>🥊 36-Harmonic Key Dates Catalog</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Matched to Chart
            </span>
          </h4>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            36-day harmonic cycles · Swing Anchor Confluence & Perm Matrix Walls ({allSwings.length.toLocaleString()} swing anchors)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
            <span className="text-slate-400">Total Key Dates: </span>
            <b className="text-slate-100">{allDates.length}</b>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30
                          text-purple-300 px-3 py-1.5 rounded-lg font-bold">
            ◈ {confluenceCount} Swing Confluence Dates
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30
                          text-amber-300 px-3 py-1.5 rounded-lg font-bold">
            🥊 {permCount} Perm Wall Dates
          </div>
        </div>
      </div>

      {/* Add swing pivot */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-mono uppercase tracking-wider
                       text-amber-300 font-bold">
          Add Swing Pivot Anchor
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
        {/* Category filter pills */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all ${
              categoryFilter === 'all'
                ? 'bg-slate-800 text-slate-100 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}>
            All Dates ({allDates.length})
          </button>
          <button
            onClick={() => setCategoryFilter('confluence')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1 ${
              categoryFilter === 'confluence'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                : 'text-purple-400/80 hover:text-purple-300'
            }`}>
            ◈ Swing Confluence ({confluenceCount})
          </button>
          <button
            onClick={() => setCategoryFilter('perm')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1 ${
              categoryFilter === 'perm'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}>
            🥊 Perm Walls ({permCount})
          </button>
        </div>

        {/* Display Sort Order */}
        <select
          value={sortOrder}
          onChange={e => setSortOrder(e.target.value as 'confluence_first' | 'chronological')}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5
                     text-xs font-mono text-amber-300 font-bold focus:outline-none">
          <option value="confluence_first">Display: Swing Confluence First</option>
          <option value="chronological">Display: Chronological Order</option>
        </select>

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
          Snap Mon
        </label>

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
                       outline-none w-20 placeholder-slate-600" />
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
          {filteredDates.map(d => {
            const hasSwingConf = d.swingConfluence?.anchors && d.swingConfluence.anchors.length > 0;
            const anchorCount = d.swingConfluence?.anchors?.length || 0;
            const isPerm = d.perm && d.perm.length > 0;
            const dow = getDow(d.date);

            return (
              <div
                key={d.date}
                onClick={() => setSelectedDate(d)}
                className={`p-3.5 rounded-xl border font-mono cursor-pointer
                            hover:scale-[1.02] transition-all shadow-lg space-y-2.5 ${
                  hasSwingConf
                    ? 'bg-slate-900 border-purple-500/50 ring-1 ring-purple-500/20'
                    : 'bg-slate-900 border-amber-500/50 ring-1 ring-amber-500/20'
                }`}>
                
                {/* Header Tag */}
                <div className="flex items-center justify-between">
                  {hasSwingConf ? (
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold flex items-center gap-1">
                      ◈ SWING CONFLUENCE ({anchorCount} {anchorCount === 1 ? 'ANCHOR' : 'ANCHORS'})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold flex items-center gap-1">
                      🥊 PERM MATRIX WALL
                    </span>
                  )}
                </div>

                {/* Date Title */}
                <div className="border-b border-slate-800/80 pb-2">
                  <div className="text-sm font-bold text-slate-100 flex items-center justify-between">
                    <span>{d.date} <span className="text-xs text-slate-400 font-normal">({dow})</span></span>
                  </div>
                  {d.snappedFrom && (
                    <div className="text-[10px] text-emerald-400 mt-0.5 font-sans">
                      snapped from {d.snappedFrom} ({getDow(d.snappedFrom)})
                    </div>
                  )}
                </div>

                {/* Swing Anchors */}
                {hasSwingConf && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-purple-300 font-semibold font-sans">Swing Confluence Anchors:</div>
                    <div className="flex flex-wrap gap-1">
                      {d.swingConfluence!.anchors.slice(0, 4).map((a, idx) => (
                        <span key={idx}
                          className={`px-1.5 py-0.5 rounded text-[10px] border font-mono ${
                            a.type === 'High'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                          }`}
                          title={`${a.date} @ ${a.price.toLocaleString()} · spoke ${a.spoke}`}>
                          {a.type === 'High' ? '▲' : '▼'} {a.date.slice(2)} s{a.spoke}
                        </span>
                      ))}
                      {d.swingConfluence!.anchors.length > 4 && (
                        <span className="text-[10px] text-slate-500 font-sans flex items-center">
                          +{d.swingConfluence!.anchors.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Wall Details */}
                {d.perm.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] text-amber-300 flex items-center gap-1 flex-wrap">
                      <span className="text-slate-500 font-sans">Perm Walls:</span>
                      {d.perm.map(p => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 font-bold">
                          {p.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[9px] text-slate-500 flex items-center justify-end gap-1 pt-1">
                  <ChevronRight className="w-3 h-3 text-slate-400" /> inspect
                </div>
              </div>
            );
          })}
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
                  <th className="p-3">Type</th>
                  <th className="p-3">Swing Anchors</th>
                  <th className="p-3">Perm Walls</th>
                </tr>
              </thead>
              <tbody>
                {filteredDates.map((d, i) => {
                  const hasSwingConf = d.swingConfluence?.anchors && d.swingConfluence.anchors.length > 0;
                  const anchorCount = d.swingConfluence?.anchors?.length || 0;
                  const dow = getDow(d.date);
                  return (
                    <tr key={d.date}
                      onClick={() => setSelectedDate(d)}
                      className={`border-b border-slate-800/50 cursor-pointer
                                  hover:bg-slate-800/30 transition-all ${
                        i % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/20'
                      }`}>
                      <td className="p-3 font-bold text-slate-200">
                        {d.date}
                        {d.snappedFrom && (
                          <span className="block text-[10px] text-emerald-400 font-normal">
                            from {d.snappedFrom}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">{dow}</td>
                      <td className="p-3">
                        {hasSwingConf ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            ◈ SWING CONF ({anchorCount})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            🥊 PERM WALL
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {d.swingConfluence?.anchors && d.swingConfluence.anchors.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {d.swingConfluence.anchors.map((a, idx) => (
                              <span key={idx}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  a.type === 'High'
                                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                                    : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                                }`}>
                                {a.type === 'High' ? '▲' : '▼'} {a.date.slice(2)} s{a.spoke}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-amber-300 font-bold">
                        {d.perm.length > 0 ? d.perm.map(p => p.toLocaleString()).join(', ') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center
                        p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl
                          p-6 max-w-lg w-full shadow-2xl space-y-4 font-mono
                          text-xs max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between
                            border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-xl font-bold text-slate-100">
                    {selectedDate.date}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedDate.kind === 'perm'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'bg-teal-400/20 text-teal-300 border border-teal-400/40'
                  }`}>
                    {selectedDate.kind === 'perm' ? '🥊 PERM BOXING' : '📅 BOXING'}
                  </span>
                </div>
                <p className="text-slate-400 mt-1">
                  Day of week: <strong>{getDow(selectedDate.date)}</strong>
                  {selectedDate.snappedFrom && (
                    <span className="ml-2 text-emerald-400">
                      (Snapped from weekend {selectedDate.snappedFrom})
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => setSelectedDate(null)}
                className="p-1 rounded bg-slate-800 text-slate-400
                           hover:text-slate-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Matrix Wall Details */}
            {(selectedDate.perm.length > 0 || selectedDate.strong.length > 0) && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <h4 className="text-[10px] uppercase text-amber-300 font-bold tracking-wider">
                  36-Harmonic Matrix Walls
                </h4>
                {selectedDate.perm.length > 0 && (
                  <div className="text-xs text-amber-300">
                    <span className="text-slate-400">Perm Walls:</span>{' '}
                    <strong>{selectedDate.perm.map(p => p.toLocaleString()).join(', ')}</strong>
                  </div>
                )}
                {selectedDate.strong.length > 0 && (
                  <div className="text-xs text-teal-300">
                    <span className="text-slate-400">Strong Walls:</span>{' '}
                    <strong>{selectedDate.strong.map(p => p.toLocaleString()).join(', ')}</strong>
                  </div>
                )}
              </div>
            )}

            {/* Swing Confluence Details */}
            {selectedDate.swingConfluence?.anchors && selectedDate.swingConfluence.anchors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] uppercase text-purple-300 font-bold tracking-wider">
                  Swing Anchor Confluence ({selectedDate.swingConfluence.anchors.length} anchors)
                </h4>
                <div className="space-y-1.5">
                  {selectedDate.swingConfluence.anchors.map((a, idx) => (
                    <div key={idx}
                      className="flex items-center justify-between p-2.5 rounded
                                 bg-slate-950 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
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
                        <div>Spoke {a.spoke}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
