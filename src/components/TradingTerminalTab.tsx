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
  History
} from 'lucide-react';
import { MatrixData, DepartureEvent } from '../types';
import { scanCriticalDates } from '../lib/matrix';

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
  const [timeframe, setTimeframe] = useState<TimeframeType>('30m');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFetchedInfo, setLastFetchedInfo] = useState<string>('');
  const [historyLoadedCount, setHistoryLoadedCount] = useState<number>(0);

  // Popout Mode State
  const [isPopout, setIsPopout] = useState<boolean>(false);

  // Overlays
  const [showPermWalls, setShowPermWalls] = useState<boolean>(true);
  const [showStrongWalls, setShowStrongWalls] = useState<boolean>(true);
  const [showAstroSignals, setShowAstroSignals] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Zerodha Kite API parameters
  const [kiteApiKey, setKiteApiKey] = useState<string>('');
  const [kiteAccessToken, setKiteAccessToken] = useState<string>('');
  const [kiteEnctoken, setKiteEnctoken] = useState<string>(
    'h9CVFAGNIiKi0avcSn1HiPxfMTI19cVeVdLGj1p7MviLtlOfim6bD66J04nuwTeaP9Iy3vAeN0QAti05qu/EKz2rr4bmwmQyxvDtcO3UA0hHavtH18MOcQ=='
  );
  const [kiteInstrumentToken, setKiteInstrumentToken] = useState<string>('256265'); // Default Nifty 50
  const [kiteCustomUrl, setKiteCustomUrl] = useState<string>(
    'https://kite.zerodha.com/oms/instruments/historical/{instrument_token}/{interval}?user_id=GW0461&oi=1&from={from}&to={to}'
  );
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Active Candle Data
  const [candles, setCandles] = useState<OHLCCandle[]>([]);
  const [activeHoverCandle, setActiveHoverCandle] = useState<OHLCCandle | null>(null);

  // Canvas Refs & Async Tracking
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const isLoadingOlderRef = useRef<boolean>(false);
  const candlesRef = useRef<OHLCCandle[]>(candles);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

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

  // Extract Critical Astro Signals
  const astroEvents = useMemo(() => {
    const raw = scanCriticalDates(matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight);
    const signalMap = new Map<string, DepartureEvent>();

    raw.forEach((e) => {
      if (e.sig && (e.sig.tier === 'gold' || e.sig.tier === 'silver')) {
        const key = `${e.date}_${e.price}`;
        const existing = signalMap.get(key);
        if (!existing || (e.sig.lift || 0) > (existing.sig?.lift || 0)) {
          signalMap.set(key, e);
        }
      }
    });

    return Array.from(signalMap.values())
      .sort((a, b) => (b.sig?.lift || 0) - (a.sig?.lift || 0))
      .slice(0, 25);
  }, [matrix, dateFrom, dateTo, priceLo, priceHi, orb, minHighlight]);

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
  const loadCandles = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (!kiteEnctoken && (!kiteApiKey || !kiteAccessToken)) {
        setLastFetchedInfo('Please enter your Zerodha Enctoken or API Key in the configuration panel below to connect.');
        setIsLoading(false);
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

        setCandles(formatted);
        setLastFetchedInfo(`Successfully loaded ${formatted.length} live candles from Zerodha Kite!`);
      } else {
        setCandles([]);
        setErrorMsg(json.message || 'Failed to load candles from Zerodha Kite API');
        setLastFetchedInfo('Zerodha Kite API returned an error. Check credentials or instrument token.');
      }
    } catch (err: any) {
      console.warn('[Zerodha Kite Fetch Error]', err);
      setErrorMsg(err.message || 'Network error fetching Zerodha Kite candles');
      setLastFetchedInfo('Failed to connect to Zerodha Kite proxy.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load or refresh when timeframe / dates change
  useEffect(() => {
    loadCandles();
  }, [timeframe, dateFrom, dateTo, kiteEnctoken, kiteApiKey, kiteAccessToken, kiteInstrumentToken]);

  // Render TradingView Lightweight Chart Canvas
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chartHeight = isPopout ? Math.max(620, window.innerHeight - 240) : 520;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' }, // Dark Slate/Gold aesthetic
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
      upColor: '#10b981', // Emerald
      downColor: '#f43f5e', // Rose
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    });
    candleSeriesRef.current = candleSeries;

    // Volume Series
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#38bdf8',
        priceFormat: {
          type: 'volume'
        },
        priceScaleId: 'volume_scale'
      });

      chart.priceScale('volume_scale').applyOptions({
        scaleMargins: {
          top: 0.8, // Place volume at bottom 20%
          bottom: 0
        }
      });

      volumeSeriesRef.current = volumeSeries;
    }

    // Set Candlestick & Volume Data
    if (candles && candles.length > 0) {
      const chartCandles: CandlestickData<Time>[] = candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close
      }));

      candleSeries.setData(chartCandles);

      if (showVolume && volumeSeriesRef.current) {
        const volumeData = candles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'
        }));
        volumeSeriesRef.current.setData(volumeData);
      }

      // Draw Permanent Wall Horizontal Price Lines
      if (showPermWalls && permWalls.length > 0) {
        permWalls.forEach((pw) => {
          candleSeries.createPriceLine({
            price: pw,
            color: '#f59e0b', // Amber 500
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `PERM WALL ${pw.toLocaleString()}`
          });
        });
      }

      // Draw Strong Wall Horizontal Price Lines
      if (showStrongWalls && strongWalls.length > 0) {
        strongWalls.forEach((sw) => {
          candleSeries.createPriceLine({
            price: sw,
            color: '#94a3b8', // Slate 400
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `STRONG WALL ${sw.toLocaleString()}`
          });
        });
      }

      // Set Astro Signal Markers on Candlestick Chart
      if (showAstroSignals && astroEvents.length > 0) {
        const markers: SeriesMarker<Time>[] = [];

        // Map candles by date string
        const dateToTimestamp = new Map<string, Time>();
        candles.forEach((c) => {
          const dStr = new Date(c.time * 1000).toISOString().split('T')[0];
          if (!dateToTimestamp.has(dStr)) {
            dateToTimestamp.set(dStr, c.time as Time);
          }
        });

        astroEvents.forEach((ev) => {
          const matchTime = dateToTimestamp.get(ev.date);
          if (matchTime) {
            const isGold = ev.sig?.tier === 'gold';
            markers.push({
              time: matchTime,
              position: 'aboveBar',
              color: isGold ? '#a855f7' : '#06b6d4',
              shape: 'arrowDown',
              text: `${isGold ? 'GOLD' : 'SLV'} ${ev.price} (${ev.body})`
            });
          }
        });

        createSeriesMarkers(candleSeries, markers);
      }

      // Fit chart content neatly
      chart.timeScale().fitContent();
    }

    // Subscribe to scroll-back range change for infinite history loading
    const handleLogicalRangeChange = (logicalRange: any) => {
      if (logicalRange && logicalRange.from < 3 && !isLoadingOlderRef.current && candlesRef.current.length > 0) {
        loadOlderHistory();
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);

    // Subscribe to crosshair move for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.get(candleSeries)) {
        const data = param.seriesData.get(candleSeries) as CandlestickData;
        const matched = candles.find((c) => c.time === param.time);
        if (matched) {
          setActiveHoverCandle(matched);
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

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, permWalls, strongWalls, showPermWalls, showStrongWalls, showAstroSignals, showVolume, astroEvents, isPopout]);

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
              onClick={() => setShowConfigPanel(!showConfigPanel)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-mono text-xs font-semibold border transition-all ${
                showConfigPanel
                  ? 'bg-slate-800 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{showConfigPanel ? 'Close Credentials' : 'API / Token Config'}</span>
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
              title="Fit Content / Reset Zoom"
              className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
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

            <button
              onClick={() => setShowAstroSignals(!showAstroSignals)}
              className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-lg font-mono text-[11px] font-semibold border transition-all ${
                showAstroSignals
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                  : 'bg-slate-950 text-slate-500 border-slate-800'
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              Astro Signals ({astroEvents.length})
            </button>

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
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4 font-mono text-xs shadow-lg">
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
            <span>Astro Departure Markers: {astroEvents.length}</span>
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
              {astroEvents.length} Signals
            </span>
          </div>
          <div className="space-y-1.5 pt-1 max-h-24 overflow-y-auto no-scrollbar font-mono text-xs text-slate-300">
            {astroEvents.slice(0, 4).map((e, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] border-b border-slate-800/50 pb-1">
                <span className="text-purple-300 font-bold">{e.date}</span>
                <span className="text-slate-400">{e.body} {e.aspect}</span>
                <span className="text-amber-300 font-semibold">@{e.price}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
