import React, { useState, useMemo } from 'react';
import { MatrixData, MatrixHit, SignalDef } from '../types';
import { computeBoxBreakouts, computeBoxingDates, scanCriticalDates } from '../lib/matrix';
import { getSignal, TIER_META } from '../lib/signals';
import { Box, ChevronRight, ChevronDown, Sparkles, CalendarDays, Award } from 'lucide-react';

interface BoxBreakoutsTabProps {
  matrix: MatrixData;
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  orb: number;
  minHighlight: number;
}

export const BoxBreakoutsTab: React.FC<BoxBreakoutsTabProps> = ({
  matrix,
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  orb,
  minHighlight
}) => {
  const boxes = computeBoxBreakouts(
    matrix,
    dateFrom,
    dateTo,
    priceLo,
    priceHi,
    orb,
    minHighlight
  );

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

  const [openBoxes, setOpenBoxes] = useState<Record<number, boolean>>({ 0: true });

  const toggleBox = (id: number) => {
    setOpenBoxes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Overview header bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-sm font-semibold text-amber-300">
              Gann Box Breakout & Boxing Dates Engine
            </h4>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Identifies contained price channels between permanent walls, projects 36-harmonic Boxing Dates for each box, and matches 42 Signal Catalog events.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-mono text-slate-300 flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span><b>{boxes.length}</b> Boxes Formed</span>
          </div>
        </div>
      </div>

      {/* Box Cards */}
      {boxes.length === 0 ? (
        <div className="text-xs font-mono text-slate-500 py-12 text-center bg-slate-900/50 border border-dashed border-slate-800 rounded-xl">
          No boxes formed — need at least 2 permanent/strong walls. Try widening the price range or adjusting min-strength.
        </div>
      ) : (
        <div className="space-y-4">
          {boxes.map((box) => {
            const isOpen = !!openBoxes[box.id];
            const width = (box.ceil - box.floor) * 100;

            // Compute Boxing Dates for THIS box specifically
            const boxPermPrices = [box.floor * 100, box.ceil * 100];
            const boxStrongPrices = box.interior.map((i) => i * 100);
            const boxBoxingDates = computeBoxingDates(dateFrom, dateTo, boxPermPrices, boxStrongPrices, true);

            // Match 42 Signals for Box Boxing Dates
            const boxBoxingDateSignalsMap: Record<string, SignalDef[]> = {};
            boxBoxingDates.forEach((bd) => {
              const matched: SignalDef[] = [];
              const keysSet = new Set<string>();
              const targetDates = [bd.date];
              if (bd.snappedFrom && bd.snappedFrom !== bd.date) targetDates.push(bd.snappedFrom);

              targetDates.forEach((d) => {
                criticalEvents.forEach((ev) => {
                  if (ev.date === d && ev.sig && !keysSet.has(ev.sig.key)) {
                    keysSet.add(ev.sig.key);
                    matched.push(ev.sig);
                  }
                });

                const dayData = matrix.data[d];
                if (dayData) {
                  [...bd.perm, ...bd.strong].forEach((price) => {
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

              boxBoxingDateSignalsMap[bd.date] = matched;
            });

            const boxSignalMatchesCount = Object.values(boxBoxingDateSignalsMap).filter((s) => s.length > 0).length;

            return (
              <div
                key={box.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-xl overflow-hidden transition-all"
              >
                {/* Header Bar */}
                <div
                  onClick={() => toggleBox(box.id)}
                  className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800/60 cursor-pointer user-select-none transition-all border-b border-slate-800/80"
                >
                  <div className="flex items-center gap-3">
                    <button className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400">
                      {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="font-serif text-base font-bold text-amber-300 flex items-center gap-2">
                        Box #{box.id + 1}: {(box.floor * 100).toLocaleString()} — {(box.ceil * 100).toLocaleString()}
                        {box.edge === 'bottom' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 font-normal">
                            EDGE ▼
                          </span>
                        )}
                        {box.edge === 'top' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 font-normal">
                            EDGE ▲
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>Channel Width: <b className="text-slate-200">{width.toLocaleString()} pts</b></span>
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {boxBoxingDates.length} Boxing Dates ({boxSignalMatchesCount} Signal Matches)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                      {(box.floor * 100).toLocaleString()} Floor
                    </span>
                    <span className="text-slate-600">↔</span>
                    <span className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">
                      {(box.ceil * 100).toLocaleString()} Ceiling
                    </span>
                  </div>
                </div>

                {/* Box Body */}
                {isOpen && (
                  <div className="p-4 space-y-4 bg-slate-950/60 font-mono">
                    {/* Stat Line */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-400">
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <span>Width: <b className="text-amber-300">{width.toLocaleString()} pts</b></span>
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {boxBoxingDates.length} Projected Boxing Dates
                        </span>
                      </div>
                    </div>

                    {/* BOXING DATES FOR THIS BOX */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h5 className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          36-Harmonic Boxing Dates Projection for Box #{box.id + 1}
                        </h5>
                        <span className="text-xs text-slate-400">
                          <b>{boxBoxingDates.length}</b> projected dates in window
                        </span>
                      </div>

                      {boxBoxingDates.length === 0 ? (
                        <div className="text-xs text-slate-500 italic py-6 text-center">
                          No boxing dates projected within this date window for Box #{box.id + 1}.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {boxBoxingDates.map((bd) => {
                            const bdSigs = boxBoxingDateSignalsMap[bd.date] || [];
                            const isPerm = bd.kind === 'perm';

                            return (
                              <div
                                key={bd.date}
                                className={`p-3 rounded-xl border text-xs space-y-2 ${
                                  bdSigs.length > 0
                                    ? 'bg-slate-900 border-amber-400/80 shadow-amber-500/10 ring-1 ring-amber-400/30'
                                    : isPerm
                                    ? 'bg-slate-900/90 border-amber-500/30'
                                    : 'bg-slate-900/60 border-teal-500/20'
                                }`}
                              >
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                  <span className="font-bold text-amber-300 text-sm">{bd.date}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      isPerm ? 'bg-amber-400 text-slate-950' : 'bg-teal-500/20 text-teal-300'
                                    }`}
                                  >
                                    {isPerm ? '🥇 PERM' : 'STRONG'}
                                  </span>
                                </div>

                                {/* Matched 42 Signals Badges */}
                                {bdSigs.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                                      <Award className="w-3 h-3 text-amber-400" />
                                      42 Catalog Signal Match:
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {bdSigs.map((sig) => (
                                        <span
                                          key={sig.key}
                                          className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                          style={{
                                            backgroundColor: TIER_META[sig.tier].bg,
                                            color: TIER_META[sig.tier].color,
                                            border: `1px solid ${TIER_META[sig.tier].border}`
                                          }}
                                          title={sig.desc}
                                        >
                                          {TIER_META[sig.tier].icon} {sig.lift.toFixed(1)}× {sig.direction}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-slate-500 italic">No signal match on date</div>
                                )}

                                {/* Walls */}
                                <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-800/60">
                                  <span>Walls:</span>
                                  <div className="flex flex-wrap gap-1">
                                    {[...bd.perm, ...bd.strong].map((p) => (
                                      <span key={p} className="px-1 rounded bg-slate-950 border border-slate-800 font-mono text-slate-300">
                                        {p.toLocaleString()}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
