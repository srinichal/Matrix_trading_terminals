import React, { useState, useMemo } from 'react';
import { MatrixData, BoxBreakoutData, DepartureEvent, MatrixHit, SignalDef } from '../types';
import { computeBoxBreakouts, computeBoxingDates, scanCriticalDates, fromIso } from '../lib/matrix';
import { PLANET_META, ASPECT_META } from '../lib/astronomy';
import { getSignal, TIER_META } from '../lib/signals';
import { Box, ChevronRight, ChevronDown, Zap, ShieldAlert, Sparkles, Filter, Code2, CalendarDays, Award } from 'lucide-react';

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
  const [levelFilter, setLevelFilter] = useState<Record<number, string>>({});
  const [typeFilter, setTypeFilter] = useState<Record<number, string>>({});
  const [activeBoxSubTab, setActiveBoxSubTab] = useState<Record<number, 'deps' | 'boxingdates'>>({});

  const toggleBox = (id: number) => {
    setOpenBoxes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const setBoxLevelFilter = (boxId: number, ringStr: string) => {
    setLevelFilter((prev) => ({ ...prev, [boxId]: ringStr }));
  };

  const setBoxTypeFilter = (boxId: number, typeStr: string) => {
    setTypeFilter((prev) => ({ ...prev, [boxId]: typeStr }));
  };

  const setBoxSubTab = (boxId: number, tab: 'deps' | 'boxingdates') => {
    setActiveBoxSubTab((prev) => ({ ...prev, [boxId]: tab }));
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
            <span className="text-slate-600">|</span>
            <span className="text-amber-300 font-bold">
              {boxes.reduce((s, b) => s + b.levels.reduce((s2, l) => s2 + l.departures.filter((d) => d.sig).length, 0), 0)} Signal Events
            </span>
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
            const selectedLvl = levelFilter[box.id] || 'all';
            const selectedType = typeFilter[box.id] || 'all';
            const subTab = activeBoxSubTab[box.id] || 'deps';

            // Flatten all departures for this box
            const allDeps: (DepartureEvent & { levelLabel: string; kind: 'perm' | 'strong' })[] = [];
            box.levels.forEach((lv) => {
              lv.departures.forEach((dep) => {
                allDeps.push({ ...dep, levelLabel: lv.label, kind: lv.kind });
              });
            });
            allDeps.sort((a, b) => a.date.localeCompare(b.date));

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

            // Apply filters to departures
            const filteredDeps = allDeps.filter((dep) => {
              if (selectedLvl !== 'all' && dep.ring.toString() !== selectedLvl) return false;
              if (selectedType === 'sig' && !dep.sig) return false;
              if (selectedType === 'gold' && dep.sig?.tier !== 'gold') return false;
              if (selectedType === 'silver' && dep.sig?.tier !== 'silver') return false;
              if (selectedType === 't3' && (dep.tScore || 0) < 3) return false;
              if (selectedType === 'perm' && dep.kind !== 'perm') return false;
              if (selectedType === 'strong' && dep.kind !== 'strong') return false;
              return true;
            });

            const goldDeps = allDeps.filter((d) => d.sig?.tier === 'gold').length;
            const silverDeps = allDeps.filter((d) => d.sig?.tier === 'silver').length;
            const bronzeDeps = allDeps.filter((d) => d.sig?.tier === 'bronze').length;
            const wallDrops = allDeps.filter((d) => d.wallDrop).length;
            const tightOrbs = allDeps.filter((d) => d.minOrb && d.minOrb <= 3 && !d.isWallDropOnly).length;

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
                        <span>Total Departures: <b className="text-slate-200">{allDeps.length}</b></span>
                        <span>
                          🥇 <b className="text-amber-300">{goldDeps}</b> · 🥈 <b className="text-slate-300">{silverDeps}</b> · 🥉 <b className="text-amber-600">{bronzeDeps}</b>
                        </span>
                        <span>Wall Drops: <b className="text-rose-400">{wallDrops}</b></span>
                      </div>

                      {/* Sub tab buttons for Box */}
                      <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800">
                        <button
                          onClick={() => setBoxSubTab(box.id, 'deps')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                            subTab === 'deps'
                              ? 'bg-amber-400 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          ⚡ Chronological Departures ({allDeps.length})
                        </button>
                        <button
                          onClick={() => setBoxSubTab(box.id, 'boxingdates')}
                          className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                            subTab === 'boxingdates'
                              ? 'bg-amber-400 text-slate-950'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <CalendarDays className="w-3.5 h-3.5" />
                          <span>📅 Box Boxing Dates ({boxBoxingDates.length})</span>
                          {boxSignalMatchesCount > 0 && (
                            <span className="px-1.5 py-0.2 text-[10px] rounded bg-amber-500 text-slate-950 font-black">
                              ★ {boxSignalMatchesCount}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Level List */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                        Box Structural Levels (Click to filter)
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {box.levels.map((lv) => {
                          const nDep = lv.departures.length;
                          const nSig = lv.departures.filter((d) => d.sig).length;
                          const isSel = selectedLvl === lv.ring.toString();

                          return (
                            <div
                              key={lv.ring}
                              onClick={() => setBoxLevelFilter(box.id, isSel ? 'all' : lv.ring.toString())}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                isSel
                                  ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold shadow-md'
                                  : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-200">
                                  {(lv.ring * 100).toLocaleString()}
                                </span>
                                <span className="text-[10px] uppercase text-slate-400">
                                  {lv.label} ({lv.kind})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                                <span>{nDep} departures</span>
                                {nSig > 0 && (
                                  <span className="text-amber-300 font-bold">
                                    {nSig} signals ★
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* SUBTAB 1: DEPARTURES TABLE */}
                    {subTab === 'deps' && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h5 className="text-[10px] uppercase tracking-widest text-amber-300 font-semibold">
                            Chronological Departures ({filteredDeps.length})
                          </h5>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">Filter:</span>
                            <select
                              value={selectedType}
                              onChange={(e) => setBoxTypeFilter(box.id, e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                            >
                              <option value="all">All Types</option>
                              <option value="sig">Signals Only ★</option>
                              <option value="gold">🥇 Gold</option>
                              <option value="silver">🥈 Silver</option>
                              <option value="t3">⚡⚡⚡ Score 3</option>
                              <option value="perm">Permanent Walls</option>
                              <option value="strong">Strong Levels</option>
                            </select>
                          </div>
                        </div>

                        <div className="max-h-[350px] overflow-y-auto no-scrollbar rounded-lg border border-slate-800">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                              <tr>
                                <th className="p-2.5">Date</th>
                                <th className="p-2.5">Level</th>
                                <th className="p-2.5">Type</th>
                                <th className="p-2.5">Body</th>
                                <th className="p-2.5">Aspect</th>
                                <th className="p-2.5">Min Orb</th>
                                <th className="p-2.5">Wall Drop</th>
                                <th className="p-2.5">Timing Score</th>
                                <th className="p-2.5">Signal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                              {filteredDeps.map((dep, idx) => {
                                const pMeta = PLANET_META[dep.body as keyof typeof PLANET_META];
                                const aspMeta = ASPECT_META[dep.aspect as keyof typeof ASPECT_META];

                                const scoreLabels = ['—', '⚡', '⚡⚡', '⚡⚡⚡'];
                                const finalTScore = dep.tScore || 0;

                                return (
                                  <tr key={idx} className="hover:bg-slate-800/40 transition-all">
                                    <td className="p-2.5 text-amber-300 font-semibold">{dep.date}</td>
                                    <td className="p-2.5 font-bold text-slate-200">
                                      {(dep.ring * 100).toLocaleString()}
                                    </td>
                                    <td className="p-2.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                        dep.kind === 'perm' ? 'bg-amber-500/10 text-amber-300' : 'bg-teal-500/10 text-teal-300'
                                      }`}>
                                        {dep.levelLabel}
                                      </span>
                                    </td>
                                    <td className="p-2.5">
                                      {dep.isWallDropOnly ? (
                                        <span className="text-rose-400 text-[11px] font-bold">Wall Collapse</span>
                                      ) : (
                                        <span>
                                          <span style={{ color: pMeta?.color }}>{pMeta?.sym}</span> {dep.body}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5" style={{ color: aspMeta?.color }}>
                                      {aspMeta?.sym} {dep.aspect}
                                    </td>
                                    <td className="p-2.5">
                                      {!dep.isWallDropOnly && dep.minOrb !== undefined && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                          dep.minOrb <= 3 ? 'bg-emerald-500/10 text-emerald-400 font-bold' : 'text-slate-400'
                                        }`}>
                                          ≤{dep.minOrb.toFixed(1)}°
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5">
                                      {dep.wallDrop && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 font-bold">
                                          {dep.wallStrBefore}→{dep.wallStrAfter}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        finalTScore >= 3
                                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                          : finalTScore >= 2
                                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                                          : 'bg-slate-800 text-slate-400'
                                      }`}>
                                        {scoreLabels[finalTScore]} {finalTScore}/3
                                      </span>
                                    </td>
                                    <td className="p-2.5">
                                      {dep.sig ? (
                                        <span
                                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                                          style={{
                                            backgroundColor: TIER_META[dep.sig.tier].bg,
                                            color: TIER_META[dep.sig.tier].color,
                                            border: `1px solid ${TIER_META[dep.sig.tier].border}`
                                          }}
                                        >
                                          {TIER_META[dep.sig.tier].icon} {dep.sig.lift.toFixed(1)}× {dep.sig.direction}
                                        </span>
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
                    )}

                    {/* SUBTAB 2: BOXING DATES FOR THIS BOX */}
                    {subTab === 'boxingdates' && (
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
                    )}
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
