import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Star
} from 'lucide-react';
import { MatrixData, DepartureEvent, PlanetName, AspectName, BoxWallMatch } from '../types';
import { scanCriticalDates, computeBoxingDates, computeBoxBreakouts, ringToDegree, fromIso, checkCandleWallMatch } from '../lib/matrix';
import { PLANET_META, ASPECT_META, BODY_LIST, getPositions, findAspectAll } from '../lib/astronomy';
import { getSignal, TIER_META } from '../lib/signals';

interface TradingTerminalTabProps {
  matrix: MatrixData;
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  orb: number;
  minHighlight: number;
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

export const TradingTerminalTab: React.FC<TradingTerminalTabProps> = ({
  matrix,
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  orb,
  minHighlight
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
  const [showBoxingDates, setShowBoxingDates] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('tt_showBoxingDates');
      return v !== null ? JSON.parse(v) : true;
    } catch (e) {
      return true;
    }
  });
  const [boxingKindFilter, setBoxingKindFilter] = useState<'all' | 'perm' | 'strong'>(() => {
    try {
      const v = localStorage.getItem('tt_boxingKindFilter');
      return v ? (JSON.parse(v) as any) : 'all';
    } catch (e) {
      return 'all';
    }
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
      localStorage.setItem('tt_showBoxingDates', JSON.stringify(showBoxingDates));
      localStorage.setItem('tt_boxingKindFilter', JSON.stringify(boxingKindFilter));
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
    return computeBoxingDates(dateFrom, dateTo, permWalls, strongWalls, true);
  }, [dateFrom, dateTo, permWalls, strongWalls]);

  const filteredBoxingDates = useMemo(() => {
    return rawBoxingDates.filter((bd) => {
      if (boxingKindFilter !== 'all' && bd.kind !== boxingKindFilter) return false;
      return true;
    });
  }, [rawBoxingDates, boxingKindFilter]);

  // Gann Box Breakout Channels Calculation
  const gannBoxes = useMemo(() => {
    return computeBoxBreakouts(matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight);
  }, [matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight]);

  // Matrix Aspect calculations for Hovered Date & Price (matching closest Main/Strong Wall + Boxing Info)
  const hoverAstroInfo = useMemo(() => {
    if (!activeHoverCandle) return null;

    const dateStr = activeHoverCandle.timeStr.slice(0, 10);
    const hoverPrice = activeHoverCandle.close;

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
    const candleWallMatches = (matchedBoxingDate && activeHoverCandle)
      ? checkCandleWallMatch(activeHoverCandle, matchedBoxingDate)
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

    return {
      dateStr,
      hoverPrice,
      closestWall,
      wallAspectHits,
      matrixRingCount,
      matrixHitCount,
      matchedBoxingDate,
      nextBoxingDate,
      priceBoxingDetails,
      candleWallMatches
    };
  }, [activeHoverCandle, matrix, permWalls, strongWalls, orb, rawBoxingDates, gannBoxes]);

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
    return rawAstroEvents
      .filter((ev) => {
        if (!ev.sig) return false;
        if (astroTierFilter !== 'all' && ev.sig.tier !== astroTierFilter) return false;
        if (astroDirectionFilter !== 'all' && ev.sig.direction !== astroDirectionFilter) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rawAstroEvents, astroTierFilter, astroDirectionFilter]);

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
    const chartHeight = isPopout ? Math.max(620, window.innerHeight - 240) : 520;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8'
      },
      grid: {
        vertLines: { color: 'rgba(51, 65, 85, 0.25)' },
        horzLines: { color: 'rgba(51, 65, 85, 0.25)' }
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
        secondsVisible: false
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
      height: chartHeight
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
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);

    // Subscribe to crosshair move for tooltip
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
    });

    // Resize observer
    const handleResize = () => {
      if (container && chartRef.current) {
        const updatedHeight = isPopout ? Math.max(620, window.innerHeight - 240) : 520;
        chartRef.current.applyOptions({
          width: container.clientWidth,
          height: updatedHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Mark as first load when chart instance is created
    isFirstLoadRef.current = true;

    return () => {
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

  // 2. Update Series Data, Price Lines & Astro Markers without resetting Zoom or Re-creating Chart
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;

    if (!chart || !candleSeries) return;

    // Preserve user visible range before applying new data
    const prevRange = chart.timeScale().getVisibleLogicalRange();

    // Set Candlestick Data
    const chartCandles: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));
    candleSeries.setData(chartCandles);

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
          axisLabelVisible: true,
          title: `PERM WALL ${pw.toLocaleString()}`
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
          axisLabelVisible: true,
          title: `STRONG WALL ${sw.toLocaleString()}`
        });
        priceLinesRef.current.push(pl);
      });
    }

    // Set or Clear Astro Signal & Boxing Date Markers on Candlestick Chart
    const hasAstroMarkers = showAstroSignals && filteredAstroEvents.length > 0;
    const hasBoxingMarkers = showBoxingDates && filteredBoxingDates.length > 0;

    if ((hasAstroMarkers || hasBoxingMarkers) && candles.length > 0) {
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

      if (hasAstroMarkers) {
        filteredAstroEvents.forEach((ev) => {
          const matchTime = dateToTimestamp.get(ev.date);
          if (matchTime && !timeToMarker.has(matchTime)) {
            const isGold = ev.sig?.tier === 'gold';
            const isSilver = ev.sig?.tier === 'silver';
            const tierLabel = isGold ? 'GOLD' : isSilver ? 'SLV' : 'BRZ';
            const isUp = ev.sig?.direction === 'UP';
            const shape = isUp ? 'arrowUp' : 'arrowDown';
            const position = isUp ? 'belowBar' : 'aboveBar';
            const color = isGold ? '#a855f7' : isSilver ? '#06b6d4' : '#f59e0b';

            timeToMarker.set(matchTime, {
              time: matchTime,
              position: position,
              color: color,
              shape: shape,
              text: `${tierLabel} ${ev.price} (${ev.body})`
            });
          }
        });
      }

      if (hasBoxingMarkers) {
        filteredBoxingDates.forEach((bd) => {
          const matchTime = dateToTimestamp.get(bd.date);
          if (matchTime) {
            const candleOnDate = candles.find((c) => c.time === matchTime);
            const wallMatches = candleOnDate ? checkCandleWallMatch(candleOnDate, bd) : [];
            const hasWallMatch = wallMatches.length > 0;

            const existing = timeToMarker.get(matchTime);
            const isPerm = bd.kind === 'perm';

            if (hasWallMatch) {
              const matchedPriceStr = wallMatches.map((m) => `${m.matchedPrice.toLocaleString()} (${m.angleLabel || '0°'})`).join(', ');
              const boxLabel = `⭐ MATCH [${matchedPriceStr}]`;
              const boxColor = '#f59e0b'; // Gold highlight

              if (existing) {
                timeToMarker.set(matchTime, {
                  ...existing,
                  color: '#f59e0b',
                  shape: 'square',
                  text: `⭐ ${existing.text} | MATCH ${matchedPriceStr}`
                });
              } else {
                timeToMarker.set(matchTime, {
                  time: matchTime,
                  position: 'aboveBar',
                  color: boxColor,
                  shape: 'square',
                  text: boxLabel
                });
              }
            } else {
              const boxLabel = `🥊 BOX ${isPerm ? 'PERM' : 'STR'}`;
              const boxColor = isPerm ? '#f59e0b' : '#14b8a6';

              if (existing) {
                timeToMarker.set(matchTime, {
                  ...existing,
                  text: `${existing.text} | ${boxLabel}`
                });
              } else {
                timeToMarker.set(matchTime, {
                  time: matchTime,
                  position: isPerm ? 'aboveBar' : 'belowBar',
                  color: boxColor,
                  shape: isPerm ? 'square' : 'circle',
                  text: `${boxLabel} (${bd.date.slice(5)})`
                });
              }
            }
          }
        });
      }

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
    showBoxingDates,
    showVolume,
    filteredAstroEvents,
    filteredBoxingDates
  ]);

  // Last candle for display stats
  const latestCandle = candles[candles.length - 1];
  const displayCandle = activeHoverCandle || latestCandle;

  return (
    <div className={isPopout ? "fixed inset-0 z-50 bg-[#070a14] p-4 sm:p-6 overflow-y-auto space-y-4 shadow-2xl animate-in fade-in duration-200" : "space-y-4"}>
      {/* Top Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Zerodha Data Source Indicator & Config Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 text-slate-950 rounded-md font-mono text-xs font-bold shadow-md shadow-amber-400/20">
              <Key className="w-3.5 h-3.5" />
              <span>Zerodha Kite Engine</span>
            </div>

            <button
              onClick={() => {
                setIsLivePolling(!isLivePolling);
                if (!isLivePolling) loadCandles(true);
              }}
              title={isLivePolling ? `Live Auto-Sync Active (Every ${pollIntervalSec}s)` : "Click to enable Live Auto-Sync"}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-mono text-xs font-bold transition-all border ${
                isLivePolling
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isLivePolling ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{isLivePolling ? `LIVE ${pollIntervalSec}s` : 'PAUSED'}</span>
            </button>

            <select
              value={pollIntervalSec}
              onChange={(e) => setPollIntervalSec(Math.max(1, Number(e.target.value)))}
              className="bg-slate-950 border border-slate-800 text-amber-300 font-mono text-xs font-semibold rounded px-2 py-1.5 focus:outline-none focus:border-amber-500/50 cursor-pointer"
              title="Set Auto-Sync Refresh Interval"
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

            <button
              onClick={() => loadCandles(false)}
              title="Manual Refresh Market Candles"
              className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-950 border border-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            <button
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-mono text-xs font-semibold border transition-all ${
                showConfigPanel
                  ? 'bg-slate-800 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{showConfigPanel ? 'Close Config' : 'API / Token Config'}</span>
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <span className="text-[10px] font-mono text-slate-400 px-2 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400" /> TF:
            </span>
            {(['15m', '30m', '1h', '1d'] as TimeframeType[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-mono rounded-md font-semibold transition-all ${
                  timeframe === tf
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-teal-300'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Zoom & Popout Fullscreen Controls */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={handleZoomIn}
              title="Zoom In (+)"
              className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-900 transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-900 transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetZoom}
              title="Fit All Content / Reset Zoom"
              className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={focusOnCurrentDate}
              title="Point Chart to Current Date (Today)"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold rounded text-teal-300 bg-teal-500/20 border border-teal-500/40 hover:bg-teal-500/30 transition-all"
            >
              <Target className="w-3.5 h-3.5 text-teal-400" />
              <span>Current Date</span>
            </button>

            <div className="w-px h-4 bg-slate-800 my-auto" />

            <button
              onClick={() => setIsPopout(!isPopout)}
              title={isPopout ? 'Exit Fullscreen Popout (ESC)' : 'Popout Fullscreen Terminal'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all ${
                isPopout
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700'
              }`}
            >
              {isPopout ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" /> Exit Popout
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" /> Popout Terminal
                </>
              )}
            </button>
          </div>

          {/* Overlays Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPermWalls(!showPermWalls)}
              className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg font-mono text-[11px] font-semibold border transition-all ${
                showPermWalls
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}
            >
              <Shield className="w-3 h-3 text-amber-400" />
              Perm Walls ({permWalls.length})
            </button>

            <button
              onClick={() => setShowStrongWalls(!showStrongWalls)}
              className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg font-mono text-[11px] font-semibold border transition-all ${
                showStrongWalls
                  ? 'bg-slate-700/30 text-slate-200 border-slate-600/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}
            >
              <Layers className="w-3 h-3 text-slate-400" />
              Strong Walls ({strongWalls.length})
            </button>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setShowAstroSignals(!showAstroSignals)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all ${
                  showAstroSignals
                    ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                <Sparkles className="w-3 h-3 text-purple-400" />
                Astro Signals ({filteredAstroEvents.length})
              </button>

              {showAstroSignals && (
                <>
                  <select
                    value={astroTierFilter}
                    onChange={(e) => setAstroTierFilter(e.target.value as any)}
                    className="bg-slate-900 border border-purple-500/30 text-purple-300 font-mono text-[11px] font-semibold rounded px-2 py-1 focus:outline-none focus:border-purple-400 cursor-pointer"
                    title="Filter Astro Signals by Tier"
                  >
                    <option value="all">All Tiers</option>
                    <option value="gold">🥇 Gold Only</option>
                    <option value="silver">🥈 Silver Only</option>
                    <option value="bronze">🥉 Bronze Only</option>
                  </select>

                  <select
                    value={astroDirectionFilter}
                    onChange={(e) => setAstroDirectionFilter(e.target.value as any)}
                    className="bg-slate-900 border border-purple-500/30 text-purple-300 font-mono text-[11px] font-semibold rounded px-2 py-1 focus:outline-none focus:border-purple-400 cursor-pointer"
                    title="Filter Astro Signals by Direction Bias"
                  >
                    <option value="all">All Dir</option>
                    <option value="UP">Bullish ↑</option>
                    <option value="DOWN">Bearish ↓</option>
                  </select>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setShowBoxingDates(!showBoxingDates)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all ${
                  showBoxingDates
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
              >
                <CalendarDays className="w-3 h-3 text-amber-400" />
                Boxing Dates ({filteredBoxingDates.length})
              </button>

              {showBoxingDates && (
                <select
                  value={boxingKindFilter}
                  onChange={(e) => setBoxingKindFilter(e.target.value as any)}
                  className="bg-slate-900 border border-amber-400/30 text-amber-300 font-mono text-[11px] font-semibold rounded px-2 py-1 focus:outline-none focus:border-amber-400 cursor-pointer"
                  title="Filter Boxing Dates by Type"
                >
                  <option value="all">All Boxing</option>
                  <option value="perm">🥇 Perm Only</option>
                  <option value="strong">Strong Only</option>
                </select>
              )}
            </div>

            <button
              onClick={loadCandles}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all shadow-md shadow-amber-400/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Reload
            </button>
          </div>
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

      {/* Active Candle Hover Info Header Bar */}
      {displayCandle && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2 font-mono text-xs shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-200 font-bold">{displayCandle.timeStr}</span>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Open</span>
                <span className="text-slate-200 font-semibold">{displayCandle.open.toLocaleString()}</span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase block">High</span>
                <span className="text-emerald-400 font-semibold">{displayCandle.high.toLocaleString()}</span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Low</span>
                <span className="text-rose-400 font-semibold">{displayCandle.low.toLocaleString()}</span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Close</span>
                <span className={`font-bold ${displayCandle.close >= displayCandle.open ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {displayCandle.close.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Change</span>
                <span className={`font-semibold ${displayCandle.close >= displayCandle.open ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(displayCandle.close - displayCandle.open >= 0 ? '+' : '')}
                  {(displayCandle.close - displayCandle.open).toFixed(2)} (
                  {(((displayCandle.close - displayCandle.open) / displayCandle.open) * 100).toFixed(2)}%)
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Volume</span>
                <span className="text-sky-300">{displayCandle.volume.toLocaleString()}</span>
              </div>
            </div>

            {lastFetchedInfo && (
              <div className="text-[11px] text-teal-300/80 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                {lastFetchedInfo}
              </div>
            )}
          </div>

          {/* Matrix Planet Aspects & Boxing Info Row on Hover */}
          {hoverAstroInfo && (
            <div className="border-t border-slate-800 pt-2 space-y-2 font-mono text-[11px]">
              {/* Special Price-Date Box Wall Match Highlight Callout */}
              {hoverAstroInfo.candleWallMatches && hoverAstroInfo.candleWallMatches.length > 0 && (
                <div className="p-2 rounded-lg bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-slate-900 border border-amber-400 text-xs flex flex-wrap items-center justify-between gap-2 shadow-md">
                  <div className="text-amber-200 font-extrabold flex items-center gap-1.5">
                    <Star className="w-4 h-4 text-amber-300 fill-amber-300 animate-pulse" />
                    <span>⭐ SPECIAL DAY: PRICE-DATE WALL MATCH!</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {hoverAstroInfo.candleWallMatches.map((wm, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold font-mono text-[11px]">
                        {wm.matchType}: {wm.matchedPrice.toLocaleString()} ({wm.angleLabel || '0°'})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1: Planets at Pressure & Wall Distance Gap */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-400 font-bold flex items-center gap-1 uppercase text-[10px] tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      PLANETS AT PRESSURE ({hoverAstroInfo.closestWall.type} @ {hoverAstroInfo.closestWall.price.toLocaleString()}):
                    </span>
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    hoverAstroInfo.closestWall.distance === 0
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  }`}>
                    {hoverAstroInfo.closestWall.distance === 0 ? 'Exact Wall Hit' : `Gap ±${hoverAstroInfo.closestWall.distance} pts`}
                  </span>

                  {hoverAstroInfo.wallAspectHits.length > 0 ? (
                    hoverAstroInfo.wallAspectHits.map((hit, idx) => {
                      const pMeta = PLANET_META[hit.p];
                      const aspMeta = ASPECT_META[hit.a];
                      const floorSig = getSignal(hit.p, hit.a, 'depart', 'floor');
                      const ceilSig = getSignal(hit.p, hit.a, 'depart', 'ceiling');
                      const bestSig = [floorSig, ceilSig].filter(Boolean).sort((a, b) => b!.lift - a!.lift)[0];

                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px]"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: aspMeta?.color || '#888' }} />
                          <span style={{ color: pMeta?.color || '#fff' }}>{pMeta?.sym}</span>
                          <span className="text-slate-200 font-medium">{hit.p}</span>
                          <span style={{ color: aspMeta?.color || '#ccc' }}>{aspMeta?.abbr || hit.a}</span>
                          <span className="text-slate-500 text-[10px]">({hit.o}°)</span>
                          {bestSig && (
                            <span
                              className="px-1.5 py-0.2 rounded text-[10px] font-bold ml-0.5"
                              style={{
                                backgroundColor: TIER_META[bestSig.tier].bg,
                                color: TIER_META[bestSig.tier].color,
                                border: `1px solid ${TIER_META[bestSig.tier].border}`
                              }}
                            >
                              {TIER_META[bestSig.tier].icon} {bestSig.lift.toFixed(1)}×
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

              {/* Row 2: Date Boxing, Wall Syncs & Price Boxing Info */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/60 pt-2 text-[11px]">
                {/* Date Boxing Match Indicator */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-amber-300 font-bold flex items-center gap-1 text-[10px] uppercase">
                    <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                    <span>36-H Boxing:</span>
                  </span>
                  {hoverAstroInfo.matchedBoxingDate ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold text-[10px] flex items-center gap-1">
                        🥊 {hoverAstroInfo.matchedBoxingDate.kind.toUpperCase()} MATCH ({hoverAstroInfo.matchedBoxingDate.date})
                        {hoverAstroInfo.matchedBoxingDate.snappedFrom && ` [snapped from ${hoverAstroInfo.matchedBoxingDate.snappedFrom}]`}
                      </span>
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="text-slate-400">Walls:</span>
                        {[...hoverAstroInfo.matchedBoxingDate.perm, ...hoverAstroInfo.matchedBoxingDate.strong].map((p) => (
                          <span key={p} className="px-1 bg-slate-950 rounded border border-slate-800 font-mono text-amber-300 text-[10px]">
                            {p.toLocaleString()}
                          </span>
                        ))}
                      </div>
                      {hoverAstroInfo.matchedBoxingDate.syncPrices && hoverAstroInfo.matchedBoxingDate.syncPrices.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px]">
                          <span className="text-amber-300 font-semibold">Sync Turn Targets:</span>
                          {hoverAstroInfo.matchedBoxingDate.syncPrices.slice(0, 8).map((sp) => (
                            <span key={sp} className="px-1 bg-amber-500/20 rounded border border-amber-500/30 font-mono text-amber-200 text-[10px] font-bold">
                              {sp.toLocaleString()}
                            </span>
                          ))}
                          {hoverAstroInfo.matchedBoxingDate.syncPrices.length > 8 && (
                            <span className="text-[10px] text-slate-400">+{hoverAstroInfo.matchedBoxingDate.syncPrices.length - 8} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : hoverAstroInfo.nextBoxingDate ? (
                    <span className="text-slate-400 text-[10px]">
                      Next Boxing: <strong className="text-amber-300">{hoverAstroInfo.nextBoxingDate.date}</strong> ({hoverAstroInfo.nextBoxingDate.kind})
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]">No active boxing date</span>
                  )}
                </div>

                {/* Price Boxing / Gann Channel Indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-teal-300 font-bold flex items-center gap-1 text-[10px] uppercase">
                    <Box className="w-3.5 h-3.5 text-teal-400" />
                    <span>Gann Channel:</span>
                  </span>
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
          )}
        </div>
      )}

      {/* Main Chart Canvas Container */}
      <div className="relative bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div
          ref={chartContainerRef}
          className={`w-full ${isPopout ? 'h-[calc(100vh-250px)] min-h-[620px]' : 'h-[520px]'}`}
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
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Astro Departure Markers: {filteredAstroEvents.length}</span>
          </div>
        </div>
      </div>

      {/* Bottom Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Permanent Walls Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-mono text-xs font-bold text-amber-200 flex items-center gap-1.5 uppercase">
              <Shield className="w-4 h-4 text-amber-400" />
              Permanent S/R Walls (≥90%)
            </h4>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
              {permWalls.length} Levels
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {permWalls.length > 0 ? (
              permWalls.map((price) => (
                <span
                  key={price}
                  className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold"
                >
                  {price.toLocaleString()}
                </span>
              ))
            ) : (
              <span className="text-xs font-mono text-slate-500">No Permanent Walls in this range</span>
            )}
          </div>
        </div>

        {/* Strong Walls Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-mono text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase">
              <Layers className="w-4 h-4 text-slate-400" />
              Strong Walls (50-89%)
            </h4>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
              {strongWalls.length} Levels
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto no-scrollbar">
            {strongWalls.length > 0 ? (
              strongWalls.map((price) => (
                <span
                  key={price}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-xs"
                >
                  {price.toLocaleString()}
                </span>
              ))
            ) : (
              <span className="text-xs font-mono text-slate-500">No Strong Walls in this range</span>
            )}
          </div>
        </div>

        {/* Critical Signals Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="font-mono text-xs font-bold text-purple-200 flex items-center gap-1.5 uppercase">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Active Astro Departure Signals
            </h4>
            <span className="text-[10px] font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">
              {filteredAstroEvents.length} Signals
            </span>
          </div>
          <div className="space-y-1.5 pt-1 max-h-24 overflow-y-auto no-scrollbar font-mono text-xs text-slate-300">
            {filteredAstroEvents.length > 0 ? (
              filteredAstroEvents.slice(0, 6).map((e, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] border-b border-slate-800/50 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                      e.sig?.tier === 'gold' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' :
                      e.sig?.tier === 'silver' ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/30' :
                      'bg-orange-400/20 text-orange-300 border border-orange-400/30'
                    }`}>
                      {e.sig?.tier?.toUpperCase()}
                    </span>
                    <span className="text-purple-300 font-bold">{e.date}</span>
                  </div>
                  <span className="text-slate-400">{e.body} {e.aspect}</span>
                  <span className={`font-semibold ${e.sig?.direction === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {e.sig?.direction === 'UP' ? '↑' : '↓'} @{e.price}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs font-mono text-slate-500">No signals match current filter</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
