import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  LineStyle,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  CandlestickData,
  WhitespaceData,
  Time,
  SeriesMarker
} from 'lightweight-charts';
import {
  CandlestickChart,
  Play,
  RefreshCw,
  Key,
  Globe,
  Sliders,
  Layers,
  Sparkles,
  Shield,
  Zap,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Download,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  History,
  Calendar,
  CalendarDays,
  Box,
  Target,
  Star,
  Grid3X3
} from 'lucide-react';
import { MatrixData, DepartureEvent, PlanetName, AspectName, BoxWallMatch, SwingPivot, BoxingDate } from '../types';
import { scanCriticalDates, computeBoxingDates, computeMultiAnchorDates, computeRawBoxingDates, computeBoxBreakouts, ringToDegree, fromIso, checkCandleWallMatch, computeSyncPricesForWall, SYNC_RING_OFFSETS } from '../lib/matrix';
import { NIFTY_SWINGS } from '../data/niftySwings';
import { PLANET_META, ASPECT_META, BODY_LIST, getPositions, findAspectAll, daysSinceEpoch, sunGeocentric } from '../lib/astronomy';
import { getSignal, TIER_META } from '../lib/signals';
import { MatrixWallsModal } from './MatrixWallsModal';

function find42SignalMatch(planet: PlanetName, aspect: AspectName) {
  const actions = ['depart', 'arrive'] as const;
  const boundaries = ['floor', 'ceiling'] as const;
  let best: ReturnType<typeof getSignal> = null;
  for (const act of actions) {
    for (const bnd of boundaries) {
      const sig = getSignal(planet, aspect, act, bnd);
      if (sig && (!best || sig.lift > best.lift)) {
        best = sig;
      }
    }
  }
  return best;
}

const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function getDateStrInIST(time: number | string): string {
  if (!time) return '';
  let timeInSec: number;
  if (typeof time === 'string') {
    if (time.length >= 10 && time.includes('-')) return time.slice(0, 10);
    timeInSec = Number(time);
  } else {
    timeInSec = time;
  }
  if (typeof timeInSec !== 'number' || isNaN(timeInSec) || timeInSec <= 0) return '';
  try {
    const date = new Date(timeInSec * 1000);
    if (isNaN(date.getTime())) return '';
    return istDateFormatter.format(date);
  } catch (e) {
    return '';
  }
}

export type TimeZoneType = 'IST' | 'UTC' | 'EST' | 'GMT' | 'LOCAL';

export function formatTimestampInTZ(
  timeInSec: number,
  tz: TimeZoneType = 'IST',
  includeTime = true
): string {
  if (!timeInSec || isNaN(timeInSec)) return '';
  const date = new Date(timeInSec * 1000);
  if (isNaN(date.getTime())) return '';

  let ianaTz = 'Asia/Kolkata';
  let tzLabel = 'IST';

  if (tz === 'UTC' || tz === 'GMT') {
    ianaTz = 'UTC';
    tzLabel = tz;
  } else if (tz === 'EST') {
    ianaTz = 'America/New_York';
    tzLabel = 'EST';
  } else if (tz === 'LOCAL') {
    try {
      ianaTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
      tzLabel = 'LOCAL';
    } catch (e) {
      ianaTz = 'Asia/Kolkata';
      tzLabel = 'IST';
    }
  }

  try {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: ianaTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour12: false
    };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
      options.second = '2-digit';
    }

    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    parts.forEach((p) => { map[p.type] = p.value; });

    if (includeTime && map.hour !== undefined) {
      return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} (${tzLabel})`;
    }
    return `${map.year}-${map.month}-${map.day}`;
  } catch (e) {
    if (tz === 'IST') {
      const istDate = new Date(date.getTime() + 330 * 60 * 1000);
      const yyyy = istDate.getUTCFullYear();
      const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(istDate.getUTCDate()).padStart(2, '0');
      if (!includeTime) return `${yyyy}-${mm}-${dd}`;
      const hh = String(istDate.getUTCHours()).padStart(2, '0');
      const min = String(istDate.getUTCMinutes()).padStart(2, '0');
      const ss = String(istDate.getUTCSeconds()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} (IST)`;
    }
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }
}

interface TradingTerminalTabProps {
  matrix: MatrixData;
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  orb: number;
  minHighlight: number;
  userSwings?: SwingPivot[];
}

type TimeframeType = '15m' | '30m' | '1h' | '1d';

interface OHLCCandle {
  time: number; // unix timestamp in seconds
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function generateFutureWhitespace(
  candles: OHLCCandle[],
  targetEndDateStr: string,
  timeframe: TimeframeType
): WhitespaceData<Time>[] {
  if (candles.length === 0) return [];

  const lastCandle = candles[candles.length - 1];
  const lastDateObj = new Date(lastCandle.time * 1000);

  let endMs = new Date(targetEndDateStr + 'T23:59:59Z').getTime();
  if (isNaN(endMs)) {
    endMs = lastDateObj.getTime() + 45 * 86400 * 1000;
  }
  const minFutureEndMs = lastDateObj.getTime() + 45 * 86400 * 1000;
  if (endMs < minFutureEndMs) {
    endMs = minFutureEndMs;
  }

  const whitespace: WhitespaceData<Time>[] = [];
  const existingTimes = new Set<number>(candles.map((c) => c.time));

  let currMs = lastDateObj.getTime() + 86400 * 1000;

  while (currMs <= endMs) {
    const d = new Date(currMs);
    const dayOfWeek = d.getUTCDay(); // 0: Sun, 6: Sat

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const date = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;

      if (timeframe === '1d') {
        const tSec = Math.floor(new Date(`${dateStr}T00:00:00Z`).getTime() / 1000);
        if (!existingTimes.has(tSec)) {
          whitespace.push({ time: tSec as Time });
          existingTimes.add(tSec);
        }
      } else {
        const stepMinutes = timeframe === '15m' ? 15 : timeframe === '1h' ? 60 : 30;
        const startMin = 9 * 60 + 15; // 09:15 IST
        const endMin = 15 * 60 + 30; // 15:30 IST

        for (let m = startMin; m <= endMin; m += stepMinutes) {
          const hh = String(Math.floor(m / 60)).padStart(2, '0');
          const mm = String(m % 60).padStart(2, '0');
          const isoTimeStr = `${dateStr}T${hh}:${mm}:00+05:30`;
          const tSec = Math.floor(new Date(isoTimeStr).getTime() / 1000);
          if (!existingTimes.has(tSec)) {
            whitespace.push({ time: tSec as Time });
            existingTimes.add(tSec);
          }
        }
      }
    }
    currMs += 86400 * 1000;
  }

  return whitespace;
}

