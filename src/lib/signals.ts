import { SignalDef, SignalTier, PlanetName, AspectName, SignalAction, SignalBoundary } from '../types';

export const SIGNALS: Record<string, Omit<SignalDef, 'key'>> = {
  'Sun|Semi-Square|depart|ceiling|UP': { lift: 3.45, p: 0.0001, tier: 'gold', nM: 5, ci: [1.54, 6.45], desc: '☉ Sun Semi-Square leaves ceiling → UP', direction: 'UP' },
  'Venus|Quintile|depart|ceiling|UP': { lift: 3.90, p: 0.0001, tier: 'gold', nM: 5, ci: [1.48, 7.72], desc: '♀ Venus Quintile leaves ceiling → UP', direction: 'UP' },
  'Mercury|Quintile|arrive|floor|UP': { lift: 3.39, p: 0.0003, tier: 'gold', nM: 5, ci: [1.49, 6.28], desc: '☿ Mercury Quintile arrives floor → UP', direction: 'UP' },
  'Mercury|Trine|depart|floor|ANY': { lift: 2.50, p: 0.0008, tier: 'gold', nM: 5, ci: [1.30, 4.17], desc: '☿ Mercury Trine leaves floor', direction: 'ANY' },
  'Mercury|Quintile|arrive|floor|ANY': { lift: 2.50, p: 0.0024, tier: 'gold', nM: 5, ci: [1.20, 4.28], desc: '☿ Mercury Quintile arrives floor', direction: 'ANY' },
  'Sun|Semi-Square|depart|ceiling|ANY': { lift: 2.48, p: 0.0018, tier: 'gold', nM: 5, ci: [1.25, 4.32], desc: '☉ Sun Semi-Square leaves ceiling', direction: 'ANY' },
  'Mercury|Trine|depart|floor|UP': { lift: 2.79, p: 0.0021, tier: 'gold', nM: 5, ci: [1.18, 5.12], desc: '☿ Mercury Trine leaves floor → UP', direction: 'UP' },
  'Venus|Square|depart|ceiling|DOWN': { lift: 2.73, p: 0.0039, tier: 'gold', nM: 5, ci: [1.10, 5.11], desc: '♀ Venus Square leaves ceiling → DOWN', direction: 'DOWN' },
  'Moon|Sextile|arrive|floor|UP': { lift: 1.59, p: 0.0106, tier: 'gold', nM: 5, ci: [1.07, 2.19], desc: '☽ Moon Sextile arrives floor → UP', direction: 'UP' },
  'Moon|Square|depart|floor|DOWN': { lift: 1.53, p: 0.0162, tier: 'gold', nM: 5, ci: [1.00, 2.14], desc: '☽ Moon Square leaves floor → DOWN', direction: 'DOWN' },
  'Mercury|Sesquiquadrate|arrive|ceiling|ANY': { lift: 2.20, p: 0.0110, tier: 'gold', nM: 5, ci: [1.02, 4.00], desc: '☿ Mercury Sesquiquadrate arrives ceiling', direction: 'ANY' },
  'Sun|Square|depart|floor|UP': { lift: 2.64, p: 0.0091, tier: 'gold', nM: 5, ci: [1.02, 5.17], desc: '☉ Sun Square leaves floor → UP', direction: 'UP' },
  'Sun|Sesquiquadrate|depart|floor|ANY': { lift: 2.48, p: 0.0160, tier: 'gold', nM: 5, ci: [1.02, 4.96], desc: '☉ Sun Sesquiquadrate leaves floor', direction: 'ANY' },
  'Venus|Semi-Sextile|arrive|ceiling|UP': { lift: 2.71, p: 0.0074, tier: 'silver', nM: 4, ci: [0.99, 5.31], desc: '♀ Venus Semi-Sextile arrives ceiling → UP', direction: 'UP' },
  'Mars|Opposition|depart|floor|UP': { lift: 5.02, p: 0.0024, tier: 'silver', nM: 4, ci: [0.90, 16.14], desc: '♂ Mars Opposition leaves floor → UP', direction: 'UP' },
  'Saturn|Quintile|arrive|ceiling|ANY': { lift: 9.91, p: 0.0019, tier: 'silver', nM: 4, ci: [0, 99], desc: '♄ Saturn Quintile arrives ceiling', direction: 'ANY' },
  'Sun|Sesquiquadrate|depart|floor|UP': { lift: 3.14, p: 0.0080, tier: 'silver', nM: 4, ci: [0.87, 6.65], desc: '☉ Sun Sesquiquadrate leaves floor → UP', direction: 'UP' },
  'Mercury|Semi-Square|depart|ceiling|UP': { lift: 2.24, p: 0.0151, tier: 'silver', nM: 4, ci: [0.95, 4.07], desc: '☿ Mercury Semi-Square leaves ceiling → UP', direction: 'UP' },
  'Mercury|Sextile|arrive|ceiling|DOWN': { lift: 2.42, p: 0.0111, tier: 'silver', nM: 4, ci: [0.97, 4.44], desc: '☿ Mercury Sextile arrives ceiling → DOWN', direction: 'DOWN' },
  'Sun|BiQuintile|arrive|floor|DOWN': { lift: 2.89, p: 0.0129, tier: 'silver', nM: 4, ci: [0.78, 6.20], desc: '☉ Sun BiQuintile arrives floor → DOWN', direction: 'DOWN' },
  'Mars|Quincunx|depart|floor|UP': { lift: 3.30, p: 0.0115, tier: 'silver', nM: 4, ci: [0.70, 7.99], desc: '♂ Mars Quincunx leaves floor → UP', direction: 'UP' },
  'Sun|Square|arrive|floor|UP': { lift: 2.58, p: 0.0171, tier: 'silver', nM: 4, ci: [0.76, 5.44], desc: '☉ Sun Square arrives floor → UP', direction: 'UP' },
  'Mercury|Sesquiquadrate|arrive|ceiling|DOWN': { lift: 2.51, p: 0.0199, tier: 'silver', nM: 4, ci: [0.76, 4.91], desc: '☿ Mercury Sesquiquadrate arrives ceiling → DOWN', direction: 'DOWN' },
  'Venus|Quintile|depart|ceiling|ANY': { lift: 2.28, p: 0.0204, tier: 'silver', nM: 4, ci: [0.97, 4.41], desc: '♀ Venus Quintile leaves ceiling', direction: 'ANY' },
  'Venus|Opposition|arrive|ceiling|UP': { lift: 3.86, p: 0.0107, tier: 'silver', nM: 4, ci: [0.74, 10.46], desc: '♀ Venus Opposition arrives ceiling → UP', direction: 'UP' },
  'Sun|Semi-Sextile|arrive|floor|DOWN': { lift: 2.51, p: 0.0199, tier: 'silver', nM: 4, ci: [0.84, 4.95], desc: '☉ Sun Semi-Sextile arrives floor → DOWN', direction: 'DOWN' },
  'Mars|Opposition|depart|floor|ANY': { lift: 3.31, p: 0.0205, tier: 'silver', nM: 4, ci: [0.66, 9.25], desc: '♂ Mars Opposition leaves floor', direction: 'ANY' },
  'Venus|Semi-Sextile|arrive|ceiling|ANY': { lift: 1.97, p: 0.0410, tier: 'silver', nM: 4, ci: [0.85, 3.60], desc: '♀ Venus Semi-Sextile arrives ceiling', direction: 'ANY' },
  'Venus|Quincunx|depart|ceiling|UP': { lift: 2.31, p: 0.0351, tier: 'silver', nM: 4, ci: [0.79, 4.71], desc: '♀ Venus Quincunx leaves ceiling → UP', direction: 'UP' },
  'Jupiter|Semi-Sextile|arrive|floor|DOWN': { lift: 4.65, p: 0.0110, tier: 'silver', nM: 4, ci: [0, 13.96], desc: '♃ Jupiter Semi-Sextile arrives floor → DOWN', direction: 'DOWN' },
  'Saturn|Quintile|arrive|ceiling|UP': { lift: 18.83, p: 0.0038, tier: 'silver', nM: 3, ci: [0, 99], desc: '♄ Saturn Quintile arrives ceiling → UP', direction: 'UP' },
  'Mercury|Sextile|arrive|ceiling|ANY': { lift: 1.78, p: 0.0448, tier: 'silver', nM: 3, ci: [0.91, 3.12], desc: '☿ Mercury Sextile arrives ceiling', direction: 'ANY' },
  'Venus|Quincunx|depart|ceiling|ANY': { lift: 1.91, p: 0.0490, tier: 'bronze', nM: 2, ci: [0.84, 3.57], desc: '♀ Venus Quincunx leaves ceiling', direction: 'ANY' },
  'Sun|Square|depart|floor|ANY': { lift: 1.91, p: 0.0504, tier: 'bronze', nM: 1, ci: [0.86, 3.48], desc: '☉ Sun Square leaves floor', direction: 'ANY' },
  'Jupiter|Sesquiquadrate|arrive|ceiling|ANY': { lift: 6.61, p: 0.0291, tier: 'bronze', nM: 1, ci: [0, 0], desc: '♃ Jupiter Sesquiquadrate arrives ceiling', direction: 'ANY' },
  'Jupiter|Square|arrive|ceiling|ANY': { lift: 6.61, p: 0.0291, tier: 'bronze', nM: 1, ci: [0, 0], desc: '♃ Jupiter Square arrives ceiling', direction: 'ANY' },
  'Jupiter|Square|depart|ceiling|ANY': { lift: 3.97, p: 0.0413, tier: 'bronze', nM: 1, ci: [0, 0], desc: '♃ Jupiter Square leaves ceiling', direction: 'ANY' },
  'Mars|Semi-Sextile|depart|ceiling|UP': { lift: 2.73, p: 0.0334, tier: 'bronze', nM: 1, ci: [0, 0], desc: '♂ Mars Semi-Sextile leaves ceiling → UP', direction: 'UP' },
  'Mercury|Trine|depart|floor|DOWN': { lift: 2.17, p: 0.0492, tier: 'bronze', nM: 1, ci: [0, 0], desc: '☿ Mercury Trine leaves floor → DOWN', direction: 'DOWN' },
  'Saturn|Trine|depart|ceiling|ANY': { lift: 4.96, p: 0.0199, tier: 'bronze', nM: 1, ci: [0, 0], desc: '♄ Saturn Trine leaves ceiling', direction: 'ANY' },
  'Sun|Sextile|depart|ceiling|UP': { lift: 2.35, p: 0.0465, tier: 'bronze', nM: 1, ci: [0, 0], desc: '☉ Sun Sextile leaves ceiling → UP', direction: 'UP' },
  'Sun|Trine|depart|ceiling|UP': { lift: 2.35, p: 0.0465, tier: 'bronze', nM: 1, ci: [0, 0], desc: '☉ Sun Trine leaves ceiling → UP', direction: 'UP' }
};

