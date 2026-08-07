// src/lib/gannSqrt.ts
// Gann square-root time projection engine

export interface GannProjection {
  date: string;          // ISO "YYYY-MM-DD"
  anchor: string;        // ISO anchor date
  xval: number;          // day count value (round to get days)
  step: number;          // which step in the series (0,1,2,...)
  stream: 1 | 2;
  HL?: number;           // Stream 1: the HL value used
  price?: number;        // Stream 2: the pivot price used
  src: string;           // human-readable source label
}

export interface GannPeak {
  date: string;
  count: number;         // intra-stream projections within ±1 day
  anchors: number;       // number of distinct anchor dates contributing
  stream: 1 | 2;
  projs: GannProjection[];
}

export interface GannApexDate {
  date: string;
  s1Peak: GannPeak;
  s2Peak: GannPeak;
  totalScore: number;    // s1Peak.count + s2Peak.count
  tier: 'apex-high' | 'apex';  // apex-high = totalScore >= 25
}

export interface GannDateEntry {
  date: string;
  tag: 'apex-high' | 'apex' | 's1' | 's2';
  s1Count: number;
  s1Anchors: number;
  s2Count: number;
  s2Anchors: number;
  totalScore: number;
  projs: GannProjection[];
}

// ── Core series generator ────────────────────────────────────────────────

function generateSeries(
  HL: number,
  anchor: Date,
  windowEnd: Date,
  stream: 1 | 2,
  src: string,
  extraFields: { HL?: number; price?: number }
): GannProjection[] {
  const out: GannProjection[] = [];
  let x = Math.sqrt(HL);
  let n = 0;
  const anchorStr = anchor.toISOString().slice(0, 10);

  while (true) {
    const days = Math.round(x);
    const proj = new Date(anchor.getTime() + days * 86_400_000);
    if (proj > windowEnd) break;
    if (proj > anchor) {
      out.push({
        date:   proj.toISOString().slice(0, 10),
        anchor: anchorStr,
        xval:   Math.round(x * 100) / 100,
        step:   n,
        stream,
        src,
        ...extraFields,
      });
    }
    x = (Math.sqrt(x) + 2) ** 2;
    n++;
    if (n > 500) break;  // safety — series converges, this never fires in practice
  }
  return out;
}

// ── Stream builders ──────────────────────────────────────────────────────

function buildStream1(
  swings: Array<{ date: string; type: string; price: number }>,
  windowStart: Date,
  windowEnd: Date
): GannProjection[] {
  const out: GannProjection[] = [];
  for (let i = 0; i < swings.length - 1; i++) {
    const a = swings[i];
    const b = swings[i + 1];
    const HL = Math.abs(a.price - b.price);
    if (HL < 1) continue;
    const dA = new Date(a.date + 'T00:00:00Z');
    const dB = new Date(b.date + 'T00:00:00Z');
    const anchor = dA > dB ? dA : dB;
    if (anchor >= windowEnd) continue;
    const projs = generateSeries(HL, anchor, windowEnd, 1,
      `${a.date}(${a.type[0]})→${b.date}(${b.type[0]})`, { HL: Math.round(HL * 10) / 10 });
    for (const p of projs) {
      if (new Date(p.date + 'T00:00:00Z') >= windowStart) out.push(p);
    }
  }
  return out;
}

function buildStream2(
  swings: Array<{ date: string; type: string; price: number }>,
  windowStart: Date,
  windowEnd: Date
): GannProjection[] {
  const out: GannProjection[] = [];
  for (const sw of swings) {
    const anchor = new Date(sw.date + 'T00:00:00Z');
    if (anchor >= windowEnd) continue;
    const projs = generateSeries(sw.price, anchor, windowEnd, 2,
      `${sw.date}(${sw.type[0]})`, { price: sw.price });
    for (const p of projs) {
      if (new Date(p.date + 'T00:00:00Z') >= windowStart) out.push(p);
    }
  }
  return out;
}

// ── Peak finder ──────────────────────────────────────────────────────────

