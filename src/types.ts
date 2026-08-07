export interface PlanetPosition {
  lon: number;
  retro: boolean;
}

export type PlanetName = 
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars' 
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto' 
  | 'NorthNode' | 'SouthNode';

export type AspectName = 
  | 'Conjunction' | 'Semi-Sextile' | 'Semi-Square' | 'Sextile' 
  | 'Quintile' | 'Square' | 'Trine' | 'Sesquiquadrate' 
  | 'BiQuintile' | 'Quincunx' | 'Opposition';

export interface AspectMeta {
  angle: number;
  sym: string;
  color: string;
  major: boolean;
  abbr: string;
}

export interface PlanetMeta {
  sym: string;
  color: string;
  speed: 'fast' | 'slow' | 'outer' | 'node';
}

export type SignalTier = 'gold' | 'silver' | 'bronze';
export type SignalDirection = 'UP' | 'DOWN' | 'ANY';
export type SignalAction = 'depart' | 'arrive';
export type SignalBoundary = 'floor' | 'ceiling';

export interface SignalDef {
  key: string;
  lift: number;
  p: number;
  tier: SignalTier;
  nM: number;
  ci: [number, number];
  desc: string;
  direction: SignalDirection;
}

export interface MatrixHit {
  p: PlanetName;
  a: AspectName;
  o: number;
  retro: boolean;
}

export interface DayMatrix {
  [ring: number]: MatrixHit[];
}

export interface MatrixData {
  dates: string[];
  ring_lo: number;
  ring_hi: number;
  data: {
    [dateIso: string]: DayMatrix;
  };
}

export interface DepartureProjection {
  date: string | null;
  days: number | null;
}

export interface DepartureEvent {
  date: string;
  ring: number;
  price: number;
  body: PlanetName | '—';
  aspect: AspectName | '—';
  action: SignalAction;
  sig: SignalDef | null;
  wallKind: 'permanent' | 'strong';
  wallPct: number;
  lastOrb?: number;
  minOrb?: number;
  wallDrop?: boolean;
  tScore?: number;
  wallStrBefore?: number;
  wallStrAfter?: number;
  isWallDropOnly?: boolean;
}

export interface BoxLevel {
  ring: number;
  kind: 'perm' | 'strong';
  label: string;
  departures: DepartureEvent[];
}

export interface BoxBreakoutData {
  id: number;
  floor: number;
  ceil: number;
  interior: number[];
  edge: 'bottom' | 'top' | null;
  floorKind: 'perm' | 'strong';
  ceilKind: 'perm' | 'strong';
  levels: BoxLevel[];
}

export interface IntradayPPPoint {
  point: number;
  number: number;
  deg: number;
  price: number;
  hits: { planet: PlanetName; aspect: AspectName; orb: number }[];
  strength: number;
}

export interface WallSyncDetail {
  wallPrice: number;
  wallRing: number;
  kind: 'perm' | 'strong';
  syncRings: number[];
  syncPrices: number[];
}

export interface BoxWallMatch {
  matchedPrice: number;
  matchType: 'Direct Wall' | 'Sync Price';
  wallKind: 'perm' | 'strong';
  distancePct: number;
  offset?: number;
  angleDeg?: number;
  angleLabel?: string;
}

export interface BoxingDate {
  date: string;
  kind: 'perm' | 'strong';
  perm: number[];
  strong: number[];
  wallSyncs?: WallSyncDetail[];
  syncPrices?: number[];
  wallMatches?: BoxWallMatch[];
  hasWallMatch?: boolean;
  isWeekend?: boolean;
  snappedFrom?: string;
  swingConfluence?: SwingConfluenceResult;
}

export type BoxingDatesResult = BoxingDate[];

export interface MarketPreset {
  name: string;
  symbol: string;
  priceLo: number;
  priceHi: number;
  defaultRangeDays: number;
}

// Re-export convenience types for the tab (actual types live in gannSqrt.ts)
export type { GannDateEntry, GannProjection } from './lib/gannSqrt';

// ── Swing Pivot types ─────────────────────────────────────────────────────

/** One NIFTY 3%-ZigZag swing pivot (static dataset or user-entered). */
export interface SwingPivot {
  date: string;          // ISO "YYYY-MM-DD"
  type: 'High' | 'Low';
  price: number;
  ring: number;          // Math.floor(price / 100)
  spoke: number;         // ring % 36
}

/** User-entered swing pivot (same shape, runtime only). */
export type UserSwingPivot = SwingPivot;

/**
 * One anchor that contributed a projection onto a confluence date.
 * Exact relationship: anchorDate + spoke + 36 * cycleK === targetDate
 */
export interface SwingAnchor {
  date: string;
  type: 'High' | 'Low';
  price: number;
  ring: number;
  spoke: number;
  cycleK: number;          // which 36-cycle step projected to target
  daysProjected: number;   // total calendar days from anchor to target
}

/** Attached to a date when ≥2 distinct spoke-anchors converge on it. */
export interface SwingConfluenceResult {
  isConfluence: boolean;
  anchors: SwingAnchor[];
  spokeCount: number;
  highAnchors: number;
  lowAnchors: number;
}

