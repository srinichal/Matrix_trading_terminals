import React, { useState } from 'react';
import {
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Grid3X3,
  Box,
  Target,
  CandlestickChart,
  CalendarRange,
  Layers,
  Sparkles,
  FileSpreadsheet,
  Play,
  Settings,
  Sliders,
  ChevronDown,
  ChevronRight,
  Filter
} from 'lucide-react';
import { TabType } from './Navigation';
import { MarketPreset } from '../types';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  boxesBadgeCount: number;
  datesBadgeCount?: number;
  activePresetName: string;
  onSelectPreset: (preset: MarketPreset) => void;
  onOpenSignalsModal: () => void;
  onOpenWallsModal?: () => void;
  onExportCsv: () => void;

  // Controls props
  dateFrom: string;
  dateTo: string;
  priceLo: number;
  priceHi: number;
  dateStep: number;
  orb: number;
  minHighlight: number;
  aspectMode: 'all' | 'major';
  isDirty?: boolean;
  onChange: (fields: Partial<{
    dateFrom: string;
    dateTo: string;
    priceLo: number;
    priceHi: number;
    dateStep: number;
    orb: number;
    minHighlight: number;
    aspectMode: 'all' | 'major';
  }>) => void;
  onCompute: () => void;
}

export const PRESETS: MarketPreset[] = [
  { name: 'Nifty 50', symbol: 'NIFTY', priceLo: 23000, priceHi: 26000, defaultRangeDays: 90 },
  { name: 'Nifty Spot (24k-25k)', symbol: 'NIFTY_SPOT', priceLo: 24000, priceHi: 25000, defaultRangeDays: 90 },
  { name: 'Nifty Wide (22k-27k)', symbol: 'NIFTY_WIDE', priceLo: 22000, priceHi: 27000, defaultRangeDays: 90 }
];

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onTabChange,
  boxesBadgeCount,
  activePresetName,
  onSelectPreset,
  onOpenSignalsModal,
  onOpenWallsModal,
  onExportCsv,
  dateFrom,
  dateTo,
  priceLo,
  priceHi,
  dateStep,
  orb,
  minHighlight,
  aspectMode,
  isDirty,
  onChange,
  onCompute
}) => {
  const [controlsExpanded, setControlsExpanded] = useState(true);
  const [advExpanded, setAdvExpanded] = useState(false);

  const TABS: { id: TabType; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'terminal', label: 'Trading Terminal', icon: CandlestickChart },
    { id: 'boxingdates', label: 'Boxing Dates', icon: CalendarRange },
    { id: 'boxes', label: 'Box Breakouts', icon: Box, badge: boxesBadgeCount },
    { id: 'matrix', label: 'Matrix Grid', icon: Grid3X3 },
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'intraday', label: 'Intraday Levels', icon: Target }
  ];

  return (
    <aside
      className={`relative flex flex-col bg-[#0b0f1d] border-r border-slate-800/80 transition-all duration-300 ease-in-out z-40 select-none ${
        isCollapsed ? 'w-16 min-w-[64px]' : 'w-72 sm:w-80 min-w-[280px]'
      } h-screen sticky top-0 overflow-y-auto no-scrollbar shadow-2xl`}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-slate-800/80 bg-slate-950/60 sticky top-0 backdrop-blur-md z-10">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-teal-500/20 border border-amber-500/40 shrink-0">
              <Compass className="w-5 h-5 text-amber-400 animate-spin-slow" />
            </div>
            <div className="overflow-hidden">
              <h1 className="font-serif text-sm font-bold text-amber-200 truncate leading-tight">
                Nifty Matrix
              </h1>
              <span className="text-[10px] font-mono text-teal-400 block truncate">
                Timing Intelligence v4.0
              </span>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-400/10 to-teal-500/20 border border-amber-500/40">
              <Compass className="w-5 h-5 text-amber-400" />
            </div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 transition-all shrink-0 ${
            isCollapsed ? 'mx-auto mt-2' : ''
          }`}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-5 h-5" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Collapsed Mode Quick Icons */}
      {isCollapsed ? (
        <div className="flex flex-col items-center py-4 gap-2 flex-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                title={tab.label}
                className={`relative group p-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border border-slate-950">
                    {tab.badge}
                  </span>
                )}
                {/* Tooltip on hover */}
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-slate-200 font-mono text-xs rounded-md shadow-xl border border-slate-700 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {tab.label}
                </div>
              </button>
            );
          })}

          <div className="w-8 h-[1px] bg-slate-800 my-2" />

          {/* Quick Compute in Collapsed Mode */}
          <button
            onClick={onCompute}
            title={isDirty ? 'Compute Pending Changes' : 'Matrix Computed'}
            className={`p-2.5 rounded-xl transition-all ${
              isDirty
                ? 'bg-amber-400 text-slate-950 animate-pulse shadow-md shadow-amber-400/30'
                : 'bg-slate-800/60 text-amber-400 hover:bg-slate-800'
            }`}
          >
            <Play className="w-5 h-5 fill-current" />
          </button>

          {onOpenWallsModal && (
            <button
              onClick={onOpenWallsModal}
              title="Matrix Planetary Walls Catalog"
              className="p-2.5 rounded-xl text-amber-300 hover:bg-amber-500/10 transition-all mt-auto"
            >
              <Grid3X3 className="w-5 h-5 text-amber-400" />
            </button>
          )}

          <button
            onClick={onOpenSignalsModal}
            title="42 Signals Catalog"
            className="p-2.5 rounded-xl text-amber-300 hover:bg-amber-500/10 transition-all"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      ) : (
        /* Expanded Mode Content */
        <div className="flex-1 p-3 space-y-5">
          {/* Navigation Section */}
          <div className="space-y-1">
            <div className="px-2 pb-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold">
              Navigation
            </div>
            <nav className="space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-mono text-xs font-semibold tracking-wide transition-all ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-400/80'}`} />
                      <span>{tab.label}</span>
                    </div>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-slate-950 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Market Presets */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
            <div className="px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-400" /> Presets
            </div>
            <div className="grid grid-cols-1 gap-1">
              {PRESETS.map((p) => {
                const isActive = activePresetName === p.name;
                return (
                  <button
                    key={p.symbol}
                    onClick={() => onSelectPreset(p)}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded-lg transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-slate-800 border border-amber-400/50 text-amber-300 font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      {p.priceLo/1000}k-{p.priceHi/1000}k
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls & Range Parameters */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <button
              onClick={() => setControlsExpanded(!controlsExpanded)}
              className="w-full px-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest font-bold flex items-center justify-between hover:text-slate-300 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-amber-400" /> Range & Matrix Parameters
              </span>
              {controlsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {controlsExpanded && (
              <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-3 font-mono text-xs">
                {/* Date From & To */}
                <div className="space-y-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 uppercase">Date From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => onChange({ dateFrom: e.target.value })}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400 transition-all w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-400 uppercase">Date To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => onChange({ dateTo: e.target.value })}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-400 transition-all w-full"
                    />
                  </div>
                </div>

                {/* Price Range */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 uppercase">Price Range</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={priceLo === 0 ? '' : priceLo}
                      step={100}
                      onChange={(e) => onChange({ priceLo: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400 w-1/2"
                      placeholder="Min"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="number"
                      value={priceHi === 0 ? '' : priceHi}
                      step={100}
                      onChange={(e) => onChange({ priceHi: e.target.value === '' ? 0 : Number(e.target.value) })}
                      className="bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400 w-1/2"
                      placeholder="Max"
                    />
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button
                  onClick={() => setAdvExpanded(!advExpanded)}
                  className="w-full text-[10px] text-slate-400 hover:text-amber-300 flex items-center justify-between pt-1 border-t border-slate-800"
                >
                  <span>Advanced Settings</span>
                  <span>{advExpanded ? '▲' : '▼'}</span>
                </button>

                {advExpanded && (
                  <div className="space-y-2.5 pt-1 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Date Step</label>
                      <select
                        value={dateStep}
                        onChange={(e) => onChange({ dateStep: Number(e.target.value) })}
                        className="bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
                      >
                        <option value={1}>Daily (1d)</option>
                        <option value={2}>2 Days</option>
                        <option value={7}>Weekly (7d)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Orb Tolerance (°)</label>
                      <input
                        type="number"
                        value={orb}
                        step={0.5}
                        min={0.5}
                        max={15}
                        onChange={(e) => onChange({ orb: Number(e.target.value) })}
                        className="bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Min Wall Strength</label>
                      <select
                        value={minHighlight}
                        onChange={(e) => onChange({ minHighlight: Number(e.target.value) })}
                        className="bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-amber-400"
                      >
                        <option value={2}>≥2 Planets</option>
                        <option value={3}>≥3 Planets (PP)</option>
                        <option value={4}>≥4 Planets (Strong)</option>
                        <option value={5}>≥5 Planets (Wall)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-400 uppercase">Aspect Mode</label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => onChange({ aspectMode: 'all' })}
                          className={`py-1 text-[10px] rounded ${
                            aspectMode === 'all' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
                          }`}
                        >
                          All 11
                        </button>
                        <button
                          onClick={() => onChange({ aspectMode: 'major' })}
                          className={`py-1 text-[10px] rounded ${
                            aspectMode === 'major' ? 'bg-amber-400 text-slate-950 font-bold' : 'text-slate-400'
                          }`}
                        >
                          Major 5
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Compute Button */}
                <button
                  onClick={onCompute}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl font-sans font-bold text-xs shadow-lg active:scale-95 transition-all mt-2 ${
                    isDirty
                      ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-950 animate-pulse'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 hover:from-amber-300 hover:to-amber-400 shadow-amber-500/20'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {isDirty ? 'Compute Pending Changes' : 'Re-Compute Matrix'}
                </button>
              </div>
            )}
          </div>

          {/* Action Tools */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            {onOpenWallsModal && (
              <button
                onClick={onOpenWallsModal}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-mono text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-sm"
              >
                <Grid3X3 className="w-4 h-4 text-amber-400" />
                Matrix Walls Catalog
              </button>
            )}

            <button
              onClick={onOpenSignalsModal}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-mono text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              42 Signals Catalog
            </button>

            <button
              onClick={onExportCsv}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-mono text-xs font-semibold text-teal-300 bg-teal-500/10 border border-teal-500/30 hover:bg-teal-500/20 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4 text-teal-400" />
              Export CSV Report
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