export const TradingTerminalTab: React.FC<TradingTerminalTabProps> = ({
  matrix,
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  orb,
  minHighlight,
  userSwings = []
}) => {
  // Chart & Data state
  const [timeframe, setTimeframe] = useState<TimeframeType>(() => {
    try {
      const saved = localStorage.getItem('tt_timeframe');
      if (saved && ['minute', '3m', '5m', '15m', '30m', '60m', 'day'].includes(saved)) {
        return saved as TimeframeType;
      }
    } catch (e) {}
    return '30m';
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFetchedInfo, setLastFetchedInfo] = useState<string>('');
  const [historyLoadedCount, setHistoryLoadedCount] = useState<number>(0);

  // Popout Mode State
  const [isPopout, setIsPopout] = useState<boolean>(false);

  // Overlays with LocalStorage Persistence
  const [showPermWalls, setShowPermWalls] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_showPermWalls');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [showStrongWalls, setShowStrongWalls] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_showStrongWalls');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [showAstroSignals, setShowAstroSignals] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_showAstroSignals');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [astroTierFilter, setAstroTierFilter] = useState<'all' | 'gold' | 'silver' | 'bronze'>(() => {
    try {
      const v = localStorage.getItem('tt_astroTierFilter');
      return v ? (JSON.parse(v) as any) : 'all';
    } catch (e) {
      return 'all';
    }
  });
  const [astroDirectionFilter, setAstroDirectionFilter] = useState<'all' | 'UP' | 'DOWN'>(() => {
    try {
      const v = localStorage.getItem('tt_astroDirectionFilter');
      return v ? (JSON.parse(v) as any) : 'all';
    } catch (e) {
      return 'all';
    }
  });
  const [showVolume, setShowVolume] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_showVolume');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [showConfluenceDates, setShowConfluenceDates] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_showConfluenceDates');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [showPermDates, setShowPermDates] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_showPermDates');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [timeZone, setTimeZone] = useState<TimeZoneType>(() => {
    try {
      const saved = localStorage.getItem('tt_timeZone');
      if (saved && ['IST', 'UTC', 'EST', 'GMT', 'LOCAL'].includes(saved)) {
        return saved as TimeZoneType;
      }
    } catch (e) {}
    return 'IST';
  });

  // Zerodha Kite API parameters
  const [kiteApiKey, setKiteApiKey] = useState<string>(() => localStorage.getItem('tt_kiteApiKey') || '');
  const [kiteAccessToken, setKiteAccessToken] = useState<string>(() => localStorage.getItem('tt_kiteAccessToken') || '');
  const [kiteEnctoken, setKiteEnctoken] = useState<string>(
    () =>
      localStorage.getItem('tt_kiteEnctoken') ||
      'h9CVFAGNIiKi0avcSn1HiPxfMTI19cVeVdLGj1p7MviLtlOfim6bD66J04nuwTeaP9Iy3vAeN0QAti05qu/EKz2rr4bmwmQyxvDtcO3UA0hHavtH18MOcQ=='
  );
  const [kiteInstrumentToken, setKiteInstrumentToken] = useState<string>(
    () => localStorage.getItem('tt_kiteInstrumentToken') || '256265'
  );
  const [kiteCustomUrl, setKiteCustomUrl] = useState<string>(
    () =>
      localStorage.getItem('tt_kiteCustomUrl') ||
      'https://kite.zerodha.com/oms/instruments/historical/{instrument_token}/{interval}?user_id=GW0461&oi=1&from={from}&to={to}'
  );
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);
  const [wallsModalOpen, setWallsModalOpen] = useState<boolean>(false);

  // Live Polling State
  const [isLivePolling, setIsLivePolling] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_isLivePolling');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [pollIntervalSec, setPollIntervalSec] = useState<number>(() => {
    try {
      const v = localStorage.getItem('tt_pollIntervalSec');
      return v !== null ? Number(v) : 10;
    } catch (e) {
      return 10;
    }
  });

  // Persist toggles & configuration state to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('tt_timeframe', timeframe);
      localStorage.setItem('tt_showPermWalls', JSON.stringify(showPermWalls));
      localStorage.setItem('tt_showStrongWalls', JSON.stringify(showStrongWalls));
      localStorage.setItem('tt_showAstroSignals', JSON.stringify(showAstroSignals));
      localStorage.setItem('tt_astroTierFilter', JSON.stringify(astroTierFilter));
      localStorage.setItem('tt_astroDirectionFilter', JSON.stringify(astroDirectionFilter));
      localStorage.setItem('tt_showVolume', JSON.stringify(showVolume));
      localStorage.setItem('tt_showPermDates', JSON.stringify(showPermDates));
      localStorage.setItem('tt_showConfluenceDates', JSON.stringify(showConfluenceDates));
      localStorage.setItem('tt_timeZone', timeZone);
      localStorage.setItem('tt_isLivePolling', JSON.stringify(isLivePolling));
      localStorage.setItem('tt_pollIntervalSec', String(pollIntervalSec));
      if (kiteApiKey) localStorage.setItem('tt_kiteApiKey', kiteApiKey);
      if (kiteAccessToken) localStorage.setItem('tt_kiteAccessToken', kiteAccessToken);
      if (kiteEnctoken) localStorage.setItem('tt_kiteEnctoken', kiteEnctoken);
      if (kiteInstrumentToken) localStorage.setItem('tt_kiteInstrumentToken', kiteInstrumentToken);
      if (kiteCustomUrl) localStorage.setItem('tt_kiteCustomUrl', kiteCustomUrl);
    } catch (e) {}
  }, [
    timeframe,
    showPermWalls,
    showStrongWalls,
    showAstroSignals,
    astroTierFilter,
    astroDirectionFilter,
    showVolume,
    showPermDates,
    showConfluenceDates,
    isLivePolling,
    pollIntervalSec,
    kiteApiKey,
    kiteAccessToken,
    kiteEnctoken,
    kiteInstrumentToken,
    kiteCustomUrl
  ]);

  // Active Candle Data
  const [candles, setCandles] = useState<OHLCCandle[]>([]);
  const [activeHoverCandle, setActiveHoverCandle] = useState<OHLCCandle | null>(null);
  const [crosshairPoint, setCrosshairPoint] = useState<{ x: number; y: number } | null>(null);

  // Canvas Refs & Async Tracking
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const markersPrimitiveRef = useRef<any>(null);
  const isFirstLoadRef = useRef<boolean>(true);
  const prevCandleCountRef = useRef<number>(0);
  const prevEarliestTimeRef = useRef<number | null>(null);

  const isLoadingOlderRef = useRef<boolean>(false);
  const candlesRef = useRef<OHLCCandle[]>(candles);
  const timeframeRef = useRef<TimeframeType>(timeframe);
  const allSeriesTimesRef = useRef<{ time: number; dateStr: string; index: number }[]>([]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  // Focus chart viewport on current date / latest price candle
  const focusOnCurrentDate = () => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let targetIndex = candles.findIndex((c) => {
      const d = new Date(c.time * 1000);
      const dStrLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dStrUtc = d.toISOString().split('T')[0];
      return dStrLocal === todayStr || dStrUtc === todayStr;
    });

    if (targetIndex === -1) {
      targetIndex = candles.length - 1; // Default to latest candle
    }

    const visibleBars = 75;
    const newRange = {
      from: Math.max(0, targetIndex - visibleBars + 12),
      to: targetIndex + 12
    };
    chart.timeScale().setVisibleLogicalRange(newRange);
    try {
      localStorage.setItem(`tt_range_${timeframeRef.current}`, JSON.stringify(newRange));
    } catch (e) {}
  };

  // ESC key listener to exit popout full-screen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPopout) {
        setIsPopout(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPopout]);

  // Zoom Action Handlers
  const handleZoomIn = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        const barsCount = range.to - range.from;
        const newBarsCount = Math.max(10, barsCount * 0.7);
        const center = (range.from + range.to) / 2;
        timeScale.setVisibleLogicalRange({
          from: center - newBarsCount / 2,
          to: center + newBarsCount / 2
        });
      }
    }
  };

  const handleZoomOut = () => {
    if (chartRef.current) {
      const timeScale = chartRef.current.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      if (range) {
        const barsCount = range.to - range.from;
        const newBarsCount = barsCount * 1.3;
        const center = (range.from + range.to) / 2;
        timeScale.setVisibleLogicalRange({
          from: center - newBarsCount / 2,
          to: center + newBarsCount / 2
        });
      }
    }
  };

  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
      const range = chartRef.current.timeScale().getVisibleLogicalRange();
      if (range) {
        try {
          localStorage.setItem(`tt_range_${timeframeRef.current}`, JSON.stringify(range));
        } catch (e) {}
      }
    }
  };

  // Load Older History when user scrolls back to the beginning
  const loadOlderHistory = async () => {
    const currentCandles = candlesRef.current;
    if (isLoadingOlderRef.current || currentCandles.length === 0) return;
    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const earliest = currentCandles[0];
      const earliestDate = new Date(earliest.time * 1000);

      // Target 30 days prior range
      const targetFromDate = new Date(earliestDate.getTime() - 30 * 86400 * 1000);
      const targetFromStr = targetFromDate.toISOString().split('T')[0];
      const targetToStr = earliestDate.toISOString().split('T')[0];

      let newOlderCandles: OHLCCandle[] = [];

      if (kiteEnctoken || (kiteApiKey && kiteAccessToken)) {
        const intervalMap: Record<TimeframeType, string> = {
          '15m': '15minute',
          '30m': '30minute',
          '1h': '60minute',
          '1d': 'day'
        };
        const kInterval = intervalMap[timeframe] || '30minute';
        const urlToFetch = kiteCustomUrl
          .replace('{instrument_token}', kiteInstrumentToken || '256265')
          .replace('{interval}', kInterval)
          .replace('{from}', targetFromStr)
          .replace('{to}', targetToStr);

        const queryParams = new URLSearchParams({ url: urlToFetch });
        if (kiteEnctoken) queryParams.set('enctoken', kiteEnctoken.trim());
        if (kiteApiKey) queryParams.set('apiKey', kiteApiKey.trim());
        if (kiteAccessToken) queryParams.set('accessToken', kiteAccessToken.trim());

        const res = await fetch(`/api/proxy/kite?${queryParams.toString()}`);
        const json = await res.json();

        if (json.status === 'success' && json.data?.candles && Array.isArray(json.data.candles)) {
          newOlderCandles = json.data.candles
            .map((c: any) => {
              const dt = new Date(c[0]);
              return {
                time: Math.floor(dt.getTime() / 1000),
                timeStr: dt.toISOString(),
                open: Number(c[1]),
                high: Number(c[2]),
                low: Number(c[3]),
                close: Number(c[4]),
                volume: Number(c[5] || 0)
              };
            })
            .filter((c: OHLCCandle) => c.time < earliest.time);
        }
      }

      if (newOlderCandles.length > 0) {
        setCandles((prev) => {
          const existingTimes = new Set(prev.map((c) => c.time));
          const filteredNew = newOlderCandles.filter((c) => !existingTimes.has(c.time));
          const combined = [...filteredNew, ...prev].sort((a, b) => a.time - b.time);
          return combined;
        });
        setHistoryLoadedCount((prev) => prev + newOlderCandles.length);
        setLastFetchedInfo(`Historical scroll-back: Prepend ${newOlderCandles.length} older Zerodha bars`);
      }
    } catch (err) {
      console.warn('[Load Older History Error]', err);
    } finally {
      setIsLoadingOlder(false);
      isLoadingOlderRef.current = false;
    }
  };

  // Extract S/R Permanent & Strong Walls from Matrix
  const validDates = useMemo(() => {
    return matrix.dates.filter((d) => d >= dateFrom && d <= dateTo);
  }, [matrix, dateFrom, dateTo]);

  const nDays = validDates.length || 1;
  const ringLo = Math.floor(priceLo / 100);
  const ringHi = Math.ceil(priceHi / 100);

  const { permWalls, strongWalls } = useMemo(() => {
    const perm: number[] = [];
    const strong: number[] = [];

    for (let r = ringLo; r <= ringHi; r++) {
      let hitsCount = 0;
      for (const d of validDates) {
        if (
          matrix.data[d] &&
          matrix.data[d][r] &&
          matrix.data[d][r].length >= minHighlight
        ) {
          hitsCount++;
        }
      }
      const pct = hitsCount / nDays;
      if (pct >= 0.90) {
        perm.push(r * 100);
      } else if (pct >= 0.50) {
        strong.push(r * 100);
      }
    }

    return {
      permWalls: perm.sort((a, b) => a - b),
      strongWalls: strong.filter((r) => !perm.includes(r)).sort((a, b) => a - b)
    };
  }, [matrix, validDates, nDays, ringLo, ringHi, minHighlight]);

  // 36-Harmonic Boxing Dates Calculation
  const rawBoxingDates = useMemo(() => {
    return computeRawBoxingDates(dateFrom, dateTo, permWalls, strongWalls, userSwings, true);
  }, [dateFrom, dateTo, permWalls, strongWalls, userSwings]);

  const filteredBoxingDates = useMemo(() => {
    return rawBoxingDates.filter((bd) => {
      const isConfluence = bd.swingConfluence?.anchors && bd.swingConfluence.anchors.length > 0;
      const isPerm = bd.perm && bd.perm.length > 0;

      if (isConfluence && !showConfluenceDates) return false;
      if (isPerm && !isConfluence && !showPermDates) return false;
      if (!isConfluence && !isPerm && !showPermDates) return false;

      return true;
    });
  }, [rawBoxingDates, showConfluenceDates, showPermDates]);

  const confluenceDatesCount = useMemo(
    () => rawBoxingDates.filter((b) => b.swingConfluence?.anchors && b.swingConfluence.anchors.length > 0).length,
    [rawBoxingDates]
  );
  const permDatesCount = useMemo(
    () => rawBoxingDates.filter((b) => b.perm && b.perm.length > 0).length,
    [rawBoxingDates]
  );

  // Gann Box Breakout Channels Calculation
  const gannBoxes = useMemo(() => {
    return computeBoxBreakouts(matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight);
  }, [matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight]);

  // Active Candle Data
  const displayCandle = useMemo(() => {
    return activeHoverCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
  }, [activeHoverCandle, candles]);

  // Matrix Aspect calculations for Hovered Date & Price (matching closest Main/Strong Wall + Boxing Info)
  const hoverAstroInfo = useMemo(() => {
    const targetCandle = displayCandle;
    if (!targetCandle) return null;

    const dateStr = targetCandle.time ? getDateStrInIST(targetCandle.time) : targetCandle.timeStr.slice(0, 10);
    const hoverPrice = targetCandle.close;

    // Find closest wall among Main Walls (permWalls) and Strong Walls (strongWalls)
    const candidateWalls: Array<{ price: number; type: 'Main Wall' | 'Strong Wall' }> = [
      ...permWalls.map((w) => ({ price: w, type: 'Main Wall' as const })),
      ...strongWalls.map((w) => ({ price: w, type: 'Strong Wall' as const }))
    ];

    let closestWall: { price: number; type: 'Main Wall' | 'Strong Wall' | 'Ring Wall'; distance: number };

    if (candidateWalls.length > 0) {
      candidateWalls.sort((a, b) => {
        const distA = Math.abs(a.price - hoverPrice);
        const distB = Math.abs(b.price - hoverPrice);
        if (distA !== distB) return distA - distB;
        return a.type === 'Main Wall' ? -1 : 1;
      });
      const best = candidateWalls[0];
      closestWall = {
        price: best.price,
        type: best.type,
        distance: Math.abs(best.price - hoverPrice)
      };
    } else {
      const hoverRing = Math.round(hoverPrice / 100);
      closestWall = {
        price: hoverRing * 100,
        type: 'Ring Wall',
        distance: Math.abs(hoverRing * 100 - hoverPrice)
      };
    }

    const wallRing = Math.round(closestWall.price / 100);

    // 1. Matrix Price Ring Aspect Hits for the closest Main/Strong Wall on hovered date
    let wallAspectHits: Array<{ p: PlanetName; a: AspectName; o: number; retro?: boolean }> = [];
    if (matrix.data[dateStr] && matrix.data[dateStr][wallRing]) {
      wallAspectHits = matrix.data[dateStr][wallRing];
    } else {
      try {
        const dObj = fromIso(dateStr);
        const pos = getPositions(dObj);
        const deg = ringToDegree(wallRing);
        for (const [pName, pVal] of Object.entries(pos)) {
          const asp = findAspectAll(pVal.lon, deg, orb);
          if (asp) {
            wallAspectHits.push({
              p: pName as PlanetName,
              a: asp.name,
              o: +asp.orb.toFixed(2),
              retro: pVal.retro
            });
          }
        }
      } catch (e) {}
    }

    // 2. Date Boxing Match
    const matchedBoxingDate = rawBoxingDates.find(
      (bd) => bd.date === dateStr || bd.snappedFrom === dateStr
    );
    const nextBoxingDate = rawBoxingDates.find((bd) => bd.date > dateStr);
    const candleWallMatches = (matchedBoxingDate && targetCandle)
      ? checkCandleWallMatch(targetCandle, matchedBoxingDate)
      : [];

    // 3. Price Boxing & Gann Box Channel Info
    const activeGannBox = gannBoxes.find(
      (b) => hoverPrice >= b.floor * 100 && hoverPrice <= b.ceil * 100
    );

    let priceBoxingDetails: {
      boxId: number;
      floorPrice: number;
      ceilPrice: number;
      boxWidth: number;
      gapToFloor: number;
      gapToCeil: number;
      boxPct: number;
      interiorPrices: number[];
      isOutside?: boolean;
    } | null = null;

    if (activeGannBox) {
      const floorPrice = activeGannBox.floor * 100;
      const ceilPrice = activeGannBox.ceil * 100;
      const boxWidth = ceilPrice - floorPrice;
      const gapToFloor = hoverPrice - floorPrice;
      const gapToCeil = ceilPrice - hoverPrice;
      const boxPct = boxWidth > 0 ? ((hoverPrice - floorPrice) / boxWidth) * 100 : 50;

      priceBoxingDetails = {
        boxId: activeGannBox.id,
        floorPrice,
        ceilPrice,
        boxWidth,
        gapToFloor,
        gapToCeil,
        boxPct,
        interiorPrices: activeGannBox.interior.map((i) => i * 100)
      };
    } else if (gannBoxes.length > 0) {
      let nearestBox = gannBoxes[0];
      let minGap = Infinity;
      gannBoxes.forEach((b) => {
        const mid = ((b.floor + b.ceil) * 100) / 2;
        const dist = Math.abs(hoverPrice - mid);
        if (dist < minGap) {
          minGap = dist;
          nearestBox = b;
        }
      });
      const floorPrice = nearestBox.floor * 100;
      const ceilPrice = nearestBox.ceil * 100;
      priceBoxingDetails = {
        boxId: nearestBox.id,
        floorPrice,
        ceilPrice,
        boxWidth: ceilPrice - floorPrice,
        gapToFloor: hoverPrice - floorPrice,
        gapToCeil: ceilPrice - hoverPrice,
        boxPct: hoverPrice < floorPrice ? 0 : 100,
        interiorPrices: nearestBox.interior.map((i) => i * 100),
        isOutside: true
      };
    }

    // 4. Matrix Hits for this date across all rings
    let matrixRingCount = 0;
    let matrixHitCount = 0;
    if (matrix.data[dateStr]) {
      matrixRingCount = Object.keys(matrix.data[dateStr]).length;
      for (const hits of Object.values(matrix.data[dateStr])) {
        if (Array.isArray(hits)) {
          matrixHitCount += hits.length;
        }
      }
    }

    // 5. Compute Harmonics / Sync Targets for this date or closest wall
    let syncTargets: Array<{ price: number; label: string; angleLabel: string }> = [];

    if (matchedBoxingDate && matchedBoxingDate.syncPrices && matchedBoxingDate.syncPrices.length > 0) {
      syncTargets = matchedBoxingDate.syncPrices.map((sp) => {
        let angleLabel = 'Sync';
        if (matchedBoxingDate.wallSyncs) {
          for (const ws of matchedBoxingDate.wallSyncs) {
            if (ws.syncPrices.includes(sp)) {
              const offset = Math.round((sp - ws.wallPrice) / 100);
              const angleDeg = offset * 10;
              angleLabel = offset === 0 ? '0°' : (offset > 0 ? `+${angleDeg}°` : `${angleDeg}°`);
              break;
            }
          }
        }
        return { price: sp, label: 'Sync Target', angleLabel };
      });
    } else if (closestWall && closestWall.price > 0) {
      const wallSync = computeSyncPricesForWall(closestWall.price, 'perm');
      syncTargets = wallSync.syncPrices.map((sp, idx) => {
        const offsetItem = SYNC_RING_OFFSETS[idx];
        return {
          price: sp,
          label: offsetItem ? offsetItem.label : 'Harmonic Sync',
          angleLabel: offsetItem ? offsetItem.abbr : '0°'
        };
      });
    }

    const wallP = closestWall.price;
    const closestWallHarmonics = {
      wallPrice: wallP,
      type: closestWall.type,
      h0: wallP,
      h90: [wallP - 900, wallP + 900],
      h120: [wallP - 1200, wallP + 1200],
      h180: [wallP - 1800, wallP + 1800]
    };

    // Date Wheel Spoke S & 36-Harmonic Price Arithmetic (S + 36 * k)
    let dateSpoke = 0;
    let dateDegree = 0;

    if (matchedBoxingDate?.swingConfluence?.anchors?.[0]?.spoke !== undefined) {
      dateSpoke = matchedBoxingDate.swingConfluence.anchors[0].spoke;
      dateDegree = dateSpoke * 10;
    } else if (matchedBoxingDate && (matchedBoxingDate.perm.length > 0 || matchedBoxingDate.strong.length > 0)) {
      const w = matchedBoxingDate.perm[0] || matchedBoxingDate.strong[0];
      const r = Math.floor(w / 100);
      dateSpoke = ((r % 36) + 36) % 36;
      dateDegree = dateSpoke * 10;
    } else {
      const dateObj = fromIso(dateStr);
      const dDays = daysSinceEpoch(dateObj);
      const sunObj = sunGeocentric(dDays);
      dateDegree = Math.round(sunObj.lon) % 360;
      dateSpoke = Math.round(sunObj.lon / 10) % 36;
    }

    const mktPrice = hoverPrice || displayCandle?.close || 24000;
    const k = Math.round((mktPrice - dateSpoke) / 36);
    const pHarmExact = dateSpoke + 36 * k;
    const pHarmPrev = dateSpoke + 36 * (k - 1);
    const pHarmNext = dateSpoke + 36 * (k + 1);

    const kRing = Math.round((Math.floor(mktPrice / 100) - dateSpoke) / 36);
    const pRingHarm = (dateSpoke + 36 * kRing) * 100;

    const isExactHarmonicHit = Boolean(displayCandle && (
      (displayCandle.low <= pHarmExact && displayCandle.high >= pHarmExact) ||
      Math.abs(displayCandle.close - pHarmExact) / pHarmExact <= 0.0025
    ));

    const isRingHarmonicHit = Boolean(displayCandle && (
      (displayCandle.low <= pRingHarm && displayCandle.high >= pRingHarm) ||
      Math.abs(displayCandle.close - pRingHarm) / pRingHarm <= 0.0025
    ));

    const isHarmonicMatch = isExactHarmonicHit || isRingHarmonicHit;

    const dateHarmonics = {
      dateSpoke,
      dateDegree,
      kMultiplier: k,
      pHarmExact,
      pHarmPrev,
      pHarmNext,
      kRingMultiplier: kRing,
      pRingHarm,
      ringH0: pRingHarm,
      ringH90: [pRingHarm - 900, pRingHarm + 900],
      ringH120: [pRingHarm - 1200, pRingHarm + 1200],
      ringH180: [pRingHarm - 1800, pRingHarm + 1800],
      isHarmonicMatch,
      isExactHarmonicHit,
      isRingHarmonicHit
    };

    return {
      dateStr,
      hoverPrice,
      closestWall,
      closestWallHarmonics,
      dateHarmonics,
      wallAspectHits,
      matrixRingCount,
      matrixHitCount,
      matchedBoxingDate,
      nextBoxingDate,
      priceBoxingDetails,
      candleWallMatches,
      syncTargets
    };
  }, [displayCandle, matrix, permWalls, strongWalls, orb, rawBoxingDates, gannBoxes]);

  // Extract Critical Astro Signals
  const rawAstroEvents = useMemo(() => {
    const raw = scanCriticalDates(matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight);
    const signalMap = new Map<string, DepartureEvent>();

    raw.forEach((e) => {
      if (e.sig) {
        const key = `${e.date}_${e.price}_${e.body}_${e.aspect}`;
        const existing = signalMap.get(key);
        if (!existing || (e.sig.lift || 0) > (existing.sig?.lift || 0)) {
          signalMap.set(key, e);
        }
      }
    });

    return Array.from(signalMap.values());
  }, [matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight]);

  const filteredAstroEvents = useMemo(() => {
    const visibleCandleDates = new Set(candles.map((c) => getDateStrInIST(c.time)));
    return rawAstroEvents
      .filter((ev) => {
        if (!ev.sig) return false;
        // Highlight astro signals ONLY on displayed/evaluated dates (visible candles)
        if (!visibleCandleDates.has(ev.date)) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rawAstroEvents, candles]);

  // Pointing Arrow Leader Line Overlay Redraw Logic
  const redrawLeaderCalloutsRef = useRef<() => void>(() => {});

  const getDowStr = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00Z');
      return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    } catch (e) {
      return '';
    }
  };

  const findXCoordinateForDate = useCallback((targetDateStr: string): number | null => {
    if (!targetDateStr) return null;
    const chart = chartRef.current;
    if (!chart) return null;

    const seriesTimes = allSeriesTimesRef.current;
    if (seriesTimes.length > 0) {
      // 1. Try exact match for targetDateStr in IST
      const exactMatch = seriesTimes.find((s) => s.dateStr === targetDateStr);
      if (exactMatch) {
        return chart.timeScale().logicalToCoordinate(exactMatch.index);
      }

      // 2. If targetDateStr is a weekend/holiday, find the first bar whose IST date >= targetDateStr
      const nextMatch = seriesTimes.find((s) => s.dateStr >= targetDateStr);
      if (nextMatch) {
        return chart.timeScale().logicalToCoordinate(nextMatch.index);
      }

      // 3. Fallback: closest bar in series
      const targetSec = Math.floor(new Date(targetDateStr + 'T00:00:00Z').getTime() / 1000);
      let closestIndex = -1;
      let minDiff = Infinity;

      for (let i = 0; i < seriesTimes.length; i++) {
        const item = seriesTimes[i];
        const itemSec = typeof item.time === 'number' ? item.time : Math.floor(new Date(String(item.time) + 'T00:00:00Z').getTime() / 1000);
        if (isNaN(itemSec)) continue;
        const diff = Math.abs(itemSec - targetSec);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = item.index;
        }
      }

      if (closestIndex >= 0) {
        return chart.timeScale().logicalToCoordinate(closestIndex);
      }
    }

    const currentCandles = candlesRef.current;
    if (currentCandles.length === 0) return null;

    const targetSec = Math.floor(new Date(targetDateStr + 'T00:00:00Z').getTime() / 1000);
    const lastCandle = currentCandles[currentCandles.length - 1];
    const calendarDaysDiff = (targetSec - lastCandle.time) / 86400;

    let candlesPerDay = 5 / 7;
    const tf = timeframeRef.current;
    if (tf === '15m') candlesPerDay = 25 * (5 / 7);
    else if (tf === '30m') candlesPerDay = 13 * (5 / 7);
    else if (tf === '1h') candlesPerDay = 6.25 * (5 / 7);
    else if (tf === '1d') candlesPerDay = 5 / 7;

    const futureBarOffset = calendarDaysDiff * candlesPerDay;
    const lastIndex = currentCandles.length - 1;
    const targetLogicalIndex = lastIndex + futureBarOffset;

    return chart.timeScale().logicalToCoordinate(targetLogicalIndex);
  }, []);

  const redrawLeaderCallouts = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const container = chartContainerRef.current;

    if (!canvas || !container || !chart || !candleSeries) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Boxing Dates as clean vertical lines with top date badges across chart canvas
    if (showPermDates || showConfluenceDates) {
      let lastX = -999;
      let lastYLevel = 0;

      // Group filteredBoxingDates by date to ensure at most 1 merged badge per day
      const dateMap = new Map<string, BoxingDate[]>();
      filteredBoxingDates.forEach((bd) => {
        const list = dateMap.get(bd.date) || [];
        list.push(bd);
        dateMap.set(bd.date, list);
      });

      dateMap.forEach((bdList, dateStr) => {
        const x = findXCoordinateForDate(dateStr) ?? (bdList[0].snappedFrom ? findXCoordinateForDate(bdList[0].snappedFrom) : null);
        if (x !== null && x >= -30 && x <= width + 30) {
          const hasConfluence = bdList.some((b) => b.swingConfluence?.anchors && b.swingConfluence.anchors.length > 0);
          const isPerm = bdList.some((b) => b.perm && b.perm.length > 0) || bdList.some((b) => b.kind === 'perm');
          const dowStr = getDowStr(dateStr);

          // Check if any candle on this 36-H boxing date hits a price-date wall match
          const candlesOnDate = candlesRef.current.filter((c) => {
            const cDate = getDateStrInIST(c.time);
            return cDate === dateStr || (bdList[0]?.snappedFrom && cDate === bdList[0].snappedFrom);
          });
          const allWallMatches = bdList.flatMap((b) => candlesOnDate.flatMap((c) => checkCandleWallMatch(c, b)));
          const hasWallMatch = allWallMatches.length > 0;

          let color = '#f59e0b';
          let tagText = `🥊 PERM ${dateStr.slice(5)} (${dowStr})`;

          if (hasConfluence) {
            const anchorCount = bdList.reduce((acc, b) => acc + (b.swingConfluence?.anchors?.length || 0), 0);
            color = '#c084fc';
            tagText = `◈ CONF${anchorCount > 1 ? ` (${anchorCount})` : ''} ${dateStr.slice(5)} (${dowStr})`;
          } else if (isPerm) {
            color = '#f59e0b';
            tagText = `🥊 PERM ${dateStr.slice(5)} (${dowStr})`;
          }

          if (hasWallMatch) {
            color = '#fbbf24';
            tagText += ' ⭐';
          }

          ctx.save();
          ctx.font = 'bold 10px Inter, system-ui, sans-serif';

          const textWidth = ctx.measureText(tagText).width;
          const badgeWidth = textWidth + 12;
          const badgeHeight = 18;

          // Stagger top badge level if close to previous date
          let yLevel = 0;
          if (Math.abs(x - lastX) < badgeWidth + 8) {
            yLevel = (lastYLevel + 1) % 2;
          }
          lastX = x;
          lastYLevel = yLevel;

          const topY = 6 + yLevel * 22;

          // Draw full-height vertical line starting below the badge
          ctx.beginPath();
          ctx.setLineDash(hasWallMatch ? [3, 2] : isPerm ? [6, 4] : [3, 3]);
          ctx.strokeStyle = hasWallMatch ? '#fbbf24' : color;
          ctx.globalAlpha = hasWallMatch ? 1.0 : isPerm ? 0.85 : 0.65;
          ctx.lineWidth = hasWallMatch ? 2.0 : isPerm ? 1.5 : 1.2;
          ctx.moveTo(x, topY + badgeHeight);
          ctx.lineTo(x, height - 26);
          ctx.stroke();

          // Draw compact 1-line pill tag box (Vertical Label)
          const badgeX = Math.max(badgeWidth / 2 + 4, Math.min(width - badgeWidth / 2 - 4, x));

          // Badge Background box
          ctx.fillStyle = hasWallMatch ? '#451a03' : '#0f172a';
          ctx.strokeStyle = hasWallMatch ? '#fbbf24' : color;
          ctx.lineWidth = hasWallMatch ? 1.5 : 1;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.roundRect(badgeX - badgeWidth / 2, topY, badgeWidth, badgeHeight, 4);
          ctx.fill();
          ctx.stroke();

          // Render 1-line text inside badge
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = hasWallMatch ? '#fbbf24' : color;
          ctx.fillText(tagText, badgeX, topY + badgeHeight / 2);

          ctx.restore();
        }
      });
    }

    ctx.restore();
  }, [showPermDates, showConfluenceDates, filteredBoxingDates, findXCoordinateForDate]);

  useEffect(() => {
    redrawLeaderCalloutsRef.current = redrawLeaderCallouts;
  }, [redrawLeaderCallouts]);

  useEffect(() => {
    requestAnimationFrame(() => redrawLeaderCalloutsRef.current());
  }, [redrawLeaderCallouts]);

  // Construct Kite Live URL string for preview/fetch
  const constructedKiteUrl = useMemo(() => {
    let intervalStr = '30minute';
    if (timeframe === '15m') intervalStr = '15minute';
    if (timeframe === '1h') intervalStr = '60minute';
    if (timeframe === '1d') intervalStr = 'day';

    let url = kiteCustomUrl
      .replace('{instrument_token}', kiteInstrumentToken || '256265')
      .replace('{interval}', intervalStr)
      .replace('{from}', dateFrom)
      .replace('{to}', dateTo);

    return url;
  }, [kiteCustomUrl, kiteInstrumentToken, timeframe, dateFrom, dateTo]);

  // Fetch / Load Market Candles from Zerodha Kite
  const loadCandles = async (isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
      isFirstLoadRef.current = true;
    }
    setErrorMsg(null);

    try {
      if (!kiteEnctoken && (!kiteApiKey || !kiteAccessToken)) {
        setLastFetchedInfo('Please enter your Zerodha Enctoken or API Key in the configuration panel below to connect.');
        if (!isSilent) setIsLoading(false);
        return;
      }

      const queryParams = new URLSearchParams({
        url: constructedKiteUrl
      });

      if (kiteEnctoken) queryParams.append('enctoken', kiteEnctoken);
      if (kiteApiKey) queryParams.append('apiKey', kiteApiKey);
      if (kiteAccessToken) queryParams.append('accessToken', kiteAccessToken);

      const res = await fetch(`/api/proxy/kite?${queryParams.toString()}`);
      const json = await res.json();

      if (json.status === 'success' && json.data && Array.isArray(json.data.candles)) {
        const formatted: OHLCCandle[] = json.data.candles.map((c: any) => {
          const dateObj = new Date(c[0]);
          return {
            time: Math.floor(dateObj.getTime() / 1000),
            timeStr: c[0],
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5] || 0)
          };
        });

        if (isSilent) {
          setCandles((prev) => {
            if (prev.length === 0 || formatted.length === 0) return formatted;
            const firstFormattedTime = formatted[0].time;
            const olderPrepended = prev.filter((c) => c.time < firstFormattedTime);
            return [...olderPrepended, ...formatted];
          });
        } else {
          setCandles((prev) => {
            if (prev.length === 0 || formatted.length === 0) return formatted;
            const firstFormattedTime = formatted[0].time;
            const olderPrepended = prev.filter((c) => c.time < firstFormattedTime);
            if (olderPrepended.length > 0) {
              return [...olderPrepended, ...formatted];
            }
            return formatted;
          });
        }
        const timeNow = new Date().toLocaleTimeString();
        setLastFetchedInfo(`Live Market Synced at ${timeNow} (${formatted.length} candles from Zerodha)`);
      } else {
        if (!isSilent) {
          setCandles([]);
          setErrorMsg(json.message || 'Failed to load candles from Zerodha Kite API');
          setLastFetchedInfo('Zerodha Kite API returned an error. Check credentials or instrument token.');
        }
      }
    } catch (err: any) {
      if (!isSilent) {
        console.warn('[Zerodha Kite Fetch Error]', err);
        setErrorMsg(err.message || 'Network error fetching Zerodha Kite candles');
        setLastFetchedInfo('Failed to connect to Zerodha Kite proxy.');
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  // Initial load or refresh when timeframe / dates change
  useEffect(() => {
    loadCandles();
  }, [timeframe, dateFrom, dateTo, kiteEnctoken, kiteApiKey, kiteAccessToken, kiteInstrumentToken]);

  // Auto-poll Zerodha Kite candles during live market
  useEffect(() => {
    if (!isLivePolling || pollIntervalSec <= 0) return;
    const interval = setInterval(() => {
      loadCandles(true);
    }, Math.max(1, pollIntervalSec) * 1000);
    return () => clearInterval(interval);
  }, [isLivePolling, pollIntervalSec, constructedKiteUrl, kiteEnctoken, kiteApiKey, kiteAccessToken, kiteInstrumentToken]);

  // 1. Initialize TradingView Lightweight Chart Canvas Instance (mount / unmount / container resize)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const initialHeight = container.clientHeight > 100 ? container.clientHeight : (isPopout ? Math.max(680, window.innerHeight - 100) : 600);

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8'
      },
      grid: {
        vertLines: { color: 'rgba(51, 65, 85, 0.25)' },
        horzLines: { color: 'rgba(51, 65, 85, 0.25)' }
      },
      localization: {
        timeFormatter: (timeSec: number) => formatTimestampInTZ(timeSec, timeZone, timeframe !== '1d')
      },
      crosshair: {
        mode: 1
      },
      rightPriceScale: {
        borderColor: '#334155',
        autoScale: true
      },
      timeScale: {
        borderColor: '#334155',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 25
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      },
      width: container.clientWidth,
      height: initialHeight
    });

    chartRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    });
    candleSeriesRef.current = candleSeries;

    // Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#38bdf8',
      priceFormat: {
        type: 'volume'
      },
      priceScaleId: 'volume_scale'
    });

    chart.priceScale('volume_scale').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0
      }
    });
    volumeSeriesRef.current = volumeSeries;

    // Subscribe to scroll-back range change for infinite history loading and persist zoom/pan state
    const handleLogicalRangeChange = (logicalRange: any) => {
      if (logicalRange) {
        try {
          localStorage.setItem(`tt_range_${timeframeRef.current}`, JSON.stringify(logicalRange));
        } catch (e) {}
        if (logicalRange.from < 3 && !isLoadingOlderRef.current && candlesRef.current.length > 0) {
          loadOlderHistory();
        }
      }
      if (redrawLeaderCalloutsRef.current) {
        requestAnimationFrame(() => redrawLeaderCalloutsRef.current());
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);

    // Subscribe to crosshair move for tooltip & overlay callout redraw
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.get(candleSeries)) {
        const matched = candlesRef.current.find((c) => c.time === param.time);
        if (matched) {
          setActiveHoverCandle(matched);
          if (param.point) {
            setCrosshairPoint({ x: param.point.x, y: param.point.y });
          }
        }
      } else {
        if (!param.point) {
          setCrosshairPoint(null);
        }
      }
      if (redrawLeaderCalloutsRef.current) {
        requestAnimationFrame(() => redrawLeaderCalloutsRef.current());
      }
    });

    // Resize observer
    const handleResize = () => {
      if (container && chartRef.current) {
        const clientWidth = container.clientWidth;
        const clientHeight = container.clientHeight;
        const fallbackH = isPopout ? Math.max(680, window.innerHeight - 100) : Math.max(600, window.innerHeight - 140);
        chartRef.current.applyOptions({
          width: clientWidth,
          height: clientHeight > 100 ? clientHeight : fallbackH
        });
        if (redrawLeaderCalloutsRef.current) {
          requestAnimationFrame(() => redrawLeaderCalloutsRef.current());
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    // Mark as first load when chart instance is created
    isFirstLoadRef.current = true;

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      priceLinesRef.current = [];
      markersPrimitiveRef.current = null;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      }
    };
  }, [isPopout]);

  // Apply chart option updates when timeZone or timeframe changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.applyOptions({
        localization: {
          timeFormatter: (timeSec: number) => formatTimestampInTZ(timeSec, timeZone, timeframe !== '1d')
        }
      });
      if (redrawLeaderCalloutsRef.current) {
        requestAnimationFrame(redrawLeaderCalloutsRef.current);
      }
    }
  }, [timeZone, timeframe]);

  // 2. Update Series Data, Price Lines & Astro Markers without resetting Zoom or Re-creating Chart
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    if (!chart || !candleSeries) return;

    // Preserve user visible range before applying new data
    const prevRange = chart.timeScale().getVisibleLogicalRange();

    // Set Candlestick Data with future whitespace for date box extension
    const chartCandles: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    const maxFutureDate = filteredBoxingDates.length > 0
      ? filteredBoxingDates[filteredBoxingDates.length - 1].date
      : dateTo;
    const targetEndDate = maxFutureDate > dateTo ? maxFutureDate : dateTo;

    const futureWhitespace = generateFutureWhitespace(candles, targetEndDate, timeframe);

    const combinedSeriesData: (CandlestickData<Time> | WhitespaceData<Time>)[] = [
      ...chartCandles,
      ...futureWhitespace
    ].sort((a, b) => (a.time as number) - (b.time as number));

    candleSeries.setData(combinedSeriesData);

    allSeriesTimesRef.current = combinedSeriesData.map((s, idx) => ({
      time: s.time as number,
      dateStr: getDateStrInIST(s.time as number),
      index: idx
    }));

    // Set Volume Data
    if (volumeSeries) {
      if (showVolume) {
        const volumeData = candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
        }));
        volumeSeries.setData(volumeData);
      } else {
        volumeSeries.setData([]);
      }
    }

    // Clear previous price lines
    priceLinesRef.current.forEach((line) => {
      try {
        candleSeries.removePriceLine(line);
      } catch (e) {
        // ignore
      }
    });
    priceLinesRef.current = [];

    // Draw Permanent Wall Horizontal Price Lines
    if (showPermWalls && permWalls.length > 0) {
      permWalls.forEach((pw) => {
        const pl = candleSeries.createPriceLine({
          price: pw,
          color: '#f59e0b', // Amber 500
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: false,
          title: ''
        });
        priceLinesRef.current.push(pl);
      });
    }

    // Draw Strong Wall Horizontal Price Lines
    if (showStrongWalls && strongWalls.length > 0) {
      strongWalls.forEach((sw) => {
        const pl = candleSeries.createPriceLine({
          price: sw,
          color: '#94a3b8', // Slate 400
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: ''
        });
        priceLinesRef.current.push(pl);
      });
    }

    // Set or Clear Boxing Date Markers on Candlestick Chart (Astro markers removed from chart per request)
    const hasBoxingMarkers = (showPermDates || showConfluenceDates) && filteredBoxingDates.length > 0;

    if (hasBoxingMarkers && candles.length > 0) {
      const dateToTimestamp = new Map<string, Time>();

      candles.forEach((c) => {
        const d = new Date(c.time * 1000);
        const dStrUtc = d.toISOString().split('T')[0];
        const dStrLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        if (!dateToTimestamp.has(dStrUtc)) {
          dateToTimestamp.set(dStrUtc, c.time as Time);
        }
        if (!dateToTimestamp.has(dStrLocal)) {
          dateToTimestamp.set(dStrLocal, c.time as Time);
        }
      });

      const timeToMarker = new Map<Time, SeriesMarker<Time>>();

      // Group boxing dates by matchTime to merge into 1 clean label per day
      const timeToBoxingList = new Map<Time, BoxingDate[]>();
      filteredBoxingDates.forEach((bd) => {
        const matchTime = dateToTimestamp.get(bd.date);
        if (matchTime) {
          const list = timeToBoxingList.get(matchTime) || [];
          list.push(bd);
          timeToBoxingList.set(matchTime, list);
        }
      });

      timeToBoxingList.forEach((bdList, matchTime) => {
        const isPerm = bdList.some((b) => b.kind === 'perm');
        timeToMarker.set(matchTime, {
          time: matchTime,
          position: isPerm ? 'aboveBar' : 'belowBar',
          color: isPerm ? '#f59e0b' : '#14b8a6',
          shape: isPerm ? 'square' : 'circle',
          text: ''
        });
      });

      const sortedMarkers = Array.from(timeToMarker.values()).sort((a, b) => (a.time as number) - (b.time as number));

      if (markersPrimitiveRef.current) {
        try {
          markersPrimitiveRef.current.setMarkers(sortedMarkers);
        } catch (e) {
          try {
            candleSeries.detachPrimitive(markersPrimitiveRef.current);
          } catch (e2) {}
          markersPrimitiveRef.current = createSeriesMarkers(candleSeries, sortedMarkers);
        }
      } else {
        markersPrimitiveRef.current = createSeriesMarkers(candleSeries, sortedMarkers);
      }
    } else {
      if (markersPrimitiveRef.current) {
        try {
          markersPrimitiveRef.current.setMarkers([]);
        } catch (e) {
          try {
            candleSeries.detachPrimitive(markersPrimitiveRef.current);
          } catch (e2) {}
          markersPrimitiveRef.current = null;
        }
      }
    }

    // Restore or initialize Viewport Position & Zoom
    if (candles.length > 0) {
      if (isFirstLoadRef.current) {
        let restored = false;
        try {
          const savedRangeStr = localStorage.getItem(`tt_range_${timeframeRef.current}`);
          if (savedRangeStr) {
            const savedRange = JSON.parse(savedRangeStr);
            if (savedRange && typeof savedRange.from === 'number' && typeof savedRange.to === 'number') {
              chart.timeScale().setVisibleLogicalRange(savedRange);
              restored = true;
            }
          }
        } catch (e) {}

        if (!restored) {
          focusOnCurrentDate();
        }
        isFirstLoadRef.current = false;
      } else {
        const currentEarliestTime = candles[0]?.time;
        const prevCount = prevCandleCountRef.current;
        const newCount = candles.length;
        let targetRange = prevRange;

        if (
          prevRange &&
          prevEarliestTimeRef.current !== null &&
          currentEarliestTime < prevEarliestTimeRef.current &&
          newCount > prevCount
        ) {
          // Check if older candles were prepended to shift logical indices
          const addedBarsCount = newCount - prevCount;
          targetRange = {
            from: prevRange.from + addedBarsCount,
            to: prevRange.to + addedBarsCount
          };
        } else if (prevRange) {
          // Check if new live bars were appended at right edge and user was viewing live edge
          const wasAtRightEdge = prevCount > 0 && prevRange.to >= prevCount - 2;
          if (newCount > prevCount && wasAtRightEdge) {
            const addedBarsAtRight = newCount - prevCount;
            targetRange = {
              from: prevRange.from + addedBarsAtRight,
              to: prevRange.to + addedBarsAtRight
            };
          }
        } else {
          // Fallback if prevRange was null
          try {
            const savedRangeStr = localStorage.getItem(`tt_range_${timeframeRef.current}`);
            if (savedRangeStr) {
              const savedRange = JSON.parse(savedRangeStr);
              if (savedRange && typeof savedRange.from === 'number' && typeof savedRange.to === 'number') {
                targetRange = savedRange;
              }
            }
          } catch (e) {}
        }

        if (targetRange) {
          chart.timeScale().setVisibleLogicalRange(targetRange);
          try {
            localStorage.setItem(`tt_range_${timeframeRef.current}`, JSON.stringify(targetRange));
          } catch (e) {}
        }
      }
    }

    prevCandleCountRef.current = candles.length;
    prevEarliestTimeRef.current = candles[0]?.time ?? null;
  }, [
    candles,
    permWalls,
    strongWalls,
    showPermWalls,
    showStrongWalls,
    showAstroSignals,
    showPermDates,
    showConfluenceDates,
    showVolume,
    filteredAstroEvents,
    filteredBoxingDates
  ]);

  // Last candle for display stats
  const latestCandle = candles[candles.length - 1];

  return (
    <div className={isPopout ? "fixed inset-0 z-50 bg-[#070a14] p-2 sm:p-3 overflow-y-auto flex flex-col h-screen space-y-2 shadow-2xl animate-in fade-in duration-200" : "flex-1 flex flex-col h-full min-h-0 space-y-2 overflow-hidden"}>
      {/* Top Controls Bar */}
      <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-2.5 shadow-2xl backdrop-blur-md shrink-0 space-y-2">
        {/* Row 1: Data Connection & View Settings */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 pb-2">
          {/* Group 1: Data Feed & Sync */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 rounded-lg font-mono text-xs font-bold shadow-md shadow-amber-400/20">
              <Key className="w-3.5 h-3.5" />
              <span>Zerodha Kite</span>
            </div>

            {/* Live Auto-Sync Switch & Interval */}
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => {
                  setIsLivePolling(!isLivePolling);
                  if (!isLivePolling) loadCandles(true);
                }}
                title={isLivePolling ? `Live Auto-Sync Active (Every ${pollIntervalSec}s)` : "Click to enable Live Auto-Sync"}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-xs font-bold transition-all ${
                  isLivePolling
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isLivePolling ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>{isLivePolling ? `LIVE` : 'PAUSED'}</span>
              </button>

              <select
                value={pollIntervalSec}
                onChange={(e) => setPollIntervalSec(Math.max(1, Number(e.target.value)))}
                className="bg-slate-900 text-amber-300 font-mono text-xs font-bold rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-500/50 cursor-pointer border-0"
                title="Auto-Sync Interval"
              >
                <option value={1}>1s</option>
                <option value={2}>2s</option>
                <option value={3}>3s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            </div>

            <button
              onClick={() => loadCandles(false)}
              title="Manual Refresh Market Candles"
              className="p-1.5 text-slate-400 hover:text-amber-300 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold border transition-all ${
                showConfigPanel
                  ? 'bg-slate-800 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{showConfigPanel ? 'Close Config' : 'API Config'}</span>
            </button>

            <button
              onClick={() => setWallsModalOpen(true)}
              title="Open Matrix Planetary Walls & Aspect Catalog"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-sm"
            >
              <Grid3X3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Matrix Walls</span>
            </button>
          </div>

          {/* Group 2: Timeframe, Timezone & Zoom Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 px-1.5 font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" /> TF:
              </span>
              {(['15m', '30m', '1h', '1d'] as TimeframeType[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 text-xs font-mono rounded font-semibold transition-all ${
                    timeframe === tf
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm shadow-amber-400/20'
                      : 'text-slate-400 hover:text-amber-300'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Timezone Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 px-1 font-bold uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3 h-3 text-amber-400" /> TZ:
              </span>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value as TimeZoneType)}
                className="bg-slate-900 border border-slate-800 text-amber-300 font-mono text-xs font-semibold rounded px-2 py-0.5 focus:outline-none focus:border-amber-400 cursor-pointer"
                title="Terminal Timezone Setting (Default: IST)"
              >
                <option value="IST">🇮🇳 IST (+5:30)</option>
                <option value="UTC">🌐 UTC (+00:00)</option>
                <option value="EST">🇺🇸 EST (-05:00)</option>
                <option value="GMT">🇬🇧 GMT (+00:00)</option>
                <option value="LOCAL">💻 Local</option>
              </select>
            </div>

            {/* Zoom & Popout Toolbar */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={handleZoomIn}
                title="Zoom In (+)"
                className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-900 transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleZoomOut}
                title="Zoom Out (-)"
                className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-900 transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleResetZoom}
                title="Fit All Content / Reset Zoom"
                className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-900 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>

              <div className="h-3.5 w-px bg-slate-800 mx-0.5" />

              <button
                onClick={() => setIsPopout(!isPopout)}
                title={isPopout ? 'Exit Fullscreen Popout (ESC)' : 'Popout Fullscreen Terminal'}
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-bold transition-all ${
                  isPopout
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700'
                }`}
              >
                {isPopout ? (
                  <>
                    <Minimize2 className="w-3 h-3" /> Exit
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3 text-amber-400" /> Popout
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Chart Overlays Toolbar */}
        <div className="bg-slate-950/70 border border-slate-800/80 p-1.5 rounded-lg flex flex-wrap items-center justify-between gap-2">
          {/* Left: Overlays & Filters Group */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider px-1.5 flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400" /> Overlays:
            </span>

            <button
              onClick={() => setShowPermWalls(!showPermWalls)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all ${
                showPermWalls
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
            >
              <Shield className="w-3 h-3 text-amber-400" />
              Perm Walls ({permWalls.length})
            </button>

            <button
              onClick={() => setShowStrongWalls(!showStrongWalls)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all ${
                showStrongWalls
                  ? 'bg-slate-700/30 text-slate-200 border-slate-600/50 shadow-sm'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
            >
              <Layers className="w-3 h-3 text-slate-400" />
              Strong Walls ({strongWalls.length})
            </button>

            <button
              onClick={() => setShowConfluenceDates(!showConfluenceDates)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all ${
                showConfluenceDates
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
              title="Toggle Swing Confluence Anchors / Vertical Lines"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              Swing Confluence ({confluenceDatesCount})
            </button>

            <button
              onClick={() => setShowPermDates(!showPermDates)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all ${
                showPermDates
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
              title="Toggle Permanent Boxing Dates / Vertical Lines"
            >
              <CalendarDays className="w-3 h-3 text-amber-400" />
              Perm Dates ({permDatesCount})
            </button>

            <button
              onClick={() => setShowAstroSignals(!showAstroSignals)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all ${
                showAstroSignals
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
              }`}
              title="Highlight 42-Signal matches in hover tooltip"
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              42-Signals
            </button>
          </div>

          {/* Right: Data Reload Button */}
          <button
            onClick={() => loadCandles(false)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md font-mono text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all shadow-md shadow-amber-400/20 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Reload Data
          </button>
        </div>

        {/* Zerodha Kite Config Drawer */}
        {showConfigPanel && (
          <div className="mt-3 p-3.5 bg-slate-950 border border-amber-500/30 rounded-xl space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <h4 className="font-mono text-xs font-bold text-amber-200 uppercase tracking-wider">
                  Zerodha Kite Connect / Browser Token Configuration
                </h4>
              </div>
              <button
                onClick={() => setShowConfigPanel(false)}
                className="text-xs font-mono text-slate-400 hover:text-slate-200"
              >
                Hide Config
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                  Enctoken (Browser Login)
                </label>
                <input
                  type="password"
                  value={kiteEnctoken}
                  onChange={(e) => setKiteEnctoken(e.target.value)}
                  placeholder="Paste browser cookie enctoken..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={kiteApiKey}
                  onChange={(e) => setKiteApiKey(e.target.value)}
                  placeholder="e.g. your_kite_api_key"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                  Access Token
                </label>
                <input
                  type="password"
                  value={kiteAccessToken}
                  onChange={(e) => setKiteAccessToken(e.target.value)}
                  placeholder="e.g. your_access_token"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                  Instrument Token
                </label>
                <input
                  type="text"
                  value={kiteInstrumentToken}
                  onChange={(e) => setKiteInstrumentToken(e.target.value)}
                  placeholder="256265 for Nifty 50"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                  Auto-Sync Rate (Seconds)
                </label>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={pollIntervalSec}
                  onChange={(e) => setPollIntervalSec(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                Custom Kite URL Pattern
              </label>
              <input
                type="text"
                value={kiteCustomUrl}
                onChange={(e) => setKiteCustomUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* URL Parameter Preview */}
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-[11px] font-mono text-teal-300 flex items-center justify-between overflow-x-auto">
              <span className="text-slate-400 font-bold uppercase text-[10px] mr-2">Constructed URL:</span>
              <span className="truncate">{constructedKiteUrl}</span>
            </div>
          </div>
        )}
      </div>

      {/* Error / Fallback Status Banner */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Chart Canvas Container */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex-1 h-full min-h-[560px] w-full flex flex-col">
        <div
          ref={chartContainerRef}
          className="w-full flex-1 h-full min-h-[560px]"
        />

        {/* Distance-Offset Leader Line Callout Canvas Overlay */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 pointer-events-none z-10 w-full h-full"
        />

        {/* Loading Older History Badge */}
        {isLoadingOlder && (
          <div className="absolute top-3 right-3 z-20 bg-amber-500/90 text-slate-950 px-3 py-1.5 rounded-lg font-mono text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-md animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
            Loading Older History...
          </div>
        )}

        {/* History Loaded Indicator */}
        {historyLoadedCount > 0 && !isLoadingOlder && (
          <div className="absolute top-3 right-3 z-10 bg-slate-900/80 border border-teal-500/40 text-teal-300 px-2.5 py-1 rounded-lg font-mono text-[11px] flex items-center gap-1.5 shadow-lg backdrop-blur-md">
            <History className="w-3.5 h-3.5 text-teal-400" />
            <span>+{historyLoadedCount} History Bars Loaded</span>
          </div>
        )}

        {/* Floating Quick Legend Overlay */}
        <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-lg p-2.5 font-mono text-[11px] space-y-1.5 shadow-xl max-w-xs pointer-events-none">
          <div className="text-amber-300 font-bold flex items-center gap-1.5">
            <CandlestickChart className="w-3.5 h-3.5 text-amber-400" />
            Planetary S/R Chart Engine
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-3 h-1 bg-amber-400 rounded-full" />
            <span>Perm Walls (≥90%): {permWalls.length} active</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-3 h-0.5 bg-slate-400 border-dashed border-b border-slate-400" />
            <span>Strong Walls (50-89%): {strongWalls.length} active</span>
          </div>
          <div className="flex items-center gap-2 text-purple-300">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>42-Signals: Highlighted in Tooltip</span>
          </div>
        </div>
      </div>

      {/* Active Candle Hover Info & Planetary Wall Tooltip Bar */}
      {displayCandle && (
        <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-3 space-y-2.5 font-mono text-xs shadow-2xl shrink-0 backdrop-blur-md">
          {/* Header Row: Timestamp, Status Badge, OHLCV Mini-Cards */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Timestamp & Hover Mode */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-200 font-bold text-xs sm:text-sm">
                  {formatTimestampInTZ(displayCandle.time, timeZone, timeframe !== '1d')}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                  {timeZone}
                </span>
              </div>

              <span className={`text-[10px] px-2 py-1 rounded-lg font-bold uppercase tracking-wider ${
                activeHoverCandle ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-slate-950 text-slate-400 border border-slate-800'
              }`}>
                {activeHoverCandle ? 'Active Hover' : 'Latest Candle'}
              </span>

              {lastFetchedInfo && (
                <div className="text-[10px] text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20 hidden sm:block">
                  {lastFetchedInfo}
                </div>
              )}
            </div>

            {/* OHLCV Metric Cards */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-0.5">
                <span className="text-slate-500 text-[9px] uppercase font-bold block leading-none">Open</span>
                <span className="text-slate-200 font-bold text-xs">{displayCandle.open.toLocaleString()}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-0.5">
                <span className="text-slate-500 text-[9px] uppercase font-bold block leading-none">High</span>
                <span className="text-emerald-400 font-bold text-xs">{displayCandle.high.toLocaleString()}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-0.5">
                <span className="text-slate-500 text-[9px] uppercase font-bold block leading-none">Low</span>
                <span className="text-rose-400 font-bold text-xs">{displayCandle.low.toLocaleString()}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-0.5">
                <span className="text-slate-500 text-[9px] uppercase font-bold block leading-none">Close</span>
                <span className={`font-bold text-xs ${displayCandle.close >= displayCandle.open ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {displayCandle.close.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-0.5">
                <span className="text-slate-500 text-[9px] uppercase font-bold block leading-none">Change</span>
                <span className={`font-bold text-xs ${displayCandle.close >= displayCandle.open ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(displayCandle.close - displayCandle.open >= 0 ? '+' : '')}
                  {(displayCandle.close - displayCandle.open).toFixed(2)} (
                  {(((displayCandle.close - displayCandle.open) / displayCandle.open) * 100).toFixed(2)}%)
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-lg px-2.5 py-0.5">
                <span className="text-slate-500 text-[9px] uppercase font-bold block leading-none">Volume</span>
                <span className="text-sky-300 font-bold text-xs">{displayCandle.volume.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Matrix Planet Aspects & Astro Harmonics Info Panel */}
          {hoverAstroInfo && (
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 space-y-2 font-mono text-[11px]">
              {/* Row 1: Planets at Pressure */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-amber-300 font-bold uppercase text-[10px] tracking-wider">
                      PLANETS AT PRESSURE ({hoverAstroInfo.closestWall.type} @ {hoverAstroInfo.closestWall.price.toLocaleString()}):
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      hoverAstroInfo.closestWall.distance === 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}>
                      {hoverAstroInfo.closestWall.distance === 0 ? 'Exact Wall Hit' : `Gap ±${hoverAstroInfo.closestWall.distance} pts`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {hoverAstroInfo.wallAspectHits.length > 0 ? (
                      hoverAstroInfo.wallAspectHits.map((hit, idx) => {
                        const pMeta = PLANET_META[hit.p];
                        const aspMeta = ASPECT_META[hit.a];
                        const sigMatch = find42SignalMatch(hit.p, hit.a);

                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] transition-all ${
                              sigMatch
                                ? 'bg-amber-500/20 border border-amber-400 text-amber-200 shadow-md shadow-amber-500/10'
                                : 'bg-slate-900 border border-slate-800'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: aspMeta?.color || '#888' }} />
                            <span style={{ color: pMeta?.color || '#fff' }}>{pMeta?.sym}</span>
                            <span className="text-slate-200 font-medium">{hit.p}</span>
                            <span style={{ color: aspMeta?.color || '#ccc' }}>{aspMeta?.abbr || hit.a}</span>
                            <span className="text-slate-500 text-[10px]">({hit.o}°)</span>

                            {showAstroSignals && sigMatch && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-extrabold ml-0.5 uppercase tracking-wider flex items-center gap-1 shadow-sm"
                                style={{
                                  backgroundColor: TIER_META[sigMatch.tier]?.bg || 'rgba(232, 199, 102, 0.2)',
                                  color: TIER_META[sigMatch.tier]?.color || '#e8c766',
                                  border: `1px solid ${TIER_META[sigMatch.tier]?.border || 'rgba(232, 199, 102, 0.5)'}`
                                }}
                                title={`${sigMatch.desc} (Lift: ${sigMatch.lift.toFixed(2)}x, p: ${sigMatch.p})`}
                              >
                                ⚡ 42-SIG: {TIER_META[sigMatch.tier]?.icon} {sigMatch.tier.toUpperCase()} {sigMatch.lift.toFixed(1)}× {sigMatch.direction}
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-slate-500 italic text-[10px]">No planets at pressure at this wall level on {hoverAstroInfo.dateStr}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Date Spoke -> Market Price 36-Harmonics (S + 36 * k) */}
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-800/60 pt-2 text-[11px]">
                <span className="text-amber-300 font-bold flex items-center gap-1 text-[10px] uppercase shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Date Spoke {hoverAstroInfo.dateHarmonics.dateSpoke} (Ring 36 / {hoverAstroInfo.dateHarmonics.dateDegree}°):</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px]">
                  <span className="px-2 py-0.5 bg-amber-500/20 rounded border border-amber-500/40 text-amber-300 font-bold">
                    Harmonic Price: <strong className="text-amber-200">{hoverAstroInfo.dateHarmonics.pHarmExact.toLocaleString()}</strong> ({hoverAstroInfo.dateHarmonics.dateSpoke} + 36×{hoverAstroInfo.dateHarmonics.kMultiplier})
                  </span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-teal-300 font-medium">
                    36-Ring Price: <strong className="text-slate-200">{hoverAstroInfo.dateHarmonics.pRingHarm.toLocaleString()}</strong> ([{hoverAstroInfo.dateHarmonics.dateSpoke} + 36×{hoverAstroInfo.dateHarmonics.kRingMultiplier}]×100)
                  </span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-amber-500/30 text-amber-300 font-medium">
                    90°: <strong className="text-slate-200">{hoverAstroInfo.dateHarmonics.ringH90[0].toLocaleString()}</strong> / <strong className="text-slate-200">{hoverAstroInfo.dateHarmonics.ringH90[1].toLocaleString()}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-amber-500/30 text-amber-300 font-medium">
                    120°: <strong className="text-slate-200">{hoverAstroInfo.dateHarmonics.ringH120[0].toLocaleString()}</strong> / <strong className="text-slate-200">{hoverAstroInfo.dateHarmonics.ringH120[1].toLocaleString()}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-amber-500/30 text-amber-300 font-medium">
                    180°: <strong className="text-slate-200">{hoverAstroInfo.dateHarmonics.ringH180[0].toLocaleString()}</strong> / <strong className="text-slate-200">{hoverAstroInfo.dateHarmonics.ringH180[1].toLocaleString()}</strong>
                  </span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 text-slate-400">
                    Adj: <span className="text-slate-300">{hoverAstroInfo.dateHarmonics.pHarmPrev.toLocaleString()}</span> / <span className="text-slate-300">{hoverAstroInfo.dateHarmonics.pHarmNext.toLocaleString()}</span>
                  </span>
                  {hoverAstroInfo.dateHarmonics.isHarmonicMatch && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 shadow animate-pulse">
                      ✨ CANDLE HARMONIC CONFIRMATION
                    </span>
                  )}
                </div>
              </div>

              {/* Row 3: Closest Wall Harmonics & Gann/Boxing Details */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-2 text-[11px]">
                {/* Wall Harmonics */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-300 font-bold flex items-center gap-1 text-[10px] uppercase shrink-0">
                    <Target className="w-3.5 h-3.5 text-amber-400" />
                    <span>Wall ({hoverAstroInfo.closestWallHarmonics.wallPrice.toLocaleString()}) Harmonics:</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-amber-500/20 rounded border border-amber-500/40 font-mono text-amber-300 text-[10px] font-bold">
                      0°: <strong className="text-amber-200">{hoverAstroInfo.closestWallHarmonics.h0.toLocaleString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 font-mono text-teal-300 text-[10px] font-medium">
                      90°: <strong className="text-slate-200">{hoverAstroInfo.closestWallHarmonics.h90[0].toLocaleString()}</strong> / <strong className="text-slate-200">{hoverAstroInfo.closestWallHarmonics.h90[1].toLocaleString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 font-mono text-teal-300 text-[10px] font-medium">
                      120°: <strong className="text-slate-200">{hoverAstroInfo.closestWallHarmonics.h120[0].toLocaleString()}</strong> / <strong className="text-slate-200">{hoverAstroInfo.closestWallHarmonics.h120[1].toLocaleString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 bg-slate-900 rounded border border-slate-800 font-mono text-teal-300 text-[10px] font-medium">
                      180°: <strong className="text-slate-200">{hoverAstroInfo.closestWallHarmonics.h180[0].toLocaleString()}</strong> / <strong className="text-slate-200">{hoverAstroInfo.closestWallHarmonics.h180[1].toLocaleString()}</strong>
                    </span>
                  </div>
                </div>

                {/* Boxing Date & Gann Channel Details */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Date Boxing Match */}
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                    {hoverAstroInfo.matchedBoxingDate ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold text-[10px] flex items-center gap-1">
                          🥊 {hoverAstroInfo.matchedBoxingDate.kind.toUpperCase()} BOXING ({hoverAstroInfo.matchedBoxingDate.date})
                        </span>
                        {hoverAstroInfo.candleWallMatches && hoverAstroInfo.candleWallMatches.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 shadow">
                            ⭐ SPECIAL DAY ({hoverAstroInfo.candleWallMatches.map((wm) => `${wm.matchedPrice.toLocaleString()} ${wm.angleLabel || '0°'}`).join(', ')})
                          </span>
                        )}
                      </div>
                    ) : hoverAstroInfo.nextBoxingDate ? (
                      <span className="text-slate-400 text-[10px]">
                        Next Boxing: <strong className="text-amber-300">{hoverAstroInfo.nextBoxingDate.date}</strong> ({hoverAstroInfo.nextBoxingDate.kind})
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">No active 36-H date</span>
                    )}
                  </div>

                  {/* Price Boxing / Gann Channel */}
                  <div className="flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-teal-400" />
                    {hoverAstroInfo.priceBoxingDetails ? (
                      <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold text-[10px]">
                        Box #{hoverAstroInfo.priceBoxingDetails.boxId + 1}: {hoverAstroInfo.priceBoxingDetails.floorPrice.toLocaleString()} ─ {hoverAstroInfo.priceBoxingDetails.ceilPrice.toLocaleString()} ({hoverAstroInfo.priceBoxingDetails.boxWidth} pts) [{hoverAstroInfo.priceBoxingDetails.boxPct.toFixed(0)}%]
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Outside active Gann boxes</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Matrix Planetary Walls & Aspect Catalog Pop Box Modal */}
      <MatrixWallsModal
        isOpen={wallsModalOpen}
        onClose={() => setWallsModalOpen(false)}
        matrix={matrix}
        priceLo={priceLo}
        priceHi={priceHi}
        dateFrom={dateFrom}
        dateTo={dateTo}
        orb={orb}
        minHighlight={minHighlight}
      />
    </div>
  );
};
