import React, { useState, useMemo, useEffect } from 'react';
import { MatrixData, BoxingDate, MatrixHit, SignalDef } from '../types';
import { computeBoxingDates, getWallPricesFromMatrix, scanCriticalDates, fromIso, iso, addDays, SYNC_RING_OFFSETS, computeSyncPricesForWall } from '../lib/matrix';
import { PLANET_META, ASPECT_META } from '../lib/astronomy';
import { getSignal, TIER_META, SIGNALS } from '../lib/signals';
import {
  CalendarDays,
  CalendarRange,
  Clock,
  Filter,
  Search,
  LayoutGrid,
  List,
  Info,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Check,
  ShieldAlert,
  X,
  Layers,
  ArrowRight,
  Award,
  Zap,
  Target,
  Box,
  Star
} from 'lucide-react';

interface BoxingDatesTabProps {
  matrix: MatrixData;
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  orb: number;
  minHighlight: number;
}

export const BoxingDatesTab: React.FC<BoxingDatesTabProps> = ({
  matrix,
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  orb,
  minHighlight
}) => {
  // Local state for anchor date & options with localStorage persistence
  const [anchorDate, setAnchorDate] = useState<string>(() => {
    try {
      return localStorage.getItem('bd_anchorDate') || dateFrom;
    } catch (e) {
      return dateFrom;
    }
  });

  const [snapTradingDay, setSnapTradingDay] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bd_snapTradingDay') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [monthFilter, setMonthFilter] = useState<string>(() => {
    try {
      return localStorage.getItem('bd_monthFilter') || 'all';
    } catch (e) {
      return 'all';
    }
  });

  const [kindFilter, setKindFilter] = useState<'all' | 'perm' | 'strong'>(() => {
    try {
      return (localStorage.getItem('bd_kindFilter') as 'all' | 'perm' | 'strong') || 'all';
    } catch (e) {
      return 'all';
    }
  });

  const [signalFilter, setSignalFilter] = useState<'all' | 'sig' | 'gold' | 'silver' | 'bronze'>(() => {
    try {
      return (localStorage.getItem('bd_signalFilter') as 'all' | 'sig' | 'gold' | 'silver' | 'bronze') || 'all';
    } catch (e) {
      return 'all';
    }
  });

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      return (localStorage.getItem('bd_viewMode') as 'grid' | 'table') || 'grid';
    } catch (e) {
      return 'grid';
    }
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [wallMatchOnly, setWallMatchOnly] = useState<boolean>(false);
  const [showMathExplainer, setShowMathExplainer] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<BoxingDate | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('bd_anchorDate', anchorDate);
      localStorage.setItem('bd_snapTradingDay', String(snapTradingDay));
      localStorage.setItem('bd_monthFilter', monthFilter);
      localStorage.setItem('bd_kindFilter', kindFilter);
      localStorage.setItem('bd_signalFilter', signalFilter);
      localStorage.setItem('bd_viewMode', viewMode);
    } catch (e) {}
  }, [anchorDate, snapTradingDay, monthFilter, kindFilter, signalFilter, viewMode]);

  // Extract wall prices from current matrix
  const { permWalls, strongWalls } = useMemo(() => {
    return getWallPricesFromMatrix(matrix, dateFrom, dateTo, priceLo, priceHi, minHighlight);
  }, [matrix, dateFrom, dateTo, priceLo, priceHi, minHighlight]);

  // Compute 42 Signals Critical Events
  const criticalEvents = useMemo(() => {
    return scanCriticalDates(
      matrix,
      dateFrom,
      dateTo,
      priceLo,
      priceHi,
      orb,
      minHighlight
    );
  }, [matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight]);

  // Compute Boxing Dates
  const allBoxingDates = useMemo(() => {
    return computeBoxingDates(anchorDate, dateTo, permWalls, strongWalls, snapTradingDay);
  }, [anchorDate, dateTo, permWalls, strongWalls, snapTradingDay]);

  // Map 42 Signal Catalog Matches for each Boxing Date
  const signalsByDateMap = useMemo<Record<string, SignalDef[]>>(() => {
    const map: Record<string, SignalDef[]> = {};

    allBoxingDates.forEach((bd) => {
      const matched: SignalDef[] = [];
      const keysSet = new Set<string>();

      const targetDates = [bd.date];
      if (bd.snappedFrom && bd.snappedFrom !== bd.date) {
        targetDates.push(bd.snappedFrom);
      }

      targetDates.forEach((d) => {
        // 1. Critical departure/arrival events on this date
        criticalEvents.forEach((ev) => {
          if (ev.date === d && ev.sig && !keysSet.has(ev.sig.key)) {
            keysSet.add(ev.sig.key);
            matched.push(ev.sig);
          }
        });

        // 2. Active matrix hits on bd's wall prices on this date
        const dayData = matrix.data[d];
        if (dayData) {
          const allWalls = [...bd.perm, ...bd.strong];
          allWalls.forEach((price) => {
            const ring = Math.floor(price / 100);
            const hits = dayData[ring] as MatrixHit[] | undefined;
            if (hits) {
              hits.forEach((hit) => {
                const sig =
                  getSignal(hit.p, hit.a, 'arrive', 'floor') ||
                  getSignal(hit.p, hit.a, 'arrive', 'ceiling') ||
                  getSignal(hit.p, hit.a, 'depart', 'floor') ||
                  getSignal(hit.p, hit.a, 'depart', 'ceiling');
                if (sig && !keysSet.has(sig.key)) {
                  keysSet.add(sig.key);
                  matched.push(sig);
                }
              });
            }
          });
        }
      });

      const TIER_ORDER: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
      matched.sort((a, b) => {
        if (TIER_ORDER[a.tier] !== TIER_ORDER[b.tier]) {
          return TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
        }
        return b.lift - a.lift;
      });

      map[bd.date] = matched;
    });

    return map;
  }, [allBoxingDates, criticalEvents, matrix]);

  // Available Unique Months for Filtering
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    allBoxingDates.forEach((bd) => {
      if (bd.date && bd.date.length >= 7) {
        monthsSet.add(bd.date.slice(0, 7));
      }
    });
    return Array.from(monthsSet).sort();
  }, [allBoxingDates]);

  // Map of wall matches for each Boxing Date (Price Box Wall = Date Box Translated Wall)
  const wallMatchesMap = useMemo<Record<string, { matches: number[]; formattedMatches: string[]; isPermMatch: boolean }>>(() => {
    const map: Record<string, { matches: number[]; formattedMatches: string[]; isPermMatch: boolean }> = {};
    allBoxingDates.forEach((bd) => {
      const formattedSet = new Set<string>();
      const matchPricesSet = new Set<number>();

      // Direct matches (0° angle)
      [...bd.perm, ...bd.strong].forEach((p) => {
        if (permWalls.includes(p) || strongWalls.includes(p)) {
          matchPricesSet.add(p);
          formattedSet.add(`${p.toLocaleString()} (0°)`);
        }
      });

      // Sync matches (calculate angle based on wall offset)
      if (bd.wallSyncs) {
        bd.wallSyncs.forEach((ws) => {
          ws.syncPrices.forEach((sp) => {
            if (permWalls.includes(sp) || strongWalls.includes(sp)) {
              matchPricesSet.add(sp);
              const offset = Math.round((sp - ws.wallPrice) / 100);
              const angleDeg = offset * 10;
              const angleLabel = offset === 0 ? '0°' : (offset > 0 ? `+${angleDeg}°` : `${angleDeg}°`);
              formattedSet.add(`${sp.toLocaleString()} (${angleLabel})`);
            }
          });
        });
      }

      const allMatches = Array.from(matchPricesSet).sort((a, b) => a - b);
      const formattedMatches = Array.from(formattedSet);
      const isPermMatch = bd.perm.some((p) => permWalls.includes(p) || strongWalls.includes(p));

      map[bd.date] = { matches: allMatches, formattedMatches, isPermMatch };
    });
    return map;
  }, [allBoxingDates, permWalls, strongWalls]);

  // Filtered Boxing Dates
  const filteredBoxingDates = useMemo(() => {
    return allBoxingDates.filter((bd) => {
      if (monthFilter !== 'all' && !bd.date.startsWith(monthFilter)) return false;
      if (kindFilter === 'perm' && bd.kind !== 'perm') return false;
      if (kindFilter === 'strong' && bd.kind !== 'strong') return false;

      const sigs = signalsByDateMap[bd.date] || [];
      if (signalFilter === 'sig' && sigs.length === 0) return false;
      if (signalFilter === 'gold' && !sigs.some((s) => s.tier === 'gold')) return false;
      if (signalFilter === 'silver' && !sigs.some((s) => s.tier === 'silver')) return false;
      if (signalFilter === 'bronze' && !sigs.some((s) => s.tier === 'bronze')) return false;

      if (wallMatchOnly) {
        const matchInfo = wallMatchesMap[bd.date];
        if (!matchInfo || matchInfo.matches.length === 0) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDate = bd.date.toLowerCase().includes(q);
        const matchesPerm = bd.perm.some((p) => p.toString().includes(q));
        const matchesStrong = bd.strong.some((p) => p.toString().includes(q));
        const matchesSignal = sigs.some((s) => s.desc.toLowerCase().includes(q) || s.tier.includes(q));
        if (!matchesDate && !matchesPerm && !matchesStrong && !matchesSignal) return false;
      }
      return true;
    });
  }, [allBoxingDates, monthFilter, kindFilter, signalFilter, wallMatchOnly, searchQuery, signalsByDateMap, wallMatchesMap]);

  // Stats
  const totalPermDates = useMemo(() => allBoxingDates.filter((d) => d.kind === 'perm').length, [allBoxingDates]);
  const totalStrongDates = useMemo(() => allBoxingDates.filter((d) => d.kind === 'strong').length, [allBoxingDates]);
  const datesWithSignalsCount = useMemo(() => (Object.values(signalsByDateMap) as SignalDef[][]).filter((sigs) => sigs.length > 0).length, [signalsByDateMap]);
  const goldSignalsDatesCount = useMemo(() => (Object.values(signalsByDateMap) as SignalDef[][]).filter((sigs) => sigs.some((s) => s.tier === 'gold')).length, [signalsByDateMap]);
  const wallMatchDatesCount = useMemo(() => (Object.values(wallMatchesMap) as { matches: number[]; isPermMatch: boolean }[]).filter((m) => m.matches.length > 0).length, [wallMatchesMap]);

  // Group by Month for Grid View
  const monthlyGroups = useMemo<Record<string, BoxingDate[]>>(() => {
    const groups: Record<string, BoxingDate[]> = {};
    filteredBoxingDates.forEach((bd) => {
      const dObj = fromIso(bd.date);
      const monthKey = dObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(bd);
    });
    return groups;
  }, [filteredBoxingDates]);

  // Helper date buttons
  const setAnchorToWindowStart = () => setAnchorDate(dateFrom);
  const setAnchorToToday = () => setAnchorDate(iso(new Date()));
  const setAnchorMinus30 = () => {
    const d = addDays(fromIso(dateFrom), -30);
    setAnchorDate(iso(d));
  };
  const setAnchorMinus60 = () => {
    const d = addDays(fromIso(dateFrom), -60);
    setAnchorDate(iso(d));
  };

  const getDayOfWeekStr = (dateStr: string) => {
    const d = fromIso(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  };

  const getDaysFromAnchor = (dateStr: string) => {
    const a = fromIso(anchorDate).getTime();
    const b = fromIso(dateStr).getTime();
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <CalendarRange className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-serif text-base font-bold text-amber-300">
                Gann Boxing Dates Engine
              </h4>
              <button
                onClick={() => setShowMathExplainer(!showMathExplainer)}
                className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 transition-all"
              >
                <Info className="w-3 h-3" />
                {showMathExplainer ? 'Hide Spec Math' : '36-Harmonic Spec'}
              </button>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Projects structural price walls onto the calendar via 36-harmonic cycle symmetry (<b className="text-amber-300">Price ↔ Time Equivalence</b>)
            </p>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="text-slate-400">Anchor:</span>
            <b className="text-amber-400">{anchorDate}</b>
          </div>
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <span className="text-slate-400">Total Dates:</span>
            <b className="text-slate-100">{allBoxingDates.length}</b>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
            <span>🥇 {totalPermDates} Permanent</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
            <span>★ {datesWithSignalsCount} Signal Matches</span>
            <span className="text-[10px] text-amber-400">({goldSignalsDatesCount} Gold)</span>
          </div>
        </div>
      </div>

      {/* Math Explainer Banner */}
      {showMathExplainer && (
        <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-4 shadow-2xl font-mono text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-amber-300 font-bold flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Gann Price-Time Mapping Formula
            </span>
            <button onClick={() => setShowMathExplainer(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-slate-300">
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-amber-400 font-bold text-[11px] uppercase">1. Price Ring</span>
              <p className="text-[11px] text-slate-400">
                <code className="text-amber-200">ring(price) = Math.floor(price / 100)</code>
              </p>
              <p className="text-[10px] text-slate-500">Maps index price level directly to harmonic ring number (e.g. 24,000 → Ring 240).</p>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-amber-400 font-bold text-[11px] uppercase">2. Day Offset</span>
              <p className="text-[11px] text-slate-400">
                <code className="text-amber-200">dayOffset = ring % 36</code>
              </p>
              <p className="text-[10px] text-slate-500">Folds ring into the 36-harmonic cycle (0–35 days offset from the anchor date).</p>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-amber-400 font-bold text-[11px] uppercase">3. Forward Cycles</span>
              <p className="text-[11px] text-slate-400">
                <code className="text-amber-200">Date = Anchor + (dayOffset + 36 × k) days</code>
              </p>
              <p className="text-[10px] text-slate-500">Projects forward in 36-day cycle increments (k = 0, 1, 2...) across the window.</p>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-amber-500/30 space-y-1">
              <span className="text-amber-300 font-bold text-[11px] uppercase flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                4. 6-Sync Turn Prices
              </span>
              <p className="text-[11px] text-slate-400">
                <code className="text-amber-200">ring ± [12, 9, 0, 9, 12, 18]</code>
              </p>
              <p className="text-[10px] text-slate-500">
                Gann aspect offsets (-120°, -90°, 0°, +90°, +120°, 180°). Touches on boxing date trigger price-time turns.
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 flex items-center justify-between">
            <span>
              <b>Harmonic Siblings:</b> Prices exactly 3,600 points apart (e.g. 22,200 & 25,800) yield identical day offsets and land on the same calendar dates.
            </span>
            <span className="text-amber-400 font-bold">CYCLE = 36 Days</span>
          </div>
        </div>
      )}

      {/* Controls & Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Anchor Date Selector */}
          <div className="lg:col-span-5 space-y-1.5">
            <label className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Projection Anchor Date (Day 0)
              </span>
              <span className="text-slate-500 font-normal text-[10px]">Origin for 36-day cycles</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
                className="bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 font-mono text-xs text-amber-300 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <div className="flex items-center gap-1 flex-wrap text-[10px] font-mono">
                <button
                  onClick={setAnchorToWindowStart}
                  className={`px-2 py-1 rounded border transition-all ${
                    anchorDate === dateFrom
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-400'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                  title="Use Window Start Date"
                >
                  Start ({dateFrom})
                </button>
                <button
                  onClick={setAnchorToToday}
                  className="px-2 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all"
                  title="Set Anchor to Today"
                >
                  Today
                </button>
                <button
                  onClick={setAnchorMinus30}
                  className="px-2 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all"
                  title="Anchor 30 days before window start"
                >
                  -30d
                </button>
                <button
                  onClick={setAnchorMinus60}
                  className="px-2 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 transition-all"
                  title="Anchor 60 days before window start"
                >
                  -60d
                </button>
              </div>
            </div>
          </div>

          {/* Snap Trading Day Switch & Filters */}
          <div className="lg:col-span-7 flex flex-wrap items-center justify-between lg:justify-end gap-3 font-mono text-xs">
            {/* Snap Weekend Toggle */}
            <label
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all ${
                snapTradingDay
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={snapTradingDay}
                onChange={(e) => setSnapTradingDay(e.target.checked)}
                className="hidden"
              />
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border ${
                  snapTradingDay ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-slate-700 bg-slate-900'
                }`}
              >
                {snapTradingDay && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <span>Snap Weekends to Monday</span>
            </label>

            {/* Monthly Filter Dropdown */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 px-1 font-bold flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                Month:
              </span>
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">All Months ({availableMonths.length})</option>
                {availableMonths.map((m) => {
                  const [yr, mo] = m.split('-');
                  const dateObj = new Date(parseInt(yr), parseInt(mo) - 1, 1);
                  const label = dateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  return (
                    <option key={m} value={m}>
                      📅 {label} ({m})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 42 Signals Filter Dropdown */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-500 px-1 font-bold">Signal Filter:</span>
              <select
                value={signalFilter}
                onChange={(e) => setSignalFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
              >
                <option value="all">All Dates</option>
                <option value="sig">★ 42 Catalog Signals Only</option>
                <option value="gold">🥇 Gold Tier Signals</option>
                <option value="silver">🥈 Silver Tier Signals</option>
                <option value="bronze">🥉 Bronze Tier Signals</option>
              </select>
            </div>

            {/* Kind Filter */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setKindFilter('all')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  kindFilter === 'all'
                    ? 'bg-slate-800 text-slate-100 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Walls
              </button>
              <button
                onClick={() => setKindFilter('perm')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  kindFilter === 'perm'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🥇 Perm Only
              </button>
              <button
                onClick={() => setKindFilter('strong')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  kindFilter === 'strong'
                    ? 'bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ╌ Strong Only
              </button>
            </div>

            {/* ⭐ Wall Matches Toggle */}
            <button
              onClick={() => setWallMatchOnly(!wallMatchOnly)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                wallMatchOnly
                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50'
                  : 'bg-slate-950 text-amber-300 border-amber-500/30 hover:bg-amber-500/10'
              }`}
              title="Filter special days where Price Box Wall matches Date Box Translated Price Walls"
            >
              <Star className={`w-3.5 h-3.5 ${wallMatchOnly ? 'fill-slate-950 text-slate-950' : 'fill-amber-400 text-amber-400'}`} />
              <span>Wall Matches</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${wallMatchOnly ? 'bg-slate-950 text-amber-300 font-extrabold' : 'bg-amber-500/20 text-amber-300 font-bold'}`}>
                {wallMatchDatesCount}
              </span>
            </button>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'grid' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-all ${
                  viewMode === 'table' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Chronological Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar & Results Count */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 font-mono text-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search date, price or signal (e.g. Sun, 24000, Gold)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-xs">
            {(monthFilter !== 'all' || kindFilter !== 'all' || signalFilter !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setMonthFilter('all');
                  setKindFilter('all');
                  setSignalFilter('all');
                  setSearchQuery('');
                }}
                className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded border border-amber-500/30 transition-all font-mono"
                title="Reset all filters"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Filters
              </button>
            )}
            <div>
              Showing <b className="text-amber-300">{filteredBoxingDates.length}</b> of {allBoxingDates.length} projected dates
            </div>
          </div>
        </div>
      </div>

      {/* Main Content View */}
      {filteredBoxingDates.length === 0 ? (
        <div className="text-xs font-mono text-slate-500 py-16 text-center bg-slate-900/50 border border-dashed border-slate-800 rounded-xl space-y-2">
          <p>No boxing dates match the current filters or date range.</p>
          <p className="text-[11px] text-slate-600">Try changing the signal filter or widening search terms.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID / CARDS VIEW BY MONTH */
        <div className="space-y-8">
          {(Object.entries(monthlyGroups) as [string, BoxingDate[]][]).map(([monthName, dates]) => {
            const permInMonth = dates.filter((d) => d.kind === 'perm').length;

            return (
              <div key={monthName} className="space-y-3">
                {/* Month Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-serif text-lg font-bold text-amber-300 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-amber-400" />
                    {monthName}
                  </h3>
                  <div className="font-mono text-xs text-slate-400 flex items-center gap-3">
                    <span><b>{dates.length}</b> Dates</span>
                    <span className="text-amber-400 font-semibold">{permInMonth} Permanent</span>
                  </div>
                </div>

                {/* Date Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {dates.map((bd) => {
                    const isPerm = bd.kind === 'perm';
                    const daysFromAnchor = getDaysFromAnchor(bd.date);
                    const dayOfWeek = getDayOfWeekStr(bd.date);
                    const totalWalls = bd.perm.length + bd.strong.length;
                    const sigs = signalsByDateMap[bd.date] || [];
                    const matchInfo = wallMatchesMap[bd.date];
                    const hasWallMatch = matchInfo && matchInfo.matches.length > 0;

                    return (
                      <div
                        key={bd.date}
                        onClick={() => setSelectedDate(bd)}
                        className={`p-3.5 rounded-xl border font-mono transition-all cursor-pointer hover:scale-[1.02] shadow-lg flex flex-col justify-between space-y-3 relative ${
                          hasWallMatch
                            ? 'bg-slate-900 border-amber-400 shadow-amber-500/20 ring-1 ring-amber-400/50'
                            : sigs.length > 0
                            ? 'bg-slate-900 border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/20'
                            : isPerm
                            ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 shadow-amber-500/5'
                            : 'bg-slate-900/70 border-teal-500/30 hover:border-teal-400'
                        }`}
                      >
                        {/* Top Signal Ribbon if matches catalog */}
                        {sigs.length > 0 && (
                          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-slate-800">
                            <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              42 Signal Catalog Match
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                              {sigs[0].lift.toFixed(1)}× Lift
                            </span>
                          </div>
                        )}

                        {/* Special Price Box Wall Match Ribbon */}
                        {hasWallMatch && (
                          <div className="flex items-center justify-between gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-pulse" />
                              ⭐ PRICE WALL MATCH
                            </span>
                            <span className="font-mono text-amber-200">
                              {matchInfo.formattedMatches && matchInfo.formattedMatches.length > 0
                                ? matchInfo.formattedMatches.join(', ')
                                : matchInfo.matches.map((m) => m.toLocaleString()).join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Card Header */}
                        <div>
                          <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                            <div>
                              <div className="text-base font-bold text-slate-100 flex items-center gap-2">
                                <span>{bd.date}</span>
                                <span className="text-xs text-slate-400 font-normal">({dayOfWeek})</span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                <span>+{daysFromAnchor} days from anchor</span>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isPerm
                                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              }`}
                            >
                              {(() => {
                                const fw = isPerm ? (bd.perm[0] ?? bd.strong[0]) : (bd.strong[0] ?? bd.perm[0]);
                                return `${isPerm ? '🥇 PERM' : '╌ STRONG'}${fw ? ` @ ${fw.toLocaleString()}` : ''}`;
                              })()}
                            </span>
                          </div>

                          {/* Weekend or Snapped indicator */}
                          {bd.isWeekend && !bd.snappedFrom && (
                            <div className="mt-2 text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center gap-1 font-semibold">
                              <ShieldAlert className="w-3 h-3" />
                              Weekend Date ({dayOfWeek})
                            </div>
                          )}
                          {bd.snappedFrom && (
                            <div className="mt-2 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 font-semibold">
                              <Check className="w-3 h-3" />
                              Snapped to Mon (from {bd.snappedFrom})
                            </div>
                          )}
                        </div>

                        {/* 42 Signals Badges Block */}
                        {sigs.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] uppercase text-amber-300 font-bold">
                              Matched Catalog Signals ({sigs.length}):
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto no-scrollbar">
                              {sigs.map((sig) => (
                                <span
                                  key={sig.key}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                                  style={{
                                    backgroundColor: TIER_META[sig.tier].bg,
                                    color: TIER_META[sig.tier].color,
                                    border: `1px solid ${TIER_META[sig.tier].border}`
                                  }}
                                  title={sig.desc}
                                >
                                  <span>{TIER_META[sig.tier].icon}</span>
                                  <span>{sig.lift.toFixed(1)}× {sig.direction}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Wall Pills List */}
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
                            <span>Contributing Walls</span>
                            <span className="text-slate-300 font-bold">{totalWalls}</span>
                          </div>

                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar">
                            {/* Perm Wall Pills */}
                            {bd.perm.map((price) => {
                              const ring = Math.floor(price / 100);
                              const offset = ring % 36;
                              return (
                                <span
                                  key={`p-${price}`}
                                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1"
                                  title={`Perm Wall ${price.toLocaleString()} (Ring ${ring}, Offset ${offset})`}
                                >
                                  <span>{price.toLocaleString()}</span>
                                  <span className="text-[9px] text-amber-400 font-normal">({offset}d)</span>
                                </span>
                              );
                            })}

                            {/* Strong Wall Pills */}
                            {bd.strong.map((price) => {
                              const ring = Math.floor(price / 100);
                              const offset = ring % 36;
                              return (
                                <span
                                  key={`s-${price}`}
                                  className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 text-[11px] font-semibold flex items-center gap-1"
                                  title={`Strong Level ${price.toLocaleString()} (Ring ${ring}, Offset ${offset})`}
                                >
                                  <span>{price.toLocaleString()}</span>
                                  <span className="text-[9px] text-teal-400 font-normal">({offset}d)</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Sync Turn Targets Summary Row */}
                        <div className="space-y-1 pt-1 border-t border-slate-800/60">
                          <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3 text-amber-400" />
                              Sync Turn Targets
                            </span>
                            <span className="text-[9px] text-slate-400 font-normal">{(bd.syncPrices || []).length} levels</span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto no-scrollbar">
                            {(bd.syncPrices || []).slice(0, 6).map((sp) => (
                              <span key={sp} className="px-1.5 py-0.2 rounded bg-slate-950 border border-amber-500/30 text-amber-300 text-[10px] font-bold">
                                {sp.toLocaleString()}
                              </span>
                            ))}
                            {(bd.syncPrices || []).length > 6 && (
                              <span className="text-[9px] text-slate-500 self-center">
                                +{(bd.syncPrices || []).length - 6} more
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Footer click prompt */}
                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 hover:text-amber-300">
                          <span>Inspect planetary matrix & signals</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Day</th>
                  <th className="p-3">Days from Anchor</th>
                  <th className="p-3">Significance</th>
                  <th className="p-3">42 Signals Catalog Match</th>
                  <th className="p-3">Perm Walls (Gold)</th>
                  <th className="p-3">Strong Levels (Teal)</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                {filteredBoxingDates.map((bd) => {
                  const isPerm = bd.kind === 'perm';
                  const daysFromAnchor = getDaysFromAnchor(bd.date);
                  const dayOfWeek = getDayOfWeekStr(bd.date);
                  const sigs = signalsByDateMap[bd.date] || [];

                  return (
                    <tr
                      key={bd.date}
                      onClick={() => setSelectedDate(bd)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-all"
                    >
                      <td className="p-3 font-bold text-amber-300">{bd.date}</td>
                      <td className="p-3 text-slate-300">
                        {dayOfWeek}
                        {bd.isWeekend && !bd.snappedFrom && (
                          <span className="ml-1.5 text-[10px] text-rose-400 font-bold">(Wknd)</span>
                        )}
                        {bd.snappedFrom && (
                          <span className="ml-1.5 text-[10px] text-emerald-400 font-bold">(Snapped)</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">+{daysFromAnchor}d</td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isPerm
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                            }`}
                          >
                            {(() => {
                              const fw = isPerm ? (bd.perm[0] ?? bd.strong[0]) : (bd.strong[0] ?? bd.perm[0]);
                              return `${isPerm ? '🥇 Permanent' : '╌ Strong'}${fw ? ` @ ${fw.toLocaleString()}` : ''}`;
                            })()}
                          </span>
                          {wallMatchesMap[bd.date] && wallMatchesMap[bd.date].matches.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold font-mono flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              MATCH [{(wallMatchesMap[bd.date].formattedMatches || wallMatchesMap[bd.date].matches.map((m) => m.toLocaleString())).join(', ')}]
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {sigs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sigs.map((sig) => (
                              <span
                                key={sig.key}
                                className="px-2 py-0.5 rounded text-[10px] font-bold"
                                style={{
                                  backgroundColor: TIER_META[sig.tier].bg,
                                  color: TIER_META[sig.tier].color,
                                  border: `1px solid ${TIER_META[sig.tier].border}`
                                }}
                              >
                                {TIER_META[sig.tier].icon} {sig.lift.toFixed(1)}× {sig.direction}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {bd.perm.length > 0 ? (
                            bd.perm.map((p) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 font-bold text-[11px]"
                              >
                                {p.toLocaleString()}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {bd.strong.length > 0 ? (
                            bd.strong.map((p) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/30 text-[11px]"
                              >
                                {p.toLocaleString()}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <button className="text-xs text-amber-400 font-bold hover:underline">
                          Inspect &rarr;
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Boxing Date Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 font-mono text-xs max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-xl font-bold text-amber-300">
                    Boxing Date: {selectedDate.date}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedDate.kind === 'perm'
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    }`}
                  >
                    {selectedDate.kind === 'perm' ? '🥇 Permanent Wall Projection' : '╌ Strong Level Projection'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  +{getDaysFromAnchor(selectedDate.date)} calendar days from Anchor ({anchorDate})
                </p>
              </div>

              <button
                onClick={() => setSelectedDate(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 42 Signals Catalog Section in Modal */}
            {(() => {
              const modalSigs = signalsByDateMap[selectedDate.date] || [];
              if (modalSigs.length === 0) return null;

              return (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                  <h4 className="text-xs uppercase font-bold text-amber-300 tracking-wider flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    Matched 42-Signal Catalog Patterns ({modalSigs.length})
                  </h4>
                  <div className="space-y-2">
                    {modalSigs.map((sig) => (
                      <div
                        key={sig.key}
                        className="p-2.5 rounded-lg bg-slate-950 border flex items-center justify-between"
                        style={{ borderColor: TIER_META[sig.tier].border }}
                      >
                        <div>
                          <div className="font-bold text-slate-100 flex items-center gap-2 text-xs">
                            <span>{sig.desc}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Sample: {sig.nM} episodes · p-value: {sig.p} · CI: [{sig.ci[0]}, {sig.ci[1]}]
                          </div>
                        </div>
                        <span
                          className="px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap"
                          style={{
                            backgroundColor: TIER_META[sig.tier].bg,
                            color: TIER_META[sig.tier].color,
                            border: `1px solid ${TIER_META[sig.tier].border}`
                          }}
                        >
                          {TIER_META[sig.tier].icon} {sig.tier.toUpperCase()} {sig.lift.toFixed(2)}×
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Contributing Walls Detailed Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-bold text-amber-400 tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Contributing Wall Levels & 36-Cycle Harmonic Geometry
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                {selectedDate.perm.map((price) => {
                  const ring = Math.floor(price / 100);
                  const dayOffset = ring % 36;
                  const daysTotal = getDaysFromAnchor(selectedDate.date);
                  const cycleK = Math.floor((daysTotal - dayOffset) / 36);

                  return (
                    <div
                      key={`perm-${price}`}
                      className="p-3 rounded-lg bg-slate-950 border border-amber-500/30 flex items-center justify-between font-mono"
                    >
                      <div>
                        <div className="font-bold text-sm text-amber-300 flex items-center gap-2">
                          <span>Price: {price.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 font-normal">(Ring {ring})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Offset: <b className="text-amber-200">{dayOffset} days</b> · Cycle Step: <b className="text-amber-200">k = {cycleK}</b> ({dayOffset} + 36×{cycleK} = {daysTotal}d)
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-xs">
                        Permanent Wall
                      </span>
                    </div>
                  );
                })}

                {selectedDate.strong.map((price) => {
                  const ring = Math.floor(price / 100);
                  const dayOffset = ring % 36;
                  const daysTotal = getDaysFromAnchor(selectedDate.date);
                  const cycleK = Math.floor((daysTotal - dayOffset) / 36);

                  return (
                    <div
                      key={`strong-${price}`}
                      className="p-3 rounded-lg bg-slate-950 border border-teal-500/20 flex items-center justify-between font-mono"
                    >
                      <div>
                        <div className="font-bold text-sm text-teal-300 flex items-center gap-2">
                          <span>Price: {price.toLocaleString()}</span>
                          <span className="text-xs text-slate-400 font-normal">(Ring {ring})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Offset: <b className="text-teal-200">{dayOffset} days</b> · Cycle Step: <b className="text-teal-200">k = {cycleK}</b> ({dayOffset} + 36×{cycleK} = {daysTotal}d)
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-semibold">
                        Strong Level
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6 Price-Time Sync Targets Breakdown */}
            <div className="space-y-3 border-t border-slate-800 pt-3">
              <h4 className="text-xs uppercase font-bold text-amber-300 tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                Price-Time Turn Sync Targets (Ring Offsets: -12, -9, 0, +9, +12, +18)
              </h4>

              <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar pr-1">
                {(selectedDate.wallSyncs || [
                  ...selectedDate.perm.map((p) => computeSyncPricesForWall(p, 'perm')),
                  ...selectedDate.strong.map((p) => computeSyncPricesForWall(p, 'strong'))
                ]).map((ws) => (
                  <div key={`sync-${ws.wallPrice}`} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
                    <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-1.5">
                      <span className="font-bold text-amber-300 flex items-center gap-2">
                        <span>Wall Price: <strong>{ws.wallPrice.toLocaleString()}</strong></span>
                        <span className="text-slate-400 font-normal">(Ring {ws.wallRing})</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ws.kind === 'perm' ? 'bg-amber-400 text-slate-950' : 'bg-teal-500/20 text-teal-300'}`}>
                        {ws.kind === 'perm' ? '🥇 PERM WALL' : 'STRONG LEVEL'}
                      </span>
                    </div>

                    {/* 6 Sync Price Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 pt-1">
                      {SYNC_RING_OFFSETS.map((so, idx) => {
                        const syncRing = ws.syncRings[idx];
                        const syncPrice = ws.syncPrices[idx];
                        const isConjunction = so.offset === 0;

                        return (
                          <div
                            key={so.offset}
                            className={`p-2 rounded border text-center transition-all ${
                              isConjunction
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 ring-1 ring-amber-400/30'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="text-[9px] text-amber-400 font-semibold uppercase">{so.label}</div>
                            <div className="text-xs font-bold text-amber-300 mt-0.5">{syncPrice.toLocaleString()}</div>
                            <div className="text-[9px] text-slate-500">Ring {syncRing}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Matrix Planetary Aspect Alignment Check on this date */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <h4 className="text-xs uppercase font-bold text-slate-300 tracking-wider">
                Planetary Aspects in Matrix on {selectedDate.date}
              </h4>

              {matrix.data[selectedDate.date] ? (
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Active Aspect Hits in Matrix:</span>
                    <b className="text-amber-300">
                      {Object.values(matrix.data[selectedDate.date]).reduce((sum: number, hits: unknown) => sum + ((hits as MatrixHit[])?.length || 0), 0)} Total Hits
                    </b>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto no-scrollbar pt-1">
                    {Object.entries(matrix.data[selectedDate.date]).map(([ringStr, hits]) => {
                      const ringNum = Number(ringStr);
                      const priceVal = ringNum * 100;
                      const isMatchingWall =
                        selectedDate.perm.includes(priceVal) || selectedDate.strong.includes(priceVal);
                      const hitList = (hits as MatrixHit[]) || [];

                      return hitList.map((hit, hIdx) => {
                        const pMeta = PLANET_META[hit.p];
                        const aMeta = ASPECT_META[hit.a];

                        return (
                          <span
                            key={`${ringStr}-${hIdx}`}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 border ${
                              isMatchingWall
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-200 font-bold'
                                : 'bg-slate-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span style={{ color: pMeta?.color }}>{pMeta?.sym}</span>
                            <span>{hit.p}</span>
                            <span style={{ color: aMeta?.color }}>{aMeta?.sym}</span>
                            <span>@{priceVal.toLocaleString()}</span>
                          </span>
                        );
                      });
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 italic py-2 text-[11px]">
                  No matrix calculation data available for exact date {selectedDate.date} in current window.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => setSelectedDate(null)}
                className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-all"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
