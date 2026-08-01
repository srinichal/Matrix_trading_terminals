import { PlanetMeta, AspectMeta, PlanetName, AspectName, PlanetPosition } from '../types';

export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export const rev = (x: number): number => ((x % 360) + 360) % 360;
export const sinD = (x: number): number => Math.sin(x * D2R);
export const cosD = (x: number): number => Math.cos(x * D2R);
export const atan2D = (y: number, x: number): number => rev(Math.atan2(y, x) * R2D);

export function daysSinceEpoch(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24;
  return 367 * y - Math.floor(7 * (y + Math.floor((m + 9) / 12)) / 4) + Math.floor(275 * m / 9) + d - 730530;
}

export function keplerE(M: number, e: number): number {
  let E = M + (180 / Math.PI) * e * Math.sin(M * D2R) * (1 + e * Math.cos(M * D2R));
  for (let i = 0; i < 6; i++) {
    const Er = E * D2R;
    E -= (E - e * R2D * Math.sin(Er) - M) / (1 - e * Math.cos(Er));
  }
  return E;
}

export interface KeplerElements {
  N: [number, number];
  i: [number, number];
  w: [number, number];
  a: [number, number];
  e: [number, number];
  M: [number, number];
}

export const ELEMENTS: Record<string, KeplerElements> = {
  Sun: { N: [0, 0], i: [0, 0], w: [282.9404, 4.70935e-5], a: [1, 0], e: [0.016709, -1.151e-9], M: [356.0470, 0.9856002585] },
  Moon: { N: [125.1228, -0.0529538083], i: [5.1454, 0], w: [318.0634, 0.1643573223], a: [60.2666, 0], e: [0.054900, 0], M: [115.3654, 13.0649929509] },
  Mercury: { N: [48.3313, 3.24587e-5], i: [7.0047, 5e-8], w: [29.1241, 1.01444e-5], a: [0.387098, 0], e: [0.205635, 5.59e-10], M: [168.6562, 4.0923344368] },
  Venus: { N: [76.6799, 2.4659e-5], i: [3.3946, 2.75e-8], w: [54.891, 1.38374e-5], a: [0.72333, 0], e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244] },
  Mars: { N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8], w: [286.5016, 2.92961e-5], a: [1.523688, 0], e: [0.093405, 2.516e-9], M: [18.6021, 0.5240207766] },
  Jupiter: { N: [100.4542, 2.76854e-5], i: [1.303, -1.557e-7], w: [273.8777, 1.64505e-5], a: [5.20256, 0], e: [0.048498, 4.469e-9], M: [19.895, 0.0830853001] },
  Saturn: { N: [113.6634, 2.3898e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: [9.55475, 0], e: [0.055546, -9.499e-9], M: [316.967, 0.0334442282] },
  Uranus: { N: [74.0005, 1.3978e-5], i: [0.7733, 1.9e-8], w: [96.6612, 3.0565e-5], a: [19.18171, -1.55e-8], e: [0.047318, 7.45e-9], M: [142.5905, 0.011725806] },
  Neptune: { N: [131.7806, 3.0173e-5], i: [1.77, -2.55e-7], w: [272.8461, -6.027e-6], a: [30.05826, 3.313e-8], e: [0.008606, 2.15e-9], M: [260.2471, 0.005995147] },
  Pluto: { N: [110.3, 0], i: [17.14, 0], w: [113.76, 0], a: [39.482, 0], e: [0.2488, 0], M: [14.53, 0.003968] }
};

export function elemAt(key: string, d: number) {
  const e = ELEMENTS[key];
  const val = (p: [number, number]) => p[0] + p[1] * d;
  return {
    N: val(e.N),
    i: val(e.i),
    w: val(e.w),
    a: val(e.a),
    e: val(e.e),
    M: rev(val(e.M))
  };
}

export function twoBody(el: ReturnType<typeof elemAt>) {
  const E = keplerE(el.M, el.e);
  const xv = el.a * (cosD(E) - el.e);
  const yv = el.a * (Math.sqrt(1 - el.e * el.e) * sinD(E));
  return { v: atan2D(yv, xv), r: Math.sqrt(xv * xv + yv * yv) };
}

