import React, { useState } from 'react';
import { PlanetName, AspectName, IntradayPPPoint } from '../types';
import {
  getPositions, findAspectAll, findAspect, angDiff, fmtDeg, signOf, rev,
  ALL_ASPECTS, MAJOR_ASPECTS, PLANET_META, ASPECT_META, ZODIAC, ELEMENT_COLORS, D2R
} from '../lib/astronomy';
import { P_START, P_SCALE, RING_SIZE, ringToDegree, fromIso, iso } from '../lib/matrix';
import { Target, RefreshCw, Layers, Sliders, ArrowUpDown } from 'lucide-react';

export const IntradayTab: React.FC = () => {
  const [intraDate, setIntraDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [intraPrice, setIntraPrice] = useState<string>('24350');
  const [intraOrb, setIntraOrb] = useState<number>(5);
  const [intraRing, setIntraRing] = useState<number>(5);
  const [useMinor, setUseMinor] = useState<boolean>(true);
  const [minCount, setMinCount] = useState<number>(2);
  const [ppSort, setPPSort] = useState<'strength' | 'point'>('strength');

  const handlePriceChange = (valStr: string) => {
    setIntraPrice(valStr);
    const price = parseFloat(valStr);
    if (!isNaN(price)) {
      const val = price / 100;
      const ringIndex = Math.max(0, Math.floor((val - P_START) / RING_SIZE));
      setIntraRing(ringIndex);
    }
  };

  const syncRingToPrice = () => {
    const price = parseFloat(intraPrice);
    if (isNaN(price)) return;
    const val = price / 100;
    const ringIndex = Math.max(0, Math.floor((val - P_START) / RING_SIZE));
    setIntraRing(ringIndex);
  };

  const getIntraDegree = (price: number) => {
    if (isNaN(price)) return null;
    return rev((price / 100 - P_START) * P_SCALE);
  };

  const dateObj = fromIso(intraDate);
  const positions = getPositions(dateObj);
  const priceVal = parseFloat(intraPrice);
  const hasPrice = !isNaN(priceVal);

  const ringStart = P_START + intraRing * RING_SIZE;
  const ringEnd = ringStart + RING_SIZE - 1;
  const nearestInt = hasPrice ? Math.min(ringEnd, Math.max(ringStart, Math.round(priceVal / 100))) : null;
  const priceDeg = hasPrice ? getIntraDegree(priceVal) : null;

  const aspTable = useMinor ? ALL_ASPECTS : (MAJOR_ASPECTS as Record<string, number>);

  // 1. Ring scan points
  const ringScanPoints: IntradayPPPoint[] = [];
  const coverage: Record<string, number> = {};
  Object.keys(positions).forEach((k) => (coverage[k] = 0));

  for (let n = 0; n < RING_SIZE; n++) {
    const deg = rev(n * P_SCALE);
    const hits: IntradayPPPoint['hits'] = [];

    for (const [name, p] of Object.entries(positions)) {
      const sep = angDiff(p.lon, deg);
      for (const [aspName, aspAngle] of Object.entries(aspTable)) {
        if (Math.abs(sep - aspAngle) <= intraOrb) {
          hits.push({ planet: name as PlanetName, aspect: aspName as AspectName, orb: Math.abs(sep - aspAngle) });
          coverage[name]++;
          break;
        }
      }
    }
    hits.sort((a, b) => a.orb - b.orb);
    const num = ringStart + n;
    ringScanPoints.push({
      point: n,
      number: num,
      deg,
      price: num * 100,
      hits,
      strength: hits.length
    });
  }

  const filteredPoints = ringScanPoints.filter((p) => p.strength >= minCount);
  if (ppSort === 'strength') {
    filteredPoints.sort((a, b) => b.strength - a.strength || a.point - b.point);
  } else {
    filteredPoints.sort((a, b) => a.point - b.point);
  }

  // 2. Price Node Aspect Map
  const priceNodeAspects: { planet: PlanetName; aspect: AspectName; lon: number; targetDeg: number; orb: number }[] = [];
  if (priceDeg !== null) {
    for (const [name, p] of Object.entries(positions)) {
      const sep = angDiff(priceDeg, p.lon);
      for (const [aspName, aspAngle] of Object.entries(aspTable)) {
        const o = Math.abs(sep - aspAngle);
        if (o <= intraOrb) {
          priceNodeAspects.push({
            planet: name as PlanetName,
            aspect: aspName as AspectName,
            lon: p.lon,
            targetDeg: priceDeg,
            orb: o
          });
          break;
        }
      }
    }
    priceNodeAspects.sort((a, b) => a.orb - b.orb);
  }

  // 3. SVG High-Res Orrery with Price Ring
  const CXW = 380;
  const CYW = 380;
  const polarW = (r: number, deg: number) => {
    const a = (deg - 90) * D2R;
    return [CXW + r * Math.cos(a), CYW + r * Math.sin(a)];
  };

  const segPathW = (rO: number, rI: number, d0: number, d1: number) => {
    const [x1, y1] = polarW(rO, d0);
    const [x2, y2] = polarW(rO, d1);
    const [x3, y3] = polarW(rI, d1);
    const [x4, y4] = polarW(rI, d0);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rO} ${rO} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${x3.toFixed(1)} ${y3.toFixed(1)} A ${rI} ${rI} 0 0 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
  };

  const RZO = 360;
  const RZI = 300;
  const RTM = 284;
  const RTI = 292;
  const RPB = 235;
  const PRO = 210;
  const PRI = 170;
  const RC = 55;

  const hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace('#', '');
    return `rgba(${parseInt(h.substring(0, 2), 16)}, ${parseInt(h.substring(2, 4), 16)}, ${parseInt(h.substring(4, 6), 16)}, ${alpha})`;
  };

  const bodies = Object.entries(positions);

  // Active aspects between planet pairs
  const activeAspectPairs: { n1: string; n2: string; asp: { name: string; orb: number } }[] = [];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const [n1, p1] = bodies[i];
      const [n2, p2] = bodies[j];
      const asp = findAspectAll(p1.lon, p2.lon, intraOrb);
      if (asp) activeAspectPairs.push({ n1, n2, asp });
    }
  }
  activeAspectPairs.sort((a, b) => a.asp.orb - b.asp.orb);

  return (
    <div className="space-y-6">
      {/* Intraday Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-end gap-3.5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Date
          </label>
          <input
            type="date"
            value={intraDate}
            onChange={(e) => setIntraDate(e.target.value)}
            className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 w-36"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Index Price
          </label>
          <input
            type="number"
            value={intraPrice}
            step={1}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="e.g. 24350"
            className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 w-32"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Orb Tolerance (°)
          </label>
          <input
            type="number"
            value={intraOrb}
            step={0.5}
            min={1}
            max={10}
            onChange={(e) => setIntraOrb(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 w-20"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            Ring Index
          </label>
          <input
            type="number"
            value={intraRing}
            onChange={(e) => setIntraRing(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-400 w-20"
          />
        </div>

        <div className="flex items-center gap-2 pb-2">
          <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={useMinor}
              onChange={(e) => setUseMinor(e.target.checked)}
              className="rounded accent-amber-400"
            />
            Include Minor Aspects
          </label>
        </div>

        <button
          onClick={syncRingToPrice}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-mono text-xs font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 transition-all ml-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Sync Ring to Price
        </button>
      </div>

      {/* 1. Pressure Points - Ring Scan */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="font-serif text-sm font-semibold text-amber-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-amber-400" />
              Pressure Points — Ring {intraRing} Scan ({ringStart}–{ringEnd})
            </h4>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              Price Range: {(ringStart * 100).toLocaleString()} – {(ringEnd * 100).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-slate-400">Min Strength:</span>
            <select
              value={minCount}
              onChange={(e) => setMinCount(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value={0}>All</option>
              <option value={1}>1+ Hits</option>
              <option value={2}>2+ Hits</option>
              <option value={3}>3+ Hits</option>
              <option value={4}>4+ Hits</option>
            </select>

            <div className="flex items-center gap-1 border border-slate-800 rounded p-0.5 bg-slate-950">
              <button
                onClick={() => setPPSort('strength')}
                className={`px-2.5 py-0.5 rounded ${
                  ppSort === 'strength' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Strength
              </button>
              <button
                onClick={() => setPPSort('point')}
                className={`px-2.5 py-0.5 rounded ${
                  ppSort === 'point' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Pt #
              </button>
            </div>
          </div>
        </div>

        {/* Coverage breakdown */}
        <div className="flex flex-wrap gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
          {Object.entries(coverage).map(([name, count]) => {
            const m = PLANET_META[name as keyof typeof PLANET_META];
            if (!m) return null;
            return (
              <span key={name} className="flex items-center gap-1">
                <span style={{ color: m.color }}>{m.sym}</span>
                <span className="text-slate-400">{name}:</span>
                <b className={count > 0 ? 'text-amber-300' : 'text-slate-600'}>{count}</b>
              </span>
            );
          })}
        </div>

        <div className="max-h-[320px] overflow-y-auto no-scrollbar rounded-lg border border-slate-800">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Pt #</th>
                <th className="p-2.5">Deg (° )</th>
                <th className="p-2.5">Ring Price</th>
                <th className="p-2.5">Planets in Aspect</th>
                <th className="p-2.5">Strength</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {filteredPoints.map((r) => {
                const isMatch = hasPrice && r.number === nearestInt;

                return (
                  <tr
                    key={r.number}
                    className={`hover:bg-slate-800/40 transition-all ${
                      isMatch ? 'bg-amber-400/10 font-bold border-l-4 border-amber-400' : ''
                    }`}
                  >
                    <td className={`p-2.5 ${isMatch ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                      {r.number}
                    </td>
                    <td className="p-2.5 text-slate-400">{r.deg.toFixed(1)}°</td>
                    <td className={`p-2.5 ${isMatch ? 'text-amber-300 font-bold' : 'text-slate-200'}`}>
                      {r.price.toLocaleString()}
                    </td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {r.hits.map((h, idx) => {
                          const pm = PLANET_META[h.planet];
                          const am = ASPECT_META[h.aspect];

                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800"
                            >
                              <span style={{ color: pm?.color }}>{pm?.sym}</span> {h.planet}{' '}
                              <span style={{ color: am?.color }}>{am?.abbr || h.aspect}</span>{' '}
                              <span className="text-slate-500">({h.orb.toFixed(1)}°)</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <span className={`font-bold ${r.strength >= 4 ? 'text-rose-400' : r.strength >= 2 ? 'text-amber-300' : 'text-slate-500'}`}>
                        {r.strength}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Price Node Aspect Map */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-serif text-sm font-semibold text-amber-300">
            Price Node Aspect Mapping
          </h4>
          <div className="flex items-center gap-4 font-mono text-xs text-slate-400">
            <span>Price Degree: <b className="text-amber-300">{priceDeg !== null ? `${priceDeg.toFixed(2)}°` : '—'}</b></span>
            <span>Ring Value: <b className="text-amber-300">{hasPrice ? (priceVal / 100).toFixed(2) : '—'}</b></span>
          </div>
        </div>

        <div className="max-h-[250px] overflow-y-auto no-scrollbar rounded-lg border border-slate-800">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Aspect</th>
                <th className="p-2.5">Planet</th>
                <th className="p-2.5">Planet Lon</th>
                <th className="p-2.5">Target Deg</th>
                <th className="p-2.5">Orb (°)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {priceNodeAspects.length > 0 ? (
                priceNodeAspects.map((r, idx) => {
                  const pm = PLANET_META[r.planet];
                  const am = ASPECT_META[r.aspect];

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="p-2.5" style={{ color: am?.color }}>
                        {am?.sym} {r.aspect}
                      </td>
                      <td className="p-2.5">
                        <span style={{ color: pm?.color }}>{pm?.sym}</span> {r.planet}
                      </td>
                      <td className="p-2.5 text-slate-300">{r.lon.toFixed(2)}°</td>
                      <td className="p-2.5 text-amber-300">{r.targetDeg.toFixed(2)}°</td>
                      <td className="p-2.5 text-slate-300">{r.orb.toFixed(2)}°</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500 font-mono">
                    Enter an index price above to map active aspect alignments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. High-Res Zodiac Orrery with Price Ring */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col items-center">
        <h4 className="font-serif text-sm font-semibold text-amber-300 mb-1">
          High-Res Intraday Zodiac Orrery
        </h4>
        <p className="text-xs font-mono text-slate-400 mb-4">
          Outer zodiac ring + inner price node ring (highlighting #{nearestInt || '—'})
        </p>

        <svg viewBox="0 0 760 760" className="w-full max-w-[550px] h-auto drop-shadow-2xl">
          {ZODIAC.map((z, s) => {
            const d0 = s * 30;
            const d1 = s * 30 + 30;
            const col = ELEMENT_COLORS[s % 4];
            const [sx, sy] = polarW((RZO + RZI) / 2, d0 + 15);

            return (
              <g key={z[0]}>
                <path
                  d={segPathW(RZO, RZI, d0, d1)}
                  fill={hexToRgba(col, s % 2 === 0 ? 0.16 : 0.24)}
                  stroke="#26314a"
                  strokeWidth="1"
                />
                <text
                  x={sx.toFixed(1)}
                  y={(sy + 1).toFixed(1)}
                  textAnchor="middle"
                  fontSize="22"
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
            const major = t % 30 === 0;
            const [ax, ay] = polarW(RZI, t);
            const [bx, by] = polarW(major ? RTM : RTI, t);
            return (
              <line
                key={t}
                x1={ax.toFixed(1)}
                y1={ay.toFixed(1)}
                x2={bx.toFixed(1)}
                y2={by.toFixed(1)}
                stroke={major ? '#c9a227' : '#3a465f'}
                strokeWidth={major ? 1.5 : 0.8}
              />
            );
          })}

          <circle cx={CXW} cy={CYW} r={RZO} fill="none" stroke="#c9a227" strokeWidth="1.6" opacity={0.75} />
          <circle cx={CXW} cy={CYW} r={RZI} fill="none" stroke="#26314a" strokeWidth="1" />
          <circle cx={CXW} cy={CYW} r={RPB} fill="none" stroke="#1c2438" strokeWidth="1" strokeDasharray="2 4" />

          {/* Price Ring Segments */}
          {Array.from({ length: RING_SIZE }).map((_, n) => {
            const num = ringStart + n;
            const deg = rev(n * P_SCALE);
            const hue = deg;
            const isN = hasPrice && num === nearestInt;
            const [lx, ly] = polarW((PRO + PRI) / 2, deg);

            return (
              <g key={num}>
                <path
                  d={segPathW(PRO, PRI, deg - P_SCALE / 2 + 0.5, deg + P_SCALE / 2 - 0.5)}
                  fill={`hsl(${hue}, 70%, 50%)`}
                  opacity={isN ? 0.25 : 0.12}
                />
                {isN ? (
                  <g>
                    <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="18" fill={`hsl(${hue}, 80%, 55%)`} opacity={0.3} />
                    <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="13" fill="#0d1220" stroke="#c9a227" strokeWidth="2" />
                    <text
                      x={lx.toFixed(1)}
                      y={(ly + 3.5).toFixed(1)}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="700"
                      fill="#e8c766"
                      fontFamily="monospace"
                    >
                      {num}
                    </text>
                  </g>
                ) : (
                  n % 2 === 0 && (
                    <text
                      x={lx.toFixed(1)}
                      y={(ly + 2.5).toFixed(1)}
                      textAnchor="middle"
                      fontSize="8"
                      fill={`hsl(${hue}, 65%, 75%)`}
                      fontFamily="monospace"
                    >
                      {num}
                    </text>
                  )
                )}
              </g>
            );
          })}

          {/* Planets */}
          {bodies.map(([name, p]) => {
            const meta = PLANET_META[name as keyof typeof PLANET_META];
            if (!meta) return null;
            const [x, y] = polarW(RPB, p.lon);

            return (
              <g key={name}>
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="18" fill={meta.color} opacity={0.12} />
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="13" fill="#0d1220" stroke={meta.color} strokeWidth="1.4" />
                <text
                  x={x.toFixed(1)}
                  y={(y + 4.5).toFixed(1)}
                  textAnchor="middle"
                  fontSize="14"
                  fill={meta.color}
                  fontFamily="Georgia, serif"
                >
                  {meta.sym}
                </text>
                {p.retro && (
                  <text
                    x={(x + 14).toFixed(1)}
                    y={(y - 10).toFixed(1)}
                    fontSize="9"
                    fill="#e85a6a"
                    fontFamily="monospace"
                  >
                    ℞
                  </text>
                )}
              </g>
            );
          })}

          <circle cx={CXW} cy={CYW} r={RC} fill="#0d1220" stroke="#c9a227" strokeWidth="1.2" />
          <text x={CXW} y={CYW - 4} textAnchor="middle" fill="#888" fontSize="9" fontFamily="monospace">
            {intraDate}
          </text>
          <text x={CXW} y={CYW + 10} textAnchor="middle" fill="#e8c766" fontSize="12" fontFamily="Georgia, serif" fontStyle="italic">
            Intraday
          </text>
        </svg>
      </div>
    </div>
  );
};