export const TIER_META: Record<SignalTier, { label: string; color: string; bg: string; border: string; icon: string }> = {
  gold: { label: 'GOLD', color: '#e8c766', bg: 'rgba(232, 199, 102, 0.15)', border: 'rgba(232, 199, 102, 0.35)', icon: '🥇' },
  silver: { label: 'SILVER', color: '#b0b8cc', bg: 'rgba(176, 184, 204, 0.12)', border: 'rgba(176, 184, 204, 0.30)', icon: '🥈' },
  bronze: { label: 'BRONZE', color: '#cd8c52', bg: 'rgba(205, 140, 82, 0.12)', border: 'rgba(205, 140, 82, 0.25)', icon: '🥉' }
};

export function getSignal(planet: PlanetName, aspect: AspectName, action: SignalAction, boundary: SignalBoundary): SignalDef | null {
  const keys = [
    `${planet}|${aspect}|${action}|${boundary}|UP`,
    `${planet}|${aspect}|${action}|${boundary}|DOWN`,
    `${planet}|${aspect}|${action}|${boundary}|ANY`
  ];
  let best: SignalDef | null = null;
  for (const k of keys) {
    const s = SIGNALS[k];
    if (s && (!best || s.lift > best.lift)) {
      best = { ...s, key: k };
    }
  }
  return best;
}

export function getAllSignals(planet: PlanetName, aspect: AspectName, action: SignalAction, boundary: SignalBoundary): SignalDef[] {
  const out: SignalDef[] = [];
  for (const dir of ['UP', 'DOWN', 'ANY'] as const) {
    const k = `${planet}|${aspect}|${action}|${boundary}|${dir}`;
    const s = SIGNALS[k];
    if (s) out.push({ ...s, key: k });
  }
  return out;
}
