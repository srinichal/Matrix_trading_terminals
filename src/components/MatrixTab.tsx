import React, { useState, useMemo } from 'react';
import { MatrixData, MatrixHit } from '../types';
import { ringToDegree, projectDeparture, fromIso, computeMatrix } from '../lib/matrix';
import { PLANET_META, ASPECT_META, ALL_ASPECTS, MAJOR_ASPECTS, signOf } from '../lib/astronomy';
import { getSignal, getAllSignals, TIER_META } from '../lib/signals';
import { Sliders, Check, RotateCcw, Info, Shield, Target, Code2 } from 'lucide-react';

interface MatrixTabProps {
  matrix: MatrixData;
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  dateStep: number;
  minHighlight: number;
  focusDate: string;
  onSelectFocusDate: (date: string) => void;
  globalOrb: number;
  matrixOrbOverride: number | null;
  onApplyMatrixOrb: (orb: number | null) => void;
  aspectMode: 'all' | 'major';
}

export const MatrixTab: React.FC<MatrixTabProps> = ({
  matrix,
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  dateStep,
  minHighlight,
  focusDate,
  onSelectFocusDate,
  globalOrb,
  matrixOrbOverride,
  onApplyMatrixOrb,
  aspectMode
}) => {
  const [localOrbInput, setLocalOrbInput] = useState<string>('');
  const [selectedCell, setSelectedCell] = useState<{ date: string; ring: number } | null>(null);

  // Market Price Row Highlight
  const [spotPriceInput, setSpotPriceInput] = useState<string>('24350');
  const [activeSpotPrice, setActiveSpotPrice] = useState<number | null>(24350);

  const spotRing = activeSpotPrice !== null ? Math.round(activeSpotPrice / 100) : null;

  const handleApplySpotPrice = () => {
    const val = parseFloat(spotPriceInput);
    if (!isNaN(val) && val > 0) {
      setActiveSpotPrice(val);
    }
  };

  const handleClearSpotPrice = () => {
    setSpotPriceInput('');
    setActiveSpotPrice(null);
  };

  const effectiveOrb = matrixOrbOverride !== null ? matrixOrbOverride : globalOrb;
  const activeAspects = useMemo(
    () => (aspectMode === 'all' ? ALL_ASPECTS : (MAJOR_ASPECTS as Record<string, number>)),
    [aspectMode]
  );

  // Recompute local matrix ONLY when matrixOrbOverride is active (exclusive to Matrix tab)
  const activeMatrix = useMemo(() => {
    if (matrixOrbOverride === null) {
      return matrix;
    }
    const ringLo = Math.floor(priceLo / 100);
    const ringHi = Math.ceil(priceHi / 100);
    return computeMatrix(
      dateFrom,
      dateTo,
      ringLo,
      ringHi,
      dateStep,
      matrixOrbOverride,
      activeAspects
    );
  }, [matrix, matrixOrbOverride, dateFrom, dateTo, priceLo, priceHi, dateStep, activeAspects]);

  const { dates, data, ring_lo, ring_hi } = activeMatrix;

  const rings: number[] = [];
  for (let r = ring_hi; r >= ring_lo; r--) rings.push(r);

  // Compute Corridor Wall Classifications (Permanent Wall >= 90%, Strong Wall >= 50%, Gap Zone < 15%)
  // ALWAYS computed from global matrix (global orb), so matrix orb override does NOT affect walls
  const wallClassifications = useMemo(() => {
    const totalDays = matrix.dates.length;
    if (totalDays === 0) return {};

    const map: Record<number, { type: 'perm' | 'strong' | 'gap' | 'normal'; frequency: number; hitDays: number }> = {};

    for (let r = matrix.ring_hi; r >= matrix.ring_lo; r--) {
      let hitDays = 0;
      for (const d of matrix.dates) {
        const h = (matrix.data[d] && matrix.data[d][r]) || [];
        if (h.length >= minHighlight) hitDays++;
      }
      const frequency = hitDays / totalDays;
      let type: 'perm' | 'strong' | 'gap' | 'normal' = 'normal';
      if (frequency >= 0.9) type = 'perm';
      else if (frequency >= 0.5) type = 'strong';
      else if (frequency < 0.15) type = 'gap';

      map[r] = { type, frequency, hitDays };
    }
    return map;
  }, [matrix, minHighlight]);

  const permWalls = rings.filter((r) => wallClassifications[r]?.type === 'perm');
  const strongWalls = rings.filter((r) => wallClassifications[r]?.type === 'strong');
  const gapZones = rings.filter((r) => wallClassifications[r]?.type === 'gap');

  const handleApplyOverride = () => {
    const val = parseFloat(localOrbInput);
    if (isNaN(val) || val <= 0) return;
    onApplyMatrixOrb(val);
  };

  const handleClearOverride = () => {
    setLocalOrbInput('');
    onApplyMatrixOrb(null);
  };

  const handleCellClick = (dateStr: string, ring: number) => {
    setSelectedCell({ date: dateStr, ring });
    onSelectFocusDate(dateStr);
  };

  // Inspect selected cell
  const hits: MatrixHit[] = selectedCell
    ? (data[selectedCell.date] && data[selectedCell.date][selectedCell.ring]) || []
    : [];

  const inspectPrice = selectedCell ? (selectedCell.ring * 100).toLocaleString() : '';
  const inspectDeg = selectedCell ? ringToDegree(selectedCell.ring).toFixed(1) : '';
  const inspectSign = selectedCell ? signOf(ringToDegree(selectedCell.ring)) : null;
  const selectedWall = selectedCell ? wallClassifications[selectedCell.ring] : null;

  return (
    <div className="space-y-4">
      {/* 1. Matrix Local Controls: Orb Override & Market Price Row Highlight */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Orb Override Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold">
                Matrix Local Orb Override
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Active Orb: <b className="text-teal-300">{effectiveOrb}°</b>
                {matrixOrbOverride !== null ? (
                  <span className="text-amber-300 ml-1.5 font-semibold">
                    (Exclusive Matrix Override)
                  </span>
                ) : (
                  <span className="text-slate-500 ml-1.5">(Global {globalOrb}°)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={localOrbInput}
              step={0.5}
              min={0.5}
              max={15}
              placeholder={globalOrb.toString()}
              onChange={(e) => setLocalOrbInput(e.target.value)}
              className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1 text-xs font-mono w-20 focus:outline-none focus:border-teal-400"
            />
            <button
              onClick={handleApplyOverride}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              Apply
            </button>
            {matrixOrbOverride !== null && (
              <button
                onClick={handleClearOverride}
                className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-all"
                title="Revert to global orb"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Market Price Highlight Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                Market Price Highlight
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {spotRing !== null ? (
                  <span>
                    Spot Price <b className="text-cyan-300">{activeSpotPrice?.toLocaleString()}</b> → Row <b className="text-cyan-300 font-bold">{(spotRing * 100).toLocaleString()}</b>
                  </span>
                ) : (
                  <span className="text-slate-500">Enter current market price to highlight row</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={spotPriceInput}
              step={10}
              placeholder="e.g. 24350"
              onChange={(e) => setSpotPriceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApplySpotPrice();
              }}
              className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1 text-xs font-mono w-28 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={handleApplySpotPrice}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
            >
              <Target className="w-3.5 h-3.5" />
              Highlight
            </button>
            {activeSpotPrice !== null && (
              <button
                onClick={handleClearSpotPrice}
                className="flex items-center gap-1 px-2 py-1 rounded-lg font-mono text-xs text-slate-400 bg-slate-800 border border-slate-700 hover:text-slate-200 transition-all"
                title="Clear market price highlight"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Corridor Wall Analysis Summary */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h4 className="font-serif text-sm font-bold text-amber-300">
              Corridor Wall Analysis (Gann Wheel Containment)
            </h4>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400">
              Wall threshold: <b className="text-amber-300">≥{minHighlight} hits</b>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          {/* Permanent Walls */}
          <div className="bg-slate-950 border border-amber-500/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-amber-300 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Permanent Walls (≥90%)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {permWalls.length} Levels
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {permWalls.length > 0 ? (
                permWalls.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-200 border border-amber-500/30 font-bold text-[11px]"
                  >
                    {(r * 100).toLocaleString()}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-[11px]">None in this price range</span>
              )}
            </div>
          </div>

          {/* Strong Walls */}
          <div className="bg-slate-950 border border-emerald-500/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-emerald-300 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Strong Levels (50–89%)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {strongWalls.length} Levels
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {strongWalls.length > 0 ? (
                strongWalls.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 font-bold text-[11px]"
                  >
                    {(r * 100).toLocaleString()}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 text-[11px]">None in this price range</span>
              )}
            </div>
          </div>

          {/* Gap Zones */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
                Gap Zones (&lt;15%)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                {gapZones.length} Levels
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Low planetary resistance. Price moves fluidly between corridor boundaries.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Matrix Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl overflow-x-auto relative">
        <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
          <span>
            <b>{dates.length}</b> dates × <b>{ring_hi - ring_lo + 1}</b> rings ={' '}
            <b className="text-amber-300">{(dates.length * (ring_hi - ring_lo + 1)).toLocaleString()}</b> cells
          </span>
          <span className="text-slate-500">
            Aspects: <b className="text-slate-300">{aspectMode === 'all' ? 'All 11' : 'Major 5'}</b>
          </span>
        </div>

        <div className="max-h-[600px] overflow-y-auto no-scrollbar rounded-lg border border-slate-800/80">
          <table className="w-full text-center border-collapse font-mono text-xs">
            <thead className="sticky top-0 z-20 bg-slate-900 border-b-2 border-slate-800">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-900 px-3 py-2 text-right text-slate-400 font-semibold border-r border-slate-800 min-w-[120px]">
                  Price & Wall
                </th>
                {dates.map((d) => {
                  const isFocused = d === focusDate;
                  return (
                    <th
                      key={d}
                      onClick={() => onSelectFocusDate(d)}
                      className={`px-2 py-2 cursor-pointer transition-all min-w-[55px] ${
                        isFocused
                          ? 'bg-amber-400/20 text-amber-300 font-bold border-b-2 border-amber-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                      title={d}
                    >
                      {d.slice(5)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rings.map((r) => {
                const wall = wallClassifications[r];
                const isPerm = wall?.type === 'perm';
                const isStrong = wall?.type === 'strong';
                const isGap = wall?.type === 'gap';
                const isSpotRow = spotRing !== null && r === spotRing;

                let priceColBg = 'bg-slate-950 text-amber-300 border-r border-slate-800/80';
                if (isSpotRow) {
                  priceColBg =
                    'bg-cyan-950/90 text-cyan-200 border-r border-cyan-400 border-y-2 border-y-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)] z-20';
                } else if (isPerm) {
                  priceColBg =
                    'bg-amber-500/15 text-amber-300 border-r border-amber-500/40 border-l-4 border-l-amber-400';
                } else if (isStrong) {
                  priceColBg =
                    'bg-emerald-500/15 text-emerald-300 border-r border-emerald-500/40 border-l-4 border-l-emerald-400';
                }

                return (
                  <tr
                    key={r}
                    className={`border-b transition-all ${
                      isSpotRow
                        ? 'bg-cyan-500/10 border-y-2 border-y-cyan-400/80 font-bold'
                        : isPerm
                        ? 'border-slate-800/40 bg-amber-500/5'
                        : isStrong
                        ? 'border-slate-800/40 bg-emerald-500/5'
                        : 'border-slate-800/40 hover:bg-slate-900/30'
                    }`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-1.5 text-right font-bold transition-all ${priceColBg}`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{(r * 100).toLocaleString()}</span>
                        {isSpotRow && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-cyan-400 text-slate-950 uppercase shadow-[0_0_8px_rgba(34,211,238,0.8)] border border-cyan-200">
                            🎯 SPOT ({activeSpotPrice?.toLocaleString()})
                          </span>
                        )}
                        {isPerm && !isSpotRow && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-tighter">
                            PERM
                          </span>
                        )}
                        {isStrong && !isSpotRow && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-extrabold bg-emerald-400 text-slate-950 uppercase tracking-tighter">
                            STRONG
                          </span>
                        )}
                        {isGap && !isSpotRow && (
                          <span className="px-1 py-0.2 rounded text-[8px] font-medium bg-slate-800 text-slate-500 uppercase">
                            GAP
                          </span>
                        )}
                      </div>
                    </td>
                    {dates.map((d) => {
                      const dayHits = (data[d] && data[d][r]) || [];
                      const n = dayHits.length;
                      const isFocused = d === focusDate;
                      const isSelectedCell = selectedCell?.date === d && selectedCell?.ring === r;

                      // Heatmap color classes
                      let cellBg = 'text-slate-600';
                      if (n === 1) cellBg = 'text-slate-400 bg-slate-900/30';
                      else if (n === 2) cellBg = 'text-slate-300 bg-slate-800/40';
                      else if (n === 3) cellBg = 'text-amber-300 bg-amber-500/10 font-semibold';
                      else if (n === 4) cellBg = 'text-amber-400 bg-amber-500/20 font-bold';
                      else if (n >= 5) cellBg = 'text-rose-400 bg-rose-500/25 font-bold ring-1 ring-rose-500/40';

                      return (
                        <td
                          key={d}
                          onClick={() => handleCellClick(d, r)}
                          className={`px-2 py-1 cursor-pointer transition-all ${cellBg} ${
                            isSpotRow ? 'border-y-2 border-y-cyan-400/70 bg-cyan-500/15 text-cyan-200 font-extrabold shadow-[inset_0_0_8px_rgba(34,211,238,0.15)]' : ''
                          } ${
                            isFocused ? 'bg-amber-400/10' : ''
                          } ${
                            isSelectedCell
                              ? 'ring-2 ring-amber-400 shadow-lg z-10 scale-105'
                              : 'hover:outline hover:outline-1 hover:outline-amber-400/60'
                          }`}
                        >
                          {n || ''}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Heatmap Scale & Wall Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-900/50 border border-slate-800 inline-block" />
            0-1 Hits
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-800/40 border border-slate-700 inline-block" />
            2 Hits
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 inline-block" />
            3 Hits (PP)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 inline-block" />
            4 Hits (Strong)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 inline-block" />
            5+ Hits (Hard Wall)
          </span>
          <span className="ml-auto flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950">PERM</span>
            <span>≥90% Wall</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-400 text-slate-950 ml-2">STRONG</span>
            <span>≥50% Wall</span>
          </span>
        </div>
      </div>

      {/* 4. Detailed Cell Inspector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 via-teal-400 to-rose-400 opacity-60" />

        {selectedCell ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-bold text-amber-300">
                    Cell Analysis: Price {inspectPrice}
                  </h3>
                  {selectedWall?.type === 'perm' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-400 text-slate-950 uppercase">
                      Permanent Wall
                    </span>
                  )}
                  {selectedWall?.type === 'strong' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-400 text-slate-950 uppercase">
                      Strong Level
                    </span>
                  )}
                  {selectedWall?.type === 'gap' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 uppercase">
                      Gap Zone
                    </span>
                  )}
                </div>

                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Ring {selectedCell.ring} → {inspectDeg}° {inspectSign?.sym} ({inspectSign?.name}) on{' '}
                  <span className="text-amber-200 font-semibold">{selectedCell.date}</span>
                  {selectedWall && (
                    <span className="ml-2 text-slate-500">
                      (Present on {selectedWall.hitDays}/{dates.length} dates = Math.round({selectedWall.frequency * 100}%) freq)
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-300">
                  Hits: <b className="text-amber-300">{hits.length}</b> planets within ±{effectiveOrb}°
                </span>
              </div>
            </div>

            {hits.length === 0 ? (
              <p className="text-xs font-mono text-slate-400 py-4">
                No planet within ±{effectiveOrb}° of {inspectDeg}° — this is a gap zone. Price passes through freely without planetary containment resistance.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Planets at Pressure */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-amber-300/80 font-semibold">
                    Planets at Pressure
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {hits.map((hit, idx) => {
                      const pMeta = PLANET_META[hit.p];
                      const aspMeta = ASPECT_META[hit.a];
                      const floorSig = getSignal(hit.p, hit.a, 'depart', 'floor');
                      const ceilSig = getSignal(hit.p, hit.a, 'depart', 'ceiling');
                      const bestSig = [floorSig, ceilSig].filter(Boolean).sort((a, b) => b!.lift - a!.lift)[0];

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs shadow-sm"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: aspMeta?.color || '#888' }} />
                          <span style={{ color: pMeta?.color || '#fff' }}>{pMeta?.sym}</span>
                          <span className="text-slate-200 font-medium">{hit.p}</span>
                          <span style={{ color: aspMeta?.color || '#ccc' }}>{aspMeta?.abbr || hit.a}</span>
                          <span className="text-slate-500">({hit.o}°)</span>
                          {bestSig && (
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                              style={{
                                backgroundColor: TIER_META[bestSig.tier].bg,
                                color: TIER_META[bestSig.tier].color,
                                border: `1px solid ${TIER_META[bestSig.tier].border}`
                              }}
                            >
                              {TIER_META[bestSig.tier].icon} {bestSig.lift.toFixed(1)}×
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Departure Projections */}
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-amber-300/80 font-semibold">
                    Departure Projections & Signals
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-left font-mono text-xs border-collapse">
                      <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                        <tr>
                          <th className="p-2">Body</th>
                          <th className="p-2">Aspect</th>
                          <th className="p-2">Departs</th>
                          <th className="p-2">Days</th>
                          <th className="p-2">Signal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                        {hits.map((hit, idx) => {
                          const proj = projectDeparture(
                            fromIso(selectedCell.date),
                            hit.p,
                            selectedCell.ring,
                            hit.a,
                            effectiveOrb
                          );
                          const pMeta = PLANET_META[hit.p];
                          const aspMeta = ASPECT_META[hit.a];
                          const floorSigs = getAllSignals(hit.p, hit.a, 'depart', 'floor');
                          const ceilSigs = getAllSignals(hit.p, hit.a, 'depart', 'ceiling');
                          const allSigs = [...floorSigs, ...ceilSigs];

                          return (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="p-2">
                                <span style={{ color: pMeta?.color }}>{pMeta?.sym}</span> {hit.p}
                              </td>
                              <td className="p-2" style={{ color: aspMeta?.color }}>
                                {aspMeta?.abbr || hit.a}
                              </td>
                              <td className="p-2 text-amber-300 font-semibold">
                                {proj.date || '—'}
                              </td>
                              <td className="p-2 text-slate-400">
                                {proj.days !== null ? `${proj.days}d` : '>365d'}
                              </td>
                              <td className="p-2">
                                {allSigs.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {allSigs.map((s) => (
                                      <span
                                        key={s.key}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                        style={{
                                          backgroundColor: TIER_META[s.tier].bg,
                                          color: TIER_META[s.tier].color,
                                          border: `1px solid ${TIER_META[s.tier].border}`
                                        }}
                                      >
                                        {TIER_META[s.tier].icon} {s.lift.toFixed(1)}× {s.direction}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 font-mono text-xs space-y-2">
            <Info className="w-6 h-6 text-amber-400 mx-auto opacity-80" />
            <p>Click any cell in the Gann Matrix grid above to inspect planet aspect alignments & projected departure timing.</p>
          </div>
        )}
      </div>
    </div>
  );
};