function findPeaks(
  projs: GannProjection[],
  stream: 1 | 2,
  orb: number = 1,
  minCount: number = 3
): GannPeak[] {
  // Map date → projections
  const dm: Map<string, GannProjection[]> = new Map();
  for (const p of projs) {
    const arr = dm.get(p.date) ?? [];
    arr.push(p);
    dm.set(p.date, arr);
  }

  const allDates = Array.from(dm.keys()).sort();

  // Score each date: count projs within ±orb days
  const scores: Map<string, GannProjection[]> = new Map();
  for (const d of allDates) {
    const nearby: GannProjection[] = [];
    const dMs = new Date(d + 'T00:00:00Z').getTime();
    for (const d2 of allDates) {
      const diff = Math.abs(new Date(d2 + 'T00:00:00Z').getTime() - dMs) / 86_400_000;
      if (diff <= orb) nearby.push(...(dm.get(d2) ?? []));
    }
    scores.set(d, nearby);
  }

  // Extract peaks (deduplicate within ±3 days, highest count first)
  const processed = new Set<string>();
  const peaks: GannPeak[] = [];

  const sorted = [...allDates].sort(
    (a, b) => (scores.get(b)?.length ?? 0) - (scores.get(a)?.length ?? 0)
  );

  for (const d of sorted) {
    if (processed.has(d)) continue;
    const nearby = scores.get(d) ?? [];
    if (nearby.length >= minCount) {
      peaks.push({
        date:    d,
        count:   nearby.length,
        anchors: new Set(nearby.map(p => p.anchor)).size,
        stream,
        projs:   nearby,
      });
      const dMs = new Date(d + 'T00:00:00Z').getTime();
      for (let i = -3; i <= 3; i++) {
        const dd = new Date(dMs + i * 86_400_000).toISOString().slice(0, 10);
        processed.add(dd);
      }
    }
  }

  return peaks.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Cross-stream matcher ─────────────────────────────────────────────────

function matchCrossStream(
  s1Peaks: GannPeak[],
  s2Peaks: GannPeak[],
  orb: number = 1
): GannApexDate[] {
  const matches: Array<{ date: string; s1: GannPeak; s2: GannPeak; total: number }> = [];

  for (const p1 of s1Peaks) {
    for (const p2 of s2Peaks) {
      const diff = Math.abs(
        new Date(p1.date + 'T00:00:00Z').getTime() -
        new Date(p2.date + 'T00:00:00Z').getTime()
      ) / 86_400_000;
      if (diff <= orb) {
        matches.push({ date: p1.date, s1: p1, s2: p2, total: p1.count + p2.count });
      }
    }
  }

  // Deduplicate within ±3 days, highest total first
  const processed = new Set<string>();
  const out: GannApexDate[] = [];

  for (const m of matches.sort((a, b) => b.total - a.total)) {
    if (processed.has(m.date)) continue;
    out.push({
      date:       m.date,
      s1Peak:     m.s1,
      s2Peak:     m.s2,
      totalScore: m.total,
      tier:       m.total >= 25 ? 'apex-high' : 'apex',
    });
    const dMs = new Date(m.date + 'T00:00:00Z').getTime();
    for (let i = -3; i <= 3; i++) {
      processed.add(new Date(dMs + i * 86_400_000).toISOString().slice(0, 10));
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Main export ───────────────────────────────────────────────────────────

export interface ComputeGannDatesOptions {
  windowStart: string;   // ISO date — start of display window
  windowEnd: string;     // ISO date — end of display window (≤ 1 year from start)
}

export function computeGannDates(
  swings: Array<{ date: string; type: string; price: number }>,
  opts: ComputeGannDatesOptions
): GannDateEntry[] {
  const wStart = new Date(opts.windowStart + 'T00:00:00Z');
  const wEnd   = new Date(opts.windowEnd   + 'T00:00:00Z');

  // Build both streams
  const s1Projs = buildStream1(swings, wStart, wEnd);
  const s2Projs = buildStream2(swings, wStart, wEnd);

  // Find intra-stream peaks
  const s1Peaks = findPeaks(s1Projs, 1, 1, 5);   // S1: ≥5 projections
  const s2Peaks = findPeaks(s2Projs, 2, 1, 3);   // S2: ≥3 projections

  // Cross-stream APEX
  const apexDates = matchCrossStream(s1Peaks, s2Peaks, 1);
  const apexDateSet = new Set(apexDates.map(a => a.date));

  // Build unified GannDateEntry list
  const entries: Map<string, GannDateEntry> = new Map();

  // Add APEX dates
  for (const a of apexDates) {
    entries.set(a.date, {
      date:       a.date,
      tag:        a.tier === 'apex-high' ? 'apex-high' : 'apex',
      s1Count:    a.s1Peak.count,
      s1Anchors:  a.s1Peak.anchors,
      s2Count:    a.s2Peak.count,
      s2Anchors:  a.s2Peak.anchors,
      totalScore: a.totalScore,
      projs:      [...a.s1Peak.projs, ...a.s2Peak.projs],
    });
  }

  // Add S1-only peaks
  for (const p of s1Peaks) {
    if (!apexDateSet.has(p.date)) {
      entries.set(p.date, {
        date: p.date, tag: 's1',
        s1Count: p.count, s1Anchors: p.anchors,
        s2Count: 0, s2Anchors: 0,
        totalScore: p.count,
        projs: p.projs,
      });
    }
  }

  // Add S2-only peaks
  for (const p of s2Peaks) {
    if (!apexDateSet.has(p.date) && !entries.has(p.date)) {
      entries.set(p.date, {
        date: p.date, tag: 's2',
        s1Count: 0, s1Anchors: 0,
        s2Count: p.count, s2Anchors: p.anchors,
        totalScore: p.count,
        projs: p.projs,
      });
    }
  }

  return Array.from(entries.values()).sort((a, b) => a.date.localeCompare(b.date));
}
