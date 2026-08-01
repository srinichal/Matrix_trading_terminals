import React from 'react';
import { MatrixData } from '../types';
import {
  ASPECT_META, PLANET_META, ZODIAC, ELEMENT_COLORS,
  getPositions, findAspect, findAspectAll, ALL_ASPECTS, MAJOR_ASPECTS,
  fmtDeg, signOf, rev, D2R
} from '../lib/astronomy';
import { Activity, ShieldCheck, TrendingUp, TrendingDown, RefreshCw, Eye } from 'lucide-react';
import { SIGNALS } from '../lib/signals';

interface OverviewTabProps {
  matrix: MatrixData;
  focusDate: string;
  onSelectFocusDate: (date: string) => void;
  orb: number;
  aspectMode: 'all' | 'major';
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  matrix,
  focusDate,
  onSelectFocusDate,
  orb,
  aspectMode
}) => {
  const { dates, data, ring_lo, ring_hi } = matrix;
  const nDays = dates.length;
  const nRings = ring_hi - ring_lo + 1;

  let totalHits = 0;
  let maxHit = 0;
  let ppCount = 0;

  for (const d of dates) {
    for (let r = ring_lo; r <= ring_hi; r++) {
      const h = (data[d] && data[d][r]) || [];
      totalHits += h.length;
      if (h.length > maxHit) maxHit = h.length;
      if (h.length >= 3) ppCount++;
    }
  }

  const focusDateObj = new Date(focusDate + 'T00:00:00Z');
  const positions = getPositions(focusDateObj);

  // SVG Orrery Math
  const CX = 200;
  const CY = 200;
  const polar = (r: number, deg: number) => {
    const a = (deg - 90) * D2R;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };

  const segPath = (rO: number, rI: number, d0: number, d1: number) => {
    const [x1, y1] = polar(rO, d0);
    const [x2, y2] = polar(rO, d1);
    const [x3, y3] = polar(rI, d1);
    const [x4, y4] = polar(rI, d0);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rO} ${rO} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${rI} ${rI} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace('#', '');
    return `rgba(${parseInt(h.substring(0, 2), 16)}, ${parseInt(h.substring(2, 4), 16)}, ${parseInt(h.substring(4, 6), 16)}, ${alpha})`;
  };

  const RZO = 185;
  const RZI = 155;
  const RTI = 148;
  const RTM = 140;
  const RP = 118;
  const RC = 32;

  const bodies = Object.entries(positions);

  return (
    <div className="space-y-6">
      {/* 1. Summary Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="text-2xl sm:text-3xl font-serif font-bold text-amber-300">
            {nDays}
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
            Dates Analyzed
          </div>
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-400/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="text-2xl sm:text-3xl font-serif font-bold text-amber-300">
            {nRings}
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
            Price Levels
          </div>
          <div className="absolute top-0 right-0 w-12 h-12 bg-amber-400/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="text-2xl sm:text-3xl font-serif font-bold text-amber-300">
            {aspectMode === 'all' ? 11 : 5}
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
            Aspect Filter
          </div>
          <div className="absolute top-0 right-0 w-12 h-12 bg-teal-400/5 rounded-bl-full pointer-events-none" />
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-center shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="text-2xl sm:text-3xl font-serif font-bold text-amber-300">
            {ppCount.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
            Pressure Points (≥3)
          </div>
          <div className="absolute top-0 right-0 w-12 h-12 bg-rose-400/5 rounded-bl-full pointer-events-none" />
        </div>
      </div>

      {/* 2. Orrery & Focus Date Longitudes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live SVG Orrery */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl relative overflow-hidden flex flex-col items-center justify-center">
          <div className="w-full flex items-center justify-between mb-2">
            <h3 className="font-serif text-sm font-semibold text-amber-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Geocentric Zodiac Wheel
            </h3>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              Focus: <b className="text-amber-300">{focusDate}</b>
            </span>
          </div>

          <svg viewBox="0 0 400 400" className="w-full max-w-[320px] h-auto my-2 drop-shadow-2xl">
            {/* Zodiac Segments */}
            {ZODIAC.map((z, s) => {
              const d0 = s * 30;
              const d1 = s * 30 + 30;
              const col = ELEMENT_COLORS[s % 4];
              const [sx, sy] = polar((RZO + RZI) / 2, d0 + 15);
              return (
                <g key={z[0]}>
                  <path
                    d={segPath(RZO, RZI, d0, d1)}
                    fill={hexToRgba(col, s % 2 === 0 ? 0.14 : 0.22)}
                    stroke="#1e2c48"
                    strokeWidth="0.6"
                  />
                  <text
                    x={sx.toFixed(1)}
                    y={(sy + 5).toFixed(1)}
                    textAnchor="middle"
                    fontSize="15"
                    fill={col}
                    fontFamily="Georgia, serif"
                  >
                    {z[1]}
                  </text>
                </g>
              );
            })}

            {/* Degree Ticks */}
            {Array.from({ length: 36 }).map((_, i) => {
              const t = i * 10;
              const [ax, ay] = polar(RZI, t);
              const [bx, by] = polar(t % 30 === 0 ? RTM : RTI, t);
              return (
                <line
                  key={t}
                  x1={ax.toFixed(1)}
                  y1={ay.toFixed(1)}
                  x2={bx.toFixed(1)}
                  y2={by.toFixed(1)}
                  stroke={t % 30 === 0 ? '#c9a227' : '#2a3858'}
                  strokeWidth={t % 30 === 0 ? 1 : 0.6}
                />
              );
            })}

            <circle cx={CX} cy={CY} r={RZO} fill="none" stroke="#c9a227" strokeWidth="1.2" opacity={0.7} />
            <circle cx={CX} cy={CY} r={RZI} fill="none" stroke="#1e2c48" strokeWidth="0.8" />
            <circle cx={CX} cy={CY} r={RP + 8} fill="none" stroke="#162038" strokeWidth="0.8" strokeDasharray="2 3" />

            {/* Aspect lines */}
            {bodies.map(([n1, p1], i) =>
              bodies.slice(i + 1).map(([n2, p2]) => {
                const asp = findAspect(p1.lon, p2.lon, orb, aspectMode === 'all' ? ALL_ASPECTS : (MAJOR_ASPECTS as Record<string, number>));
                if (!asp) return null;
                const [x1, y1] = polar(RP, p1.lon);
                const [x2, y2] = polar(RP, p2.lon);
                const meta = ASPECT_META[asp.name];
                const col = meta ? meta.color : '#3a4868';
                return (
                  <line
                    key={`${n1}-${n2}`}
                    x1={x1.toFixed(1)}
                    y1={y1.toFixed(1)}
                    x2={x2.toFixed(1)}
                    y2={y2.toFixed(1)}
                    stroke={col}
                    strokeWidth={meta && meta.major ? 1.2 : 0.7}
                    opacity={meta && meta.major ? 0.5 : 0.3}
                  />
                );
              })
            )}

            {/* Planets */}
            {bodies.map(([name, p]) => {
              const meta = PLANET_META[name as keyof typeof PLANET_META];
              if (!meta) return null;
              const [x, y] = polar(RP, p.lon);
              return (
                <g key={name}>
                  <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="13" fill={meta.color} opacity={0.15} />
                  <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="9.5" fill="#0b1220" stroke={meta.color} strokeWidth="1.1" />
                  <text
                    x={x.toFixed(1)}
                    y={(y + 3.5).toFixed(1)}
                    textAnchor="middle"
                    fontSize="11"
                    fill={meta.color}
                    fontFamily="Georgia, serif"
                  >
                    {meta.sym}
                  </text>
                  {p.retro && (
                    <text
                      x={(x + 10).toFixed(1)}
                      y={(y - 7).toFixed(1)}
                      fontSize="7.5"
                      fill="#e85a6a"
                      fontFamily="monospace"
                    >
                      ℞
                    </text>
                  )}
                </g>
              );
            })}

            <circle cx={CX} cy={CY} r={RC} fill="#0b1220" stroke="#c9a227" strokeWidth="0.8" />
            <text x={CX} y={CY - 2} textAnchor="middle" fill="#6a7090" fontSize="8" fontFamily="monospace">
              {focusDate}
            </text>
            <text x={CX} y={CY + 10} textAnchor="middle" fill="#e8c766" fontSize="8.5" fontFamily="Georgia, serif" fontStyle="italic">
              Live Orrery
            </text>
          </svg>

          <p className="text-[10px] font-mono text-slate-400 mt-2 text-center">
            Click any date header in the Matrix tab to sync this Orrery
          </p>
        </div>

        {/* Planet Longitudes Grid */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-serif text-sm font-semibold text-amber-300">
                  Focus Date Longitudes
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  Tropical geocentric positions for <span className="text-amber-200 font-semibold">{focusDate}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-[280px] no-scrollbar">
                {dates.slice(0, 5).map((d) => (
                  <button
                    key={d}
                    onClick={() => onSelectFocusDate(d)}
                    className={`px-2 py-1 text-[10px] font-mono rounded border transition-all ${
                      d === focusDate
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 font-bold'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {d.slice(5)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
              {bodies.map(([name, p]) => {
                const meta = PLANET_META[name as keyof typeof PLANET_META];
                if (!meta) return null;
                return (
                  <div
                    key={name}
                    className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 font-mono text-xs flex items-center justify-between shadow-sm hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-serif" style={{ color: meta.color }}>
                        {meta.sym}
                      </span>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400">
                          {name}
                        </div>
                        <div className="text-slate-200 font-medium">
                          {fmtDeg(p.lon)}
                        </div>
                      </div>
                    </div>
                    {p.retro && (
                      <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                        ℞
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>Geocentric ecliptic longitude (midnight UTC)</span>
            <span className="text-teal-400">Keplerian 2-body + perturbations</span>
          </div>
        </div>
      </div>

      {/* 3. Aspect Legend */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2.5">
          11-Aspect Color Legend & Classifications
        </h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ASPECT_META).map(([name, meta]) => {
            const hasSig = Object.keys(SIGNALS).some((k) => k.includes(`|${name}|`));
            return (
              <span
                key={name}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
                  meta.major ? 'font-semibold' : 'opacity-80'
                }`}
                style={{
                  borderColor: meta.color,
                  color: meta.color,
                  backgroundColor: `${meta.color}10`
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                {meta.sym} {name} ({meta.angle}°)
                {hasSig && <span className="text-[10px] text-amber-300 font-bold ml-0.5">★</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* 4. Containment Corridor & Scenario Cards */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <h3 className="font-serif text-sm font-semibold text-amber-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          Containment Corridor & Breakout Scenarios
        </h3>

        {/* Corridor Structure breakdown */}
        {(() => {
          const perm: number[] = [];
          const strong: number[] = [];
          const gaps: number[] = [];
          const minH = 3; // default threshold >=3

          for (let r = ring_lo; r <= ring_hi; r++) {
            let hits = 0;
            for (const d of dates) {
              if (data[d] && data[d][r] && data[d][r].length >= minH) hits++;
            }
            const p = hits / nDays;
            if (p >= 0.9) perm.push(r);
            else if (p >= 0.5) strong.push(r);
            else if (p < 0.15) gaps.push(r);
          }

          const mid = Math.round((ring_lo + ring_hi) / 2);
          const floor = perm.filter((r) => r <= mid).sort((a, b) => b - a)[0];
          const ceil = perm.filter((r) => r >= mid).sort((a, b) => a - b)[0];

          return (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 font-mono text-xs space-y-2 text-slate-300">
              <div className="text-[11px] uppercase tracking-widest text-amber-400 font-bold mb-2">
                Corridor Structure Analysis
              </div>
              <div>
                <b className="text-amber-300">Permanent Walls (≥90% days): </b>
                {perm.length > 0 ? (
                  perm.map((r) => (
                    <span key={r} className="inline-block px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 mr-1.5 my-0.5">
                      {(r * 100).toLocaleString()}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">None in range</span>
                )}
              </div>

              <div>
                <b className="text-emerald-400">Strong Levels (50–89%): </b>
                {strong.length > 0 ? (
                  strong.map((r) => (
                    <span key={r} className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 mr-1.5 my-0.5">
                      {(r * 100).toLocaleString()}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">None in range</span>
                )}
              </div>

              <div>
                <b className="text-slate-400">Gap Zones (&lt;15%): </b>
                {gaps.length > 0 ? (
                  gaps.map((r) => (
                    <span key={r} className="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 mr-1.5 my-0.5">
                      {(r * 100).toLocaleString()}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">None in range</span>
                )}
              </div>

              {floor && ceil && (
                <div className="pt-2 border-t border-slate-800/80 text-amber-200">
                  <b className="text-amber-300">Containment Corridor: </b>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    {(floor * 100).toLocaleString()}
                  </span>{' '}
                  floor ↔{' '}
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    {(ceil * 100).toLocaleString()}
                  </span>{' '}
                  ceiling · width <b className="text-amber-300">{((ceil - floor) * 100).toLocaleString()} pts</b>
                </div>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/80 border-t-4 border-emerald-500 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> ▲ Break Up Signals
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold">
                Bullish Lifts
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Watch for: <b className="text-amber-300">☿ Trine</b> leaving floor (2.5× lift),{' '}
              <b className="text-amber-300">♂ Opposition</b> leaving floor (5.0× lift),{' '}
              <b className="text-amber-300">☉ Semi-Square</b> leaving ceiling (3.5× lift), and{' '}
              <b className="text-amber-300">♀ Quintile</b> leaving ceiling (3.9× lift). Minor aspects represent the strongest historical upside breakout catalysts.
            </p>
          </div>

          <div className="bg-slate-950/80 border-t-4 border-amber-500 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-sm font-bold text-amber-300 flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4" /> ▬ Range Bound
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold">
                53% Base Probability
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Most common state in Nifty history. Ideal environment for options sellers (Iron Condors, Short Strangles). Walls remain intact when outer and slow planets maintain tight aspects to ring degrees.
            </p>
          </div>

          <div className="bg-slate-950/80 border-t-4 border-rose-500 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-sm font-bold text-rose-400 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" /> ▼ Break Down Signals
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold">
                Bearish Lifts
              </span>
            </div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Watch for: <b className="text-rose-300">☽ Square</b> leaving floor (1.5× DOWN),{' '}
              <b className="text-rose-300">♀ Square</b> leaving ceiling (2.7× DOWN). Simultaneous square departures from both containment sides trigger structural collapse events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