export function heliocentricRect(el: ReturnType<typeof elemAt>) {
  const { v, r } = twoBody(el);
  const vw = v + el.w;
  return {
    xh: r * (cosD(el.N) * cosD(vw) - sinD(el.N) * sinD(vw) * cosD(el.i)),
    yh: r * (sinD(el.N) * cosD(vw) + cosD(el.N) * sinD(vw) * cosD(el.i)),
    zh: r * (sinD(vw) * sinD(el.i))
  };
}

export function sunGeocentric(d: number) {
  const el = elemAt('Sun', d);
  const { v, r } = twoBody(el);
  const lon = rev(v + el.w);
  return { xs: r * cosD(lon), ys: r * sinD(lon), lon, r };
}

export function moonLongitude(d: number, sun: ReturnType<typeof sunGeocentric>) {
  const el = elemAt('Moon', d);
  const { xh, yh } = heliocentricRect(el);
  let lon = atan2D(yh, xh);
  const Ms = elemAt('Sun', d).M;
  const Mm = el.M;
  const Lm = rev(el.N + el.w + Mm);
  const Ls = rev(sun.lon);
  const D2 = rev(Lm - Ls);
  const F = rev(Lm - el.N);
  
  lon += -1.274 * sinD(Mm - 2 * D2) + 0.658 * sinD(2 * D2) - 0.186 * sinD(Ms)
    - 0.059 * sinD(2 * Mm - 2 * D2) - 0.057 * sinD(Mm - 2 * D2 + Ms)
    + 0.053 * sinD(Mm + 2 * D2) + 0.046 * sinD(2 * D2 - Ms)
    + 0.041 * sinD(Mm - Ms) - 0.035 * sinD(D2) - 0.031 * sinD(Mm + Ms)
    - 0.015 * sinD(2 * F - 2 * D2) + 0.011 * sinD(Mm - 4 * D2);
  return rev(lon);
}

export function planetGeoLongitude(key: string, d: number, sun: ReturnType<typeof sunGeocentric>) {
  const el = elemAt(key, d);
  const { xh, yh } = heliocentricRect(el);
  return atan2D(yh + sun.ys, xh + sun.xs);
}

export const BODY_LIST: PlanetName[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'NorthNode', 'SouthNode'
];

export function computeLongitude(key: PlanetName, d: number, sun: ReturnType<typeof sunGeocentric>): number {
  if (key === 'Sun') return rev(sun.lon);
  if (key === 'Moon') return moonLongitude(d, sun);
  if (key === 'NorthNode') return rev(elemAt('Moon', d).N);
  if (key === 'SouthNode') return rev(elemAt('Moon', d).N + 180);
  return planetGeoLongitude(key, d, sun);
}

export function getPositions(date: Date): Record<PlanetName, PlanetPosition> {
  const d = daysSinceEpoch(date);
  const sun = sunGeocentric(d);
  const out = {} as Record<PlanetName, PlanetPosition>;
  
  for (const key of BODY_LIST) {
    const lon = computeLongitude(key, d, sun);
    let retro = false;
    if (key !== 'Sun' && key !== 'Moon') {
      if (key === 'NorthNode' || key === 'SouthNode') {
        retro = true;
      } else {
        const d2 = daysSinceEpoch(new Date(date.getTime() + 12 * 3600 * 1000));
        const sun2 = sunGeocentric(d2);
        let diff = computeLongitude(key, d2, sun2) - lon;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        retro = diff < 0;
      }
    }
    out[key] = { lon: rev(lon), retro };
  }
  return out;
}

export const ZODIAC: [string, string][] = [
  ['Aries', '♈'], ['Taurus', '♉'], ['Gemini', '♊'], ['Cancer', '♋'],
  ['Leo', '♌'], ['Virgo', '♍'], ['Libra', '♎'], ['Scorpio', '♏'],
  ['Sagittarius', '♐'], ['Capricorn', '♑'], ['Aquarius', '♒'], ['Pisces', '♓']
];

export const ELEMENT_COLORS = ['#e0a344', '#3fb68b', '#5aa9e6', '#e07fc0'];

export const ALL_ASPECTS: Record<AspectName, number> = {
  Conjunction: 0,
  'Semi-Sextile': 30,
  'Semi-Square': 45,
  Sextile: 60,
  Quintile: 72,
  Square: 90,
  Trine: 120,
  Sesquiquadrate: 135,
  BiQuintile: 144,
  Quincunx: 150,
  Opposition: 180
};

