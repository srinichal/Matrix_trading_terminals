import React, { useState, useMemo, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { OverviewTab } from './components/OverviewTab';
import { MatrixTab } from './components/MatrixTab';
import { BoxBreakoutsTab } from './components/BoxBreakoutsTab';
import { BoxingDatesTab } from './components/BoxingDatesTab';
import { IntradayTab } from './components/IntradayTab';
import { TradingTerminalTab } from './components/TradingTerminalTab';
import { SignalsCatalogModal } from './components/SignalsCatalogModal';
import { MatrixWallsModal } from './components/MatrixWallsModal';
import { TabType } from './components/Navigation';
import { MarketPreset } from './types';
import { computeMatrix, scanCriticalDates, computeBoxBreakouts } from './lib/matrix';
import { ALL_ASPECTS, MAJOR_ASPECTS } from './lib/astronomy';
import {
  PanelLeftOpen,
  Sparkles,
  FileSpreadsheet,
  Play,
  Layers,
  CandlestickChart,
  CalendarRange,
  Box,
  Grid3X3,
  LayoutDashboard,
  Target
} from 'lucide-react';

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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('app_sidebarCollapsed');
      return saved === 'true';
    } catch (e) {
      return false;
    }
  });

  // Pending input states
  const [inputDateFrom, setInputDateFrom] = useState<string>(initialComputedParams.dateFrom);
  const [inputDateTo, setInputDateTo] = useState<string>(initialComputedParams.dateTo);
  const [inputPriceLo, setInputPriceLo] = useState<number>(initialComputedParams.priceLo);
  const [inputPriceHi, setInputPriceHi] = useState<number>(initialComputedParams.priceHi);
  const [inputDateStep, setInputDateStep] = useState<number>(initialComputedParams.dateStep);
  const [inputOrb, setInputOrb] = useState<number>(initialComputedParams.orb);
  const [inputMinHighlight, setInputMinHighlight] = useState<number>(initialComputedParams.minHighlight);
  const [inputAspectMode, setInputAspectMode] = useState<'all' | 'major'>(initialComputedParams.aspectMode);

  // Active computed parameters
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
      if (saved && ['terminal', 'overview', 'matrix', 'boxes', 'boxingdates', 'intraday'].includes(saved)) {
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
  const [wallsModalOpen, setWallsModalOpen] = useState<boolean>(false);

  // Persist primary App settings to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('app_activeTab', activeTab);
      localStorage.setItem('app_computedParams', JSON.stringify(computedParams));
      localStorage.setItem('app_activePresetName', activePresetName);
      localStorage.setItem('app_focusDate', focusDate);
      localStorage.setItem('app_sidebarCollapsed', String(isSidebarCollapsed));
      if (matrixOrbOverride !== null) {
        localStorage.setItem('app_matrixOrbOverride', String(matrixOrbOverride));
      } else {
        localStorage.removeItem('app_matrixOrbOverride');
      }
    } catch (e) {}
  }, [activeTab, computedParams, activePresetName, focusDate, matrixOrbOverride, isSidebarCollapsed]);

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

  // Compute Matrix Data
  const activeAspects = computedParams.aspectMode === 'all' ? ALL_ASPECTS : (MAJOR_ASPECTS as Record<string, number>);

  const matrix = useMemo(() => {
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

  const TAB_TITLES: Record<string, { title: string; icon: React.FC<{ className?: string }> }> = {
    terminal: { title: 'Trading Terminal', icon: CandlestickChart },
    boxingdates: { title: 'Boxing Dates', icon: CalendarRange },
    boxes: { title: 'Box Breakouts', icon: Box },
    matrix: { title: 'Matrix Grid', icon: Grid3X3 },
    overview: { title: 'Overview Dashboard', icon: LayoutDashboard },
    intraday: { title: 'Intraday Levels', icon: Target }
  };

  const ActiveIcon = TAB_TITLES[activeTab]?.icon || CandlestickChart;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#070a14] text-slate-200 selection:bg-amber-400 selection:text-slate-950">
      {/* Collapsible Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        boxesBadgeCount={boxesBadgeCount}
        activePresetName={activePresetName}
        onSelectPreset={handleSelectPreset}
        onOpenSignalsModal={() => setSignalsModalOpen(true)}
        onOpenWallsModal={() => setWallsModalOpen(true)}
        onExportCsv={handleExportCsv}
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

      {/* Main Full-Bleed Content Container */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Sleek Topbar */}
        <header className="flex items-center justify-between px-3 py-1.5 bg-[#0b0f1d] border-b border-slate-800/80 shrink-0 select-none z-30">
          <div className="flex items-center gap-3 min-w-0">
            {/* Sidebar toggle button when collapsed */}
            {isSidebarCollapsed && (
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition-all shrink-0"
                title="Expand Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            {/* Active Tab Title */}
            <div className="flex items-center gap-2 min-w-0">
              <ActiveIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <h1 className="font-mono text-xs sm:text-sm font-bold text-amber-200 uppercase tracking-wider truncate">
                {TAB_TITLES[activeTab]?.title}
              </h1>
            </div>

            {/* Preset & Range Badges */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-800">
              <span className="px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-semibold flex items-center gap-1">
                <Layers className="w-3 h-3" /> {activePresetName}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono">
                {computedParams.dateFrom} ➔ {computedParams.dateTo}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono">
                {computedParams.priceLo.toLocaleString()} – {computedParams.priceHi.toLocaleString()} pts
              </span>
            </div>
          </div>

          {/* Quick Action Controls in Topbar */}
          <div className="flex items-center gap-2 shrink-0">
            {isDirty && (
              <button
                onClick={handleCompute}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs font-mono shadow-md shadow-amber-400/30 animate-pulse hover:bg-amber-300 transition-all"
              >
                <Play className="w-3 h-3 fill-current" />
                Compute
              </button>
            )}

            <button
              onClick={() => setWallsModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-mono text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
            >
              <Grid3X3 className="w-3.5 h-3.5 text-amber-400" />
              Matrix Walls
            </button>

            <button
              onClick={() => setSignalsModalOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-mono text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              42 Signals
            </button>

            <button
              onClick={handleExportCsv}
              className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-mono text-xs font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
              Export
            </button>
          </div>
        </header>

        {/* Main Content View Container */}
        <main className={`flex-1 flex flex-col h-full min-h-0 overflow-y-auto no-scrollbar ${activeTab === 'terminal' ? 'p-1.5 sm:p-2' : 'p-3 sm:p-5'}`}>
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
      </div>

      {/* 42 Signals Catalog Modal */}
      <SignalsCatalogModal
        isOpen={signalsModalOpen}
        onClose={() => setSignalsModalOpen(false)}
      />

      {/* Matrix Planetary Walls Catalog Pop Box Modal */}
      <MatrixWallsModal
        isOpen={wallsModalOpen}
        onClose={() => setWallsModalOpen(false)}
        matrix={matrix}
        priceLo={computedParams.priceLo}
        priceHi={computedParams.priceHi}
        dateFrom={computedParams.dateFrom}
        dateTo={computedParams.dateTo}
        orb={computedParams.orb}
        minHighlight={computedParams.minHighlight}
      />
    </div>
  );
}
