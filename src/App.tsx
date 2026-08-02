import React, { useState, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { ControlsBar } from './components/ControlsBar';
import { Navigation, TabType } from './components/Navigation';
import { OverviewTab } from './components/OverviewTab';
import { MatrixTab } from './components/MatrixTab';
import { CriticalDatesTab } from './components/CriticalDatesTab';
import { DepartureCalendarTab } from './components/DepartureCalendarTab';
import { BoxBreakoutsTab } from './components/BoxBreakoutsTab';
import { BoxingDatesTab } from './components/BoxingDatesTab';
import { IntradayTab } from './components/IntradayTab';
import { TradingTerminalTab } from './components/TradingTerminalTab';
import { SignalsCatalogModal } from './components/SignalsCatalogModal';
import { MarketPreset } from './types';
import { computeMatrix, scanCriticalDates, computeBoxBreakouts } from './lib/matrix';
import { ALL_ASPECTS, MAJOR_ASPECTS } from './lib/astronomy';

export default function App() {
  // Load initial computed parameters from LocalStorage if present
  const initialComputedParams = useMemo(() => {
    try {
      const saved = localStorage.getItem('app_computedParams');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.dateFrom && parsed.dateTo) {
          return {
            dateFrom: String(parsed.dateFrom),
            dateTo: String(parsed.dateTo),
            priceLo: Number(parsed.priceLo) || 23000,
            priceHi: Number(parsed.priceHi) || 26000,
            dateStep: Number(parsed.dateStep) || 2,
            orb: Number(parsed.orb) || 5.0,
            minHighlight: Number(parsed.minHighlight) || 3,
            aspectMode: (parsed.aspectMode === 'all' ? 'all' : 'major') as 'all' | 'major'
          };
        }
      }
    } catch (e) {}
    return {
      dateFrom: '2026-07-14',
      dateTo: '2026-10-15',
      priceLo: 23000,
      priceHi: 26000,
      dateStep: 2,
      orb: 5.0,
      minHighlight: 3,
      aspectMode: 'major' as 'all' | 'major'
    };
  }, []);

  // Pending input states (edited freely in ControlsBar without triggering re-computation)
  const [inputDateFrom, setInputDateFrom] = useState<string>(initialComputedParams.dateFrom);
  const [inputDateTo, setInputDateTo] = useState<string>(initialComputedParams.dateTo);
  const [inputPriceLo, setInputPriceLo] = useState<number>(initialComputedParams.priceLo);
  const [inputPriceHi, setInputPriceHi] = useState<number>(initialComputedParams.priceHi);
  const [inputDateStep, setInputDateStep] = useState<number>(initialComputedParams.dateStep);
  const [inputOrb, setInputOrb] = useState<number>(initialComputedParams.orb);
  const [inputMinHighlight, setInputMinHighlight] = useState<number>(initialComputedParams.minHighlight);
  const [inputAspectMode, setInputAspectMode] = useState<'all' | 'major'>(initialComputedParams.aspectMode);

  // Active computed parameters (used for computeMatrix & all tabs)
  const [computedParams, setComputedParams] = useState(initialComputedParams);

  const [matrixOrbOverride, setMatrixOrbOverride] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('app_matrixOrbOverride');
      return saved !== null ? Number(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const saved = localStorage.getItem('app_activeTab');
      if (saved && ['terminal', 'overview', 'matrix', 'dates', 'calendar', 'boxes', 'boxingdates', 'intraday'].includes(saved)) {
        return saved as TabType;
      }
    } catch (e) {}
    return 'terminal';
  });

  const [focusDate, setFocusDate] = useState<string>(() => {
    try {
      return localStorage.getItem('app_focusDate') || initialComputedParams.dateFrom;
    } catch (e) {
      return initialComputedParams.dateFrom;
    }
  });

  const [activePresetName, setActivePresetName] = useState<string>(() => {
    try {
      return localStorage.getItem('app_activePresetName') || 'Nifty 50';
    } catch (e) {
      return 'Nifty 50';
    }
  });

  const [signalsModalOpen, setSignalsModalOpen] = useState<boolean>(false);

  // Persist primary App settings to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('app_activeTab', activeTab);
      localStorage.setItem('app_computedParams', JSON.stringify(computedParams));
      localStorage.setItem('app_activePresetName', activePresetName);
      localStorage.setItem('app_focusDate', focusDate);
      if (matrixOrbOverride !== null) {
        localStorage.setItem('app_matrixOrbOverride', String(matrixOrbOverride));
      } else {
        localStorage.removeItem('app_matrixOrbOverride');
      }
    } catch (e) {}
  }, [activeTab, computedParams, activePresetName, focusDate, matrixOrbOverride]);

  // Check if pending inputs differ from active computed parameters
  const isDirty = useMemo(() => {
    return (
      inputDateFrom !== computedParams.dateFrom ||
      inputDateTo !== computedParams.dateTo ||
      inputPriceLo !== computedParams.priceLo ||
      inputPriceHi !== computedParams.priceHi ||
      inputDateStep !== computedParams.dateStep ||
      inputOrb !== computedParams.orb ||
      inputMinHighlight !== computedParams.minHighlight ||
      inputAspectMode !== computedParams.aspectMode
    );
  }, [
    inputDateFrom,
    inputDateTo,
    inputPriceLo,
    inputPriceHi,
    inputDateStep,
    inputOrb,
    inputMinHighlight,
    inputAspectMode,
    computedParams
  ]);

  // Compute Matrix Data (Only re-computes when computedParams change)
  const activeAspects = computedParams.aspectMode === 'all' ? ALL_ASPECTS : (MAJOR_ASPECTS as Record<string, number>);

  const matrix = useMemo(() => {
    // Sanity bounds on price range
    const safeLo = Math.max(100, Math.min(computedParams.priceLo, computedParams.priceHi));
    const safeHi = Math.max(safeLo + 100, Math.max(computedParams.priceLo, computedParams.priceHi));
    const ringLo = Math.floor(safeLo / 100);
    const ringHi = Math.ceil(safeHi / 100);

    return computeMatrix(
      computedParams.dateFrom,
      computedParams.dateTo,
      ringLo,
      ringHi,
      computedParams.dateStep,
      computedParams.orb,
      activeAspects
    );
  }, [computedParams, activeAspects]);

  // Compute Badges
  const criticalEvents = useMemo(() => {
    return scanCriticalDates(
      matrix,
      computedParams.dateFrom,
      computedParams.dateTo,
      computedParams.priceLo,
      computedParams.priceHi,
      computedParams.orb,
      computedParams.minHighlight
    );
  }, [matrix, computedParams]);

  const boxBreakouts = useMemo(() => {
    return computeBoxBreakouts(
      matrix,
      computedParams.dateFrom,
      computedParams.dateTo,
      computedParams.priceLo,
      computedParams.priceHi,
      computedParams.orb,
      computedParams.minHighlight
    );
  }, [matrix, computedParams]);

  const datesBadgeCount = criticalEvents.filter((e) => e.sig && e.sig.tier === 'gold').length || criticalEvents.length;
  const boxesBadgeCount = boxBreakouts.reduce(
    (sum, bx) => sum + bx.levels.reduce((s2, lv) => s2 + lv.departures.filter((d) => d.sig).length, 0),
    0
  );

  const handleCompute = () => {
    let validLo = Number(inputPriceLo);
    let validHi = Number(inputPriceHi);
    if (isNaN(validLo) || validLo <= 0) validLo = 20000;
    if (isNaN(validHi) || validHi <= validLo) validHi = validLo + 3000;

    setComputedParams({
      dateFrom: inputDateFrom,
      dateTo: inputDateTo,
      priceLo: validLo,
      priceHi: validHi,
      dateStep: inputDateStep,
      orb: inputOrb,
      minHighlight: inputMinHighlight,
      aspectMode: inputAspectMode
    });
  };

  const handleSelectPreset = (preset: MarketPreset) => {
    setActivePresetName(preset.name);
    setInputPriceLo(preset.priceLo);
    setInputPriceHi(preset.priceHi);

    setComputedParams((prev) => ({
      ...prev,
      priceLo: preset.priceLo,
      priceHi: preset.priceHi
    }));
  };

  const handleControlsChange = (fields: Partial<{
    dateFrom: string;
    dateTo: string;
    priceLo: number;
    priceHi: number;
    dateStep: number;
    orb: number;
    minHighlight: number;
    aspectMode: 'all' | 'major';
  }>) => {
    if (fields.dateFrom !== undefined) {
      setInputDateFrom(fields.dateFrom);
      if (focusDate < fields.dateFrom) setFocusDate(fields.dateFrom);
    }
    if (fields.dateTo !== undefined) {
      setInputDateTo(fields.dateTo);
      if (focusDate > fields.dateTo) setFocusDate(fields.dateTo);
    }
    if (fields.priceLo !== undefined) setInputPriceLo(fields.priceLo);
    if (fields.priceHi !== undefined) setInputPriceHi(fields.priceHi);
    if (fields.dateStep !== undefined) setInputDateStep(fields.dateStep);
    if (fields.orb !== undefined) setInputOrb(fields.orb);
    if (fields.minHighlight !== undefined) setInputMinHighlight(fields.minHighlight);
    if (fields.aspectMode !== undefined) setInputAspectMode(fields.aspectMode);
  };

  const handleExportCsv = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Category,Date,PriceLevel,Body,Aspect,Action,Tier,Lift,Description\n';

    criticalEvents.forEach((e) => {
      csvContent += `CriticalDate,${e.date},${e.price},${e.body},${e.aspect},${e.action},${e.sig?.tier || 'none'},${e.sig?.lift || 0},"${e.sig?.desc || ''}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Nifty_Planetary_Matrix_Report_${computedParams.dateFrom}_to_${computedParams.dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#070a14] text-slate-200 p-3 sm:p-6 selection:bg-amber-400 selection:text-slate-950">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <Header
          onSelectPreset={handleSelectPreset}
          onOpenSignalsModal={() => setSignalsModalOpen(true)}
          onExportCsv={handleExportCsv}
          activePresetName={activePresetName}
        />

        {/* Controls Bar */}
        <ControlsBar
          dateFrom={inputDateFrom}
          dateTo={inputDateTo}
          priceLo={inputPriceLo}
          priceHi={inputPriceHi}
          dateStep={inputDateStep}
          orb={inputOrb}
          minHighlight={inputMinHighlight}
          aspectMode={inputAspectMode}
          isDirty={isDirty}
          onChange={handleControlsChange}
          onCompute={handleCompute}
        />

        {/* Tab Navigation */}
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          datesBadgeCount={datesBadgeCount}
          boxesBadgeCount={boxesBadgeCount}
        />

        {/* Main Tab Panels */}
        <main className="transition-all duration-300">
          {activeTab === 'terminal' && (
            <TradingTerminalTab
              matrix={matrix}
              dateFrom={computedParams.dateFrom}
              dateTo={computedParams.dateTo}
              priceLo={computedParams.priceLo}
              priceHi={computedParams.priceHi}
              orb={computedParams.orb}
              minHighlight={computedParams.minHighlight}
            />
          )}

          {activeTab === 'overview' && (
            <OverviewTab
              matrix={matrix}
              focusDate={focusDate}
              onSelectFocusDate={(d) => setFocusDate(d)}
              orb={computedParams.orb}
              aspectMode={computedParams.aspectMode}
            />
          )}

          {activeTab === 'matrix' && (
            <MatrixTab
              matrix={matrix}
              dateFrom={computedParams.dateFrom}
              dateTo={computedParams.dateTo}
              priceLo={computedParams.priceLo}
              priceHi={computedParams.priceHi}
              dateStep={computedParams.dateStep}
              minHighlight={computedParams.minHighlight}
              focusDate={focusDate}
              onSelectFocusDate={(d) => setFocusDate(d)}
              globalOrb={computedParams.orb}
              matrixOrbOverride={matrixOrbOverride}
              onApplyMatrixOrb={(val) => setMatrixOrbOverride(val)}
              aspectMode={computedParams.aspectMode}
            />
          )}

          {activeTab === 'dates' && (
            <CriticalDatesTab
              matrix={matrix}
              dateFrom={computedParams.dateFrom}
              dateTo={computedParams.dateTo}
              priceLo={computedParams.priceLo}
              priceHi={computedParams.priceHi}
              orb={computedParams.orb}
              minHighlight={computedParams.minHighlight}
            />
          )}

          {activeTab === 'calendar' && (
            <DepartureCalendarTab
              matrix={matrix}
              minHighlight={computedParams.minHighlight}
              orb={computedParams.orb}
            />
          )}

          {activeTab === 'boxes' && (
            <BoxBreakoutsTab
              matrix={matrix}
              dateFrom={computedParams.dateFrom}
              dateTo={computedParams.dateTo}
              priceLo={computedParams.priceLo}
              priceHi={computedParams.priceHi}
              orb={computedParams.orb}
              minHighlight={computedParams.minHighlight}
            />
          )}

          {activeTab === 'boxingdates' && (
            <BoxingDatesTab
              matrix={matrix}
              dateFrom={computedParams.dateFrom}
              dateTo={computedParams.dateTo}
              priceLo={computedParams.priceLo}
              priceHi={computedParams.priceHi}
              orb={computedParams.orb}
              minHighlight={computedParams.minHighlight}
            />
          )}

          {activeTab === 'intraday' && <IntradayTab />}
        </main>

        {/* Footer */}
        <footer className="pt-8 pb-4 border-t border-slate-800/80 text-[11px] font-mono text-slate-500 leading-relaxed">
          <p>
            <b>Ephemeris & Analysis Engine:</b> High-precision Keplerian planetary orbital computation (Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto & Lunar Nodes). Statistical breakout signals derived from 6,595-day historical study on Nifty Index (2000–2026, 735 boxing episodes). Historical signal lifts are analytical metrics for pressure analysis, not financial advice.
          </p>
        </footer>
      </div>

      {/* 42 Signals Catalog Modal */}
      <SignalsCatalogModal
        isOpen={signalsModalOpen}
        onClose={() => setSignalsModalOpen(false)}
      />
    </div>
  );
}