export const MAJOR_ASPECTS: Partial<Record<AspectName, number>> = {
  Conjunction: 0,
  Sextile: 60,
  Square: 90,
  Trine: 120,
  Opposition: 180
};

export const MINOR_ASPECTS: Partial<Record<AspectName, number>> = {
  'Semi-Sextile': 30,
  'Semi-Square': 45,
  Quintile: 72,
  Sesquiquadrate: 135,
  BiQuintile: 144,
  Quincunx: 150
};

export const ASPECT_META: Record<AspectName, AspectMeta> = {
  Conjunction: { angle: 0, sym: '☌', color: '#e8c766', major: true, abbr: 'CNJ' },
  'Semi-Sextile': { angle: 30, sym: '⚺', color: '#8bb8a0', major: false, abbr: 'SSx' },
  'Semi-Square': { angle: 45, sym: '∠', color: '#d88844', major: false, abbr: 'SSq' },
  Sextile: { angle: 60, sym: '⚹', color: '#7fb5e0', major: true, abbr: 'SXT' },
  Quintile: { angle: 72, sym: 'Q', color: '#b898d8', major: false, abbr: 'QNT' },
  Square: { angle: 90, sym: '□', color: '#e8a044', major: true, abbr: 'SQR' },
  Trine: { angle: 120, sym: '△', color: '#49c9b8', major: true, abbr: 'TRN' },
  Sesquiquadrate: { angle: 135, sym: '⚼', color: '#d06848', major: false, abbr: 'SsQ' },
  BiQuintile: { angle: 144, sym: 'bQ', color: '#9878c8', major: false, abbr: 'bQn' },
  Quincunx: { angle: 150, sym: '⚻', color: '#7898b8', major: false, abbr: 'QCX' },
  Opposition: { angle: 180, sym: '☍', color: '#e85a6a', major: true, abbr: 'OPP' }
};

export const PLANET_META: Record<PlanetName, PlanetMeta> = {
  Sun: { sym: '☉', color: '#e8c766', speed: 'fast' },
  Moon: { sym: '☽', color: '#cdd3e0', speed: 'fast' },
  Mercury: { sym: '☿', color: '#9fd8c9', speed: 'fast' },
  Venus: { sym: '♀', color: '#e0a4c4', speed: 'fast' },
  Mars: { sym: '♂', color: '#e1575a', speed: 'fast' },
  Jupiter: { sym: '♃', color: '#e0a344', speed: 'slow' },
  Saturn: { sym: '♄', color: '#8b93a7', speed: 'slow' },
  Uranus: { sym: '♅', color: '#7fd4e0', speed: 'outer' },
  Neptune: { sym: '♆', color: '#7f9fe0', speed: 'outer' },
  Pluto: { sym: '♇', color: '#9a7fe0', speed: 'outer' },
  NorthNode: { sym: '☊', color: '#e0a344', speed: 'node' },
  SouthNode: { sym: '☋', color: '#6b7280', speed: 'node' }
};

export const FAST_BODIES: PlanetName[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars'];

export const angDiff = (a: number, b: number): number => {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

export function findAspect(lonA: number, lonB: number, orb: number, aspects: Record<string, number> = ALL_ASPECTS) {
  const sep = angDiff(lonA, lonB);
  let best: { name: AspectName; orb: number } | null = null;
  for (const [name, angle] of Object.entries(aspects)) {
    const o = Math.abs(sep - angle);
    if (o <= orb && (best === null || o < best.orb)) {
      best = { name: name as AspectName, orb: o };
    }
  }
  return best;
}

export function findAspectAll(lonA: number, lonB: number, orb: number) {
  return findAspect(lonA, lonB, orb, ALL_ASPECTS);
}

export function signOf(lon: number) {
  const i = Math.floor(rev(lon) / 30);
  const deg = rev(lon) - i * 30;
  return { name: ZODIAC[i][0], sym: ZODIAC[i][1], deg };
}

export function fmtDeg(lon: number): string {
  const s = signOf(lon);
  const d = Math.floor(s.deg);
  const m = Math.round((s.deg - d) * 60);
  return `${d}°${m.toString().padStart(2, '0')}′ ${s.sym}`;
}
