import {
  PlanetName, AspectName, MatrixData, DayMatrix, DepartureProjection,
  DepartureEvent, BoxBreakoutData, BoxLevel, IntradayPPPoint, BoxingDate
} from '../types';
import {
  getPositions, findAspect, findAspectAll, angDiff, daysSinceEpoch,
  sunGeocentric, computeLongitude, rev, ALL_ASPECTS, MAJOR_ASPECTS,
  PLANET_META, FAST_BODIES, ASPECT_META
} from './astronomy';
import { getSignal, getAllSignals } from './signals';

export const P_START = 36;
export const P_SCALE = 10;
export const RING_SIZE = 36; // 360 / P_SCALE

export function ringToDegree(ring: number): number {
  const idx = Math.floor((ring - P_START) / RING_SIZE);
  const start = P_START + idx * RING_SIZE;
  return rev((ring - start) * P_SCALE);
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromIso(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function computeMatrix(
  dateFrom: string,
  dateTo: string,
  ringLo: number,
  ringHi: number,
  dateStep: number,
  orb: number,
  aspects: Record<string, number> = ALL_ASPECTS
): MatrixData {
  const dates: string[] = [];
  const data: Record<string, DayMatrix> = {};
  let cur = fromIso(dateFrom);
  const end = fromIso(dateTo);

  while (cur <= end) {
    const key = iso(cur);
    dates.push(key);
    const pos = getPositions(cur);
    const dayData: DayMatrix = {};

    for (let ring = ringLo; ring <= ringHi; ring++) {
      const deg = ringToDegree(ring);
      const hits: DayMatrix[number] = [];

      for (const [name, p] of Object.entries(pos)) {
        const asp = findAspect(p.lon, deg, orb, aspects);
        if (asp) {
          hits.push({
            p: name as PlanetName,
            a: asp.name,
            o: +asp.orb.toFixed(2),
            retro: p.retro
          });
        }
      }
      if (hits.length) dayData[ring] = hits;
    }
    data[key] = dayData;
    cur = addDays(cur, dateStep);
  }

  return { dates, ring_lo: ringLo, ring_hi: ringHi, data };
}

export function projectDeparture(
  startDate: Date,
  bodyName: PlanetName,
  ring: number,
  aspectName: AspectName,
  orb: number,
  maxDays = 365
): DepartureProjection {
  const targetAngle = ALL_ASPECTS[aspectName];
  if (targetAngle === undefined) return { date: null, days: null };

  const deg = ringToDegree(ring);
  let cur = new Date(startDate.getTime());

  for (let step = 1; step <= maxDays; step++) {
    cur = addDays(cur, 1);
    const d = daysSinceEpoch(cur);
    const sun = sunGeocentric(d);
    const lon = computeLongitude(bodyName, d, sun);
    const sep = angDiff(lon, deg);
    const o = Math.abs(sep - targetAngle);
    if (o > orb) return { date: iso(cur), days: step };
  }
  return { date: null, days: null };
}

export function scanCriticalDates(
  matrix: MatrixData,
  dateFrom: string,
  dateTo: string,
  priceLo: number,
  priceHi: number,
  orb: number,
  minH: number
): DepartureEvent[] {
  const ringLo = Math.floor(priceLo / 100);
  const ringHi = Math.ceil(priceHi / 100);
  const nDays = matrix.dates.length;

  const corridorRings: { ring: number; pct: number; kind: 'permanent' | 'strong' }[] = [];
  for (let r = ringLo; r <= ringHi; r++) {
    let hits = 0;
    for (const d of matrix.dates) {
      if (matrix.data[d] && matrix.data[d][r] && matrix.data[d][r].length >= minH) hits++;
    }
    const pct = hits / nDays;
    if (pct >= 0.5) {
      corridorRings.push({ ring: r, pct, kind: pct >= 0.9 ? 'permanent' : 'strong' });
    }
  }

  const events: DepartureEvent[] = [];
  const allDates: string[] = [];
  let cur = fromIso(dateFrom);
  const end = fromIso(dateTo);
  while (cur <= end) {
    allDates.push(iso(cur));
    cur = addDays(cur, 1);
  }

  for (const level of corridorRings) {
    const ring = level.ring;
    const deg = ringToDegree(ring);

    for (const body of Object.keys(PLANET_META) as PlanetName[]) {
      let prevAsp: { name: AspectName; orb: number } | null = null;

      for (let i = 0; i < allDates.length; i++) {
        const date = fromIso(allDates[i]);
        const d = daysSinceEpoch(date);
        const sun = sunGeocentric(d);
        const lon = computeLongitude(body, d, sun);
        const asp = findAspectAll(lon, deg, orb);

        if (prevAsp && !asp) {
          const sig = getSignal(body, prevAsp.name, 'depart', 'floor') ||
            getSignal(body, prevAsp.name, 'depart', 'ceiling');
          if (sig) {
            events.push({
              date: allDates[i],
              ring,
              price: ring * 100,
              body,
              aspect: prevAsp.name,
              action: 'depart',
              sig,
              wallKind: level.kind,
              wallPct: level.pct
            });
          }
        }

        if (!prevAsp && asp) {
          const sig = getSignal(body, asp.name, 'arrive', 'floor') ||
            getSignal(body, asp.name, 'arrive', 'ceiling');
          if (sig) {
            events.push({
              date: allDates[i],
              ring,
              price: ring * 100,
              body,
              aspect: asp.name,
              action: 'arrive',
              sig,
              wallKind: level.kind,
              wallPct: level.pct
            });
          }
        }
        prevAsp = asp || null;
      }
    }
  }

  const TIER_ORDER: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };
  events.sort((a, b) => {
    const ta = a.sig ? TIER_ORDER[a.sig.tier] : 9;
    const tb = b.sig ? TIER_ORDER[b.sig.tier] : 9;
    if (ta !== tb) return ta - tb;
    return a.date.localeCompare(b.date);
  });

  return events;
}

export function computeBoxBreakouts(
  matrix: MatrixData,
  dateFrom: string,
  dateTo: string,
  priceLo: number,
  priceHi: number,
  orb: number,
  minH: number
): BoxBreakoutData[] {
  const ringLo = Math.floor(priceLo / 100);
  const ringHi = Math.ceil(priceHi / 100);
  const validDates = matrix.dates.filter((d) => d >= dateFrom && d <= dateTo);
  const nDays = validDates.length || 1;

  const permSet = new Set<number>();
  const strongSet = new Set<number>();
  for (let r = ringLo; r <= ringHi; r++) {
    let hits = 0;
    for (const d of validDates) {
      if (matrix.data[d] && matrix.data[d][r] && matrix.data[d][r].length >= minH) hits++;
    }
    const pct = hits / nDays;
    if (pct >= 0.90) permSet.add(r);
    else if (pct >= 0.50) strongSet.add(r);
  }

  const permWalls = [...permSet].sort((a, b) => a - b);
  const strongWalls = [...strongSet].sort((a, b) => a - b);

  const rawBoxes: {
    floor: number;
    ceil: number;
    interior: number[];
    edge: 'bottom' | 'top' | null;
    floorKind: 'perm' | 'strong';
    ceilKind: 'perm' | 'strong';
  }[] = [];

  if (permWalls.length > 0) {
    const firstPerm = permWalls[0];
    const belowStrong = strongWalls.filter(s => s < firstPerm);
    if (belowStrong.length > 0) {
      rawBoxes.push({
        floor: belowStrong[0],
        ceil: firstPerm,
        interior: belowStrong.slice(1),
        edge: 'bottom',
        floorKind: 'strong',
        ceilKind: 'perm'
      });
    }
  }

  for (let i = 0; i < permWalls.length - 1; i++) {
    const floor = permWalls[i];
    const ceil = permWalls[i + 1];
    const interior = strongWalls.filter(s => s > floor && s < ceil);
    rawBoxes.push({
      floor,
      ceil,
      interior,
      edge: null,
      floorKind: 'perm',
      ceilKind: 'perm'
    });
  }

  if (permWalls.length > 0) {
    const lastPerm = permWalls[permWalls.length - 1];
    const aboveStrong = strongWalls.filter(s => s > lastPerm);
    if (aboveStrong.length > 0) {
      rawBoxes.push({
        floor: lastPerm,
        ceil: aboveStrong[aboveStrong.length - 1],
        interior: aboveStrong.slice(0, -1),
        edge: 'top',
        floorKind: 'perm',
        ceilKind: 'strong'
      });
    }
  }

  const allDates: string[] = [];
  let cur = fromIso(dateFrom);
  const end = fromIso(dateTo);
  while (cur <= end) {
    allDates.push(iso(cur));
    cur = addDays(cur, 1);
  }

  function scanDepartures(ring: number): DepartureEvent[] {
    const deg = ringToDegree(ring);
    const departures: DepartureEvent[] = [];
    const dailyStrength: number[] = [];

    for (let i = 0; i < allDates.length; i++) {
      const date = fromIso(allDates[i]);
      const d = daysSinceEpoch(date);
      const sun = sunGeocentric(d);
      let strength = 0;
      for (const bName of Object.keys(PLANET_META) as PlanetName[]) {
        if (bName === 'NorthNode' || bName === 'SouthNode') continue;
        const lon = computeLongitude(bName, d, sun);
        const sep = angDiff(lon, deg);
        let hasAsp = false;
        for (const angle of Object.values(ALL_ASPECTS)) {
          if (Math.abs(sep - angle) <= orb) { hasAsp = true; break; }
        }
        if (hasAsp) strength++;
      }
      dailyStrength.push(strength);
    }

    for (const body of FAST_BODIES) {
      let prevAsp: { name: AspectName; orb: number } | null = null;
      let minOrbTracked = orb;

      for (let i = 0; i < allDates.length; i++) {
        const date = fromIso(allDates[i]);
        const d = daysSinceEpoch(date);
        const sun = sunGeocentric(d);
        const lon = computeLongitude(body, d, sun);
        const asp = findAspectAll(lon, deg, orb);

        if (asp) {
          if (asp.orb < minOrbTracked) minOrbTracked = asp.orb;
        }

        if (prevAsp && !asp) {
          const sig = getSignal(body, prevAsp.name, 'depart', 'floor') ||
            getSignal(body, prevAsp.name, 'depart', 'ceiling');

          let wallDrop = false;
          if (i > 0 && dailyStrength[i - 1] >= 3 && dailyStrength[i] < 3) wallDrop = true;
          if (i > 1 && dailyStrength[i - 2] >= 3 && dailyStrength[i - 1] < 3) wallDrop = true;
          if (i < allDates.length - 1 && dailyStrength[i] >= 3 && dailyStrength[i + 1] < 3) wallDrop = true;

          const boxStart = fromIso(dateFrom);
          const depDate = fromIso(allDates[i]);
          const boxAgeDays = Math.round((depDate.getTime() - boxStart.getTime()) / 86400000);

          let tScore = 0;
          if (wallDrop) tScore++;
          if (minOrbTracked <= 3.0) tScore++;
          if (boxAgeDays >= 3) tScore++;
          tScore = Math.min(tScore, 3);

          departures.push({
            date: allDates[i],
            ring,
            price: ring * 100,
            body,
            aspect: prevAsp.name,
            action: 'depart',
            lastOrb: prevAsp.orb,
            minOrb: +minOrbTracked.toFixed(2),
            sig: sig || null,
            wallDrop,
            tScore,
            wallStrBefore: i > 0 ? dailyStrength[i - 1] : 0,
            wallStrAfter: dailyStrength[i],
            wallKind: 'permanent',
            wallPct: 1.0
          });
          minOrbTracked = orb;
        } else if (!asp) {
          minOrbTracked = orb;
        }
        prevAsp = asp ? { name: asp.name, orb: asp.orb } : null;
      }
    }

    for (let i = 1; i < allDates.length; i++) {
      if (dailyStrength[i - 1] >= 3 && dailyStrength[i] < 3) {
        const hasDepOnDate = departures.some(dep => dep.date === allDates[i]);
        if (!hasDepOnDate) {
          departures.push({
            date: allDates[i],
            ring,
            price: ring * 100,
            body: '—',
            aspect: '—',
            action: 'depart',
            lastOrb: 0,
            minOrb: 0,
            sig: null,
            wallDrop: true,
            tScore: 1,
            wallStrBefore: dailyStrength[i - 1],
            wallStrAfter: dailyStrength[i],
            isWallDropOnly: true,
            wallKind: 'permanent',
            wallPct: 1.0
          });
        }
      }
    }

    departures.sort((a, b) => a.date.localeCompare(b.date));
    return departures;
  }

  return rawBoxes.map((box, idx) => {
    const levels: BoxLevel[] = [];
    levels.push({
      ring: box.floor,
      kind: box.floorKind,
      label: 'Floor',
      departures: scanDepartures(box.floor)
    });

    for (const s of box.interior) {
      levels.push({
        ring: s,
        kind: 'strong',
        label: 'Interior',
        departures: scanDepartures(s)
      });
    }

    levels.push({
      ring: box.ceil,
      kind: box.ceilKind,
      label: 'Ceiling',
      departures: scanDepartures(box.ceil)
    });

    return {
      id: idx,
      floor: box.floor,
      ceil: box.ceil,
      interior: box.interior,
      edge: box.edge,
      floorKind: box.floorKind,
      ceilKind: box.ceilKind,
      levels
    };
  });
}

export function getWallPricesFromMatrix(
  matrix: MatrixData,
  dateFrom: string,
  dateTo: string,
  priceLo: number,
  priceHi: number,
  minH: number
): { permWalls: number[]; strongWalls: number[] } {
  const ringLo = Math.floor(priceLo / 100);
  const ringHi = Math.ceil(priceHi / 100);
  const validDates = matrix.dates.filter((d) => d >= dateFrom && d <= dateTo);
  const nDays = validDates.length || 1;

  const permSet = new Set<number>();
  const strongSet = new Set<number>();

  for (let r = ringLo; r <= ringHi; r++) {
    let hits = 0;
    for (const d of validDates) {
      if (matrix.data[d] && matrix.data[d][r] && matrix.data[d][r].length >= minH) hits++;
    }
    const pct = hits / nDays;
    if (pct >= 0.90) permSet.add(r * 100);
    else if (pct >= 0.50) strongSet.add(r * 100);
  }

  return {
    permWalls: [...permSet].sort((a, b) => a - b),
    strongWalls: [...strongSet].sort((a, b) => a - b)
  };
}

export function computeBoxingDates(
  anchorDate: string,
  endDate: string,
  permWalls: number[],
  strongWalls: number[],
  snapTradingDay: boolean = false
): BoxingDate[] {
  if (!anchorDate || !endDate) return [];

  const startObj = fromIso(anchorDate);
  const endObj = fromIso(endDate);
  if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || startObj > endObj) return [];

  const CYCLE = 36;
  const spanDays = Math.round((endObj.getTime() - startObj.getTime()) / (1000 * 60 * 60 * 24));
  if (spanDays < 0) return [];

  const dateMap: Record<
    string,
    { date: string; perm: number[]; strong: number[]; isWeekend?: boolean; snappedFrom?: string }
  > = {};

  const projectWall = (price: number, kind: 'perm' | 'strong') => {
    const ring = Math.floor(price / 100);
    const dayOffset = ((ring % CYCLE) + CYCLE) % CYCLE;

    let k = 0;
    while (true) {
      const offsetDays = dayOffset + CYCLE * k;
      if (offsetDays > spanDays) break;

      const targetDate = addDays(startObj, offsetDays);
      const origIso = iso(targetDate);
      const dayOfWeek = targetDate.getUTCDay();
      const isWknd = dayOfWeek === 0 || dayOfWeek === 6;

      let actualIso = origIso;
      let snappedFrom: string | undefined = undefined;

      if (snapTradingDay && isWknd) {
        const daysToAdd = dayOfWeek === 6 ? 2 : 1; // Sat -> Mon (+2), Sun -> Mon (+1)
        const snappedDate = addDays(targetDate, daysToAdd);
        actualIso = iso(snappedDate);
        snappedFrom = origIso;
      }

      if (!dateMap[actualIso]) {
        dateMap[actualIso] = {
          date: actualIso,
          perm: [],
          strong: [],
          isWeekend: isWknd,
          snappedFrom
        };
      }

      if (kind === 'perm') {
        if (!dateMap[actualIso].perm.includes(price)) {
          dateMap[actualIso].perm.push(price);
        }
      } else {
        if (!dateMap[actualIso].strong.includes(price)) {
          dateMap[actualIso].strong.push(price);
        }
      }

      k++;
    }
  };

  for (const price of strongWalls) {
    projectWall(price, 'strong');
  }

  for (const price of permWalls) {
    projectWall(price, 'perm');
  }

  const result: BoxingDate[] = Object.values(dateMap).map((entry) => ({
    date: entry.date,
    kind: entry.perm.length > 0 ? 'perm' : 'strong',
    perm: entry.perm.sort((a, b) => a - b),
    strong: entry.strong.sort((a, b) => a - b),
    isWeekend: entry.isWeekend,
    snappedFrom: entry.snappedFrom
  }));

  result.sort((a, b) => a.date.localeCompare(b.date));

  return result;
}

