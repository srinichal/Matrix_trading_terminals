import React from 'react';
import { LayoutDashboard, Grid3X3, Box, Target, CandlestickChart, CalendarRange } from 'lucide-react';

export type TabType = 'overview' | 'matrix' | 'boxes' | 'boxingdates' | 'intraday' | 'terminal';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange
}) => {
  const TABS: { id: TabType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'terminal', label: 'Trading Terminal', icon: CandlestickChart },
    { id: 'matrix', label: 'Matrix', icon: Grid3X3 },
    { id: 'boxes', label: 'Box Breakouts', icon: Box },
    { id: 'boxingdates', label: 'Boxing Dates', icon: CalendarRange },
    { id: 'intraday', label: 'Intraday Levels', icon: Target }
  ];

  return (
    <nav className="flex gap-1.5 p-1.5 mb-5 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto sticky top-2 z-30 shadow-2xl backdrop-blur-lg no-scrollbar">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider font-semibold whitespace-nowrap transition-all flex-1 justify-center min-w-[130px] ${
              isActive
                ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
};
