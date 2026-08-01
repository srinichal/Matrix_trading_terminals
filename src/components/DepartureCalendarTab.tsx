import React, { useState, useEffect } from 'react';
import { MatrixData, PlanetName } from '../types';
import { FAST_BODIES, PLANET_META, ASPECT_META, daysSinceEpoch, sunGeocentric, computeLongitude, findAspectAll } from '../lib/astronomy';
import { fromIso, iso, addDays, ringToDegree } from '../lib/matrix';
import { getSignal, TIER_META } from '../lib/signals';
import { CalendarDays, Filter, Sparkles } from 'lucide-react';

interface DepartureCalendarTabProps {
  matrix: MatrixData;
  minHighlight: number;
  orb?: number;
}

export const DepartureCalendarTab: React.FC<DepartureCalendarTabProps> = ({
  matrix,
  minHighlight,
  orb = 5.0
}) => {
  const [filterBody, setFilterBody] = useState<string>(() => {
    try {
      return localStorage.getItem('dct_filterBody') || 'all';
    } catch (e) {
      return 'all';
    }
  });
  const [signalsOnly, setSignalsOnly] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('dct_signalsOnly');
      return v !== null ? JSON.parse(v) : false;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('dct_filterBody', filterBody);
      localStorage.setItem('dct_signalsOnly', JSON.stringify(signalsOnly));
    } catch (e) {}
  }, [filterBody, signalsOnly]);

  const { dates, data, ring_lo, ring_hi } = matrix;
  const nDays = dates.length;

  const perm: number[] = [];
  const strong: number[] = [];

  for (let r = ring_lo; r <= ring_hi; r++) {
    let hits = 0;
    for (const d of dates) {
      if (data[d] && data[d][r] && data[d][r].length >= minHighlight) hits++;
    }
    const p = hits / nDays;
    if (p >= 0.9) perm.push(r);
    else if (p >= 0.5) strong.push(r);
  }

  const corridorLevels = [...perm, ...strong].sort((a, b) => b - a);

  interface CalEvent {
    date: string;
    level: number;
    kind: 'permanent' | 'strong';
    body: PlanetName;
    aspect: string;
    lastOrb: number;
    sig: ReturnType<typeof getSignal>;
  }

  const events: CalEvent[] = [];

  if (dates.length > 0) {
    const allDates: string[] = [];
    let cur = fromIso(dates[0]);
    const end = fromIso(dates[dates.length - 1]);
    while (cur <= end) {
      allDates.push(iso(cur));
      cur = addDays(cur, 1);
    }

    for (const level of corridorLevels) {
      const kind = perm.includes(level) ? 'permanent' : 'strong';
      const deg = ringToDegree(level);

      for (const body of FAST_BODIES) {
        let prevHit: { a: string; o: number } | null = null;

        for (let i = 0; i < allDates.length; i++) {
          const dateStr = allDates[i];
          const dateObj = fromIso(dateStr);
          const d = daysSinceEpoch(dateObj);
          const sun = sunGeocentric(d);
          const lon = computeLongitude(body, d, sun);
          const asp = findAspectAll(lon, deg, orb);

          if (prevHit && !asp) {
            const sig = getSignal(body, prevHit.a as any, 'depart', 'floor') ||
              getSignal(body, prevHit.a as any, 'depart', 'ceiling');

            events.push({
              date: dateStr,
              level,
              kind,
              body,
              aspect: prevHit.a,
              lastOrb: prevHit.o,
              sig
            });
          }
          prevHit = asp ? { a: asp.name, o: +asp.orb.toFixed(2) } : null;
        }
      }
    }
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  const filteredEvents = events.filter((e) => {
    if (signalsOnly && !e.sig) return false;
    if (filterBody !== 'all' && e.body !== filterBody) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-serif text-sm font-semibold text-amber-300 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-400" />
            Fast Planet Wall Departure Calendar
          </h4>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            Chronological log of inner planets (Sun, Moon, Mercury, Venus, Mars) exiting containment wall aspects
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800 font-mono text-xs">
          <button
            onClick={() => { setFilterBody('all'); setSignalsOnly(false); }}
            className={`px-2.5 py-1 rounded transition-all ${
              filterBody === 'all' && !signalsOnly
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Fast
          </button>

          <button
            onClick={() => setSignalsOnly(!signalsOnly)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              signalsOnly
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Sparkles className="w-3 h-3" /> Signals Only
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {FAST_BODIES.map((b) => {
            const m = PLANET_META[b];
            return (
              <button
                key={b}
                onClick={() => { setFilterBody(b); setSignalsOnly(false); }}
                className={`px-2 py-1 rounded transition-all flex items-center gap-1 ${
                  filterBody === b
                    ? 'bg-amber-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span style={{ color: filterBody === b ? '#000' : m.color }}>{m.sym}</span> {b}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-2xl">
        <div className="max-h-[500px] overflow-y-auto no-scrollbar rounded-lg border border-slate-800">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 text-[10px] uppercase">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Price Level</th>
                <th className="p-2.5">Wall Type</th>
                <th className="p-2.5">Body</th>
                <th className="p-2.5">Aspect Ending</th>
                <th className="p-2.5">Tier</th>
                <th className="p-2.5">Signal Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {filteredEvents.map((e, idx) => {
                const pMeta = PLANET_META[e.body];
                const aspMeta = ASPECT_META[e.aspect as keyof typeof ASPECT_META];

                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-2.5 text-amber-300 font-semibold">{e.date}</td>
                    <td className="p-2.5 font-bold text-slate-200">
                      {(e.level * 100).toLocaleString()}
                    </td>
                    <td className="p-2.5">
                      {e.kind === 'permanent' ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                          Permanent
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/20">
                          Strong
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      <span style={{ color: pMeta.color }}>{pMeta.sym}</span> {e.body}
                    </td>
                    <td className="p-2.5">
                      <span style={{ color: aspMeta?.color }}>{aspMeta?.sym} {e.aspect}</span>{' '}
                      <span className="text-slate-500 text-[10px]">(was ±{e.lastOrb}°)</span>
                    </td>
                    <td className="p-2.5">
                      {e.sig && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            backgroundColor: TIER_META[e.sig.tier].bg,
                            color: TIER_META[e.sig.tier].color,
                            border: `1px solid ${TIER_META[e.sig.tier].border}`
                          }}
                        >
                          {TIER_META[e.sig.tier].label}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5">
                      {e.sig ? (
                        <span className="text-slate-200">
                          {e.sig.desc}{' '}
                          <b className="text-amber-300 font-bold">({e.sig.lift.toFixed(1)}×)</b>
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
    </div>
  );
};
