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

export interface MarketPreset {
  name: string;
  symbol: string;
  priceLo: number;
  priceHi: number;
  defaultRangeDays: number;
}
