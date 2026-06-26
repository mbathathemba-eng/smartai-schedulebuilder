/**
 * TabNavigation.tsx
 * -----------------
 * Unified navigation component for both mobile bottom nav and desktop sidebar.
 * Features glassmorphism styling, orange accent for active states, and touch-safe targets.
 */

import { ViewTab } from '../types';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  Inbox,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

interface TabNavigationProps {
  activeTab: ViewTab;
  onChangeTab: (tab: ViewTab) => void;
  variant: 'mobile' | 'desktop';
}

const TABS: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
  { key: 'today', label: 'Today', icon: <Calendar className="w-5 h-5" /> },
  { key: 'tomorrow', label: 'Tomorrow', icon: <CalendarDays className="w-5 h-5" /> },
  { key: 'upcoming', label: 'Upcoming', icon: <CalendarRange className="w-5 h-5" /> },
  { key: 'inbox', label: 'Inbox', icon: <Inbox className="w-5 h-5" /> },
  { key: 'jerald', label: 'Jerald', icon: <Sparkles className="w-5 h-5" /> },
  { key: 'calendar', label: 'Calendar', icon: <LayoutGrid className="w-5 h-5" /> },
];

export default function TabNavigation({ activeTab, onChangeTab, variant }: TabNavigationProps) {
  if (variant === 'mobile') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav safe-area-inset-bottom">
        <div className="flex items-center justify-around px-1 py-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onChangeTab(tab.key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 px-2 rounded-xl transition-all duration-200 touch-target min-w-[56px] ${
                  isActive
                    ? 'text-orange-500 bg-orange-500/10'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                <div className={`${isActive ? 'scale-110' : ''} transition-transform duration-200`}>
                  {tab.icon}
                </div>
                <span className="text-[10px] font-medium truncate">{tab.label}</span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-orange-500 glow-orange" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Desktop sidebar variant
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col glass-sidebar h-screen sticky top-0">
      <div className="h-14 flex items-center px-4 border-b border-slate-200/30 dark:border-slate-700/30">
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-white" />
          </span>
          Schedule
        </span>
      </div>

      <div className="flex-1 p-3 space-y-1 overflow-y-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChangeTab(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 touch-target hover-lift ${
                isActive
                  ? 'bg-gradient-to-r from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400 border border-orange-500/20 shadow-sm glow-orange'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 border border-transparent'
              }`}
            >
              <div className={`${isActive ? 'text-orange-500' : ''}`}>
                {tab.icon}
              </div>
              <span className="flex-1 text-left">{tab.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
