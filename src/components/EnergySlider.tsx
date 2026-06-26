/**
 * EnergySlider.tsx
 * ----------------
 * Touch-friendly energy level selector with visual feedback.
 * Reads/writes global energy state that influences Jerald scheduling suggestions.
 */

import { useState } from 'react';
import { UserEnergyState } from '../types';
import { Zap, BatteryMedium, BatteryLow, Sun, CloudSun, Moon } from 'lucide-react';

interface EnergySliderProps {
  value: UserEnergyState;
  onChange: (value: UserEnergyState) => void;
  compact?: boolean;
}

const LEVELS: { key: UserEnergyState; label: string; icon: React.ReactNode; bgClass: string; textClass: string; borderClass: string }[] = [
  {
    key: 'High',
    label: 'High',
    icon: <Zap className="w-4 h-4" />,
    bgClass: 'bg-gradient-to-r from-orange-500/30 to-orange-400/20',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-orange-500/40',
  },
  {
    key: 'Medium',
    label: 'Medium',
    icon: <BatteryMedium className="w-4 h-4" />,
    bgClass: 'bg-gradient-to-r from-blue-500/30 to-blue-400/20',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-500/40',
  },
  {
    key: 'Low',
    label: 'Low',
    icon: <BatteryLow className="w-4 h-4" />,
    bgClass: 'bg-gradient-to-r from-slate-400/30 to-slate-300/20',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-slate-400/40',
  },
];

const TIME_OF_DAY_ICONS = {
  high: <Sun className="w-5 h-5 text-orange-400" />,
  medium: <CloudSun className="w-5 h-5 text-blue-400" />,
  low: <Moon className="w-5 h-5 text-indigo-400" />,
};

export default function EnergySlider({ value, onChange, compact = false }: EnergySliderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentLevel = LEVELS.find((l) => l.key === value) || LEVELS[1];

  if (compact) {
    return (
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 touch-target ${currentLevel.bgClass} ${currentLevel.borderClass} border`}
      >
        {currentLevel.icon}
        <span className={`text-sm font-medium ${currentLevel.textClass}`}>
          {currentLevel.label}
        </span>
      </button>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {value === 'High' && TIME_OF_DAY_ICONS.high}
          {value === 'Medium' && TIME_OF_DAY_ICONS.medium}
          {value === 'Low' && TIME_OF_DAY_ICONS.low}
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Your Energy
          </span>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${currentLevel.bgClass} ${currentLevel.textClass}`}>
          {currentLevel.label}
        </span>
      </div>

      <div className="relative">
        {/* Slider track */}
        <div className="h-2 rounded-full bg-slate-200/60 dark:bg-slate-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              value === 'High' ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
              value === 'Medium' ? 'bg-gradient-to-r from-blue-400 to-blue-500' :
              'bg-gradient-to-r from-slate-400 to-slate-500'
            }`}
            style={{ width: `${value === 'High' ? 100 : value === 'Medium' ? 55 : 25}%` }}
          />
        </div>

        {/* Slider markers */}
        <div className="flex justify-between mt-3">
          {LEVELS.map((level) => (
            <button
              key={level.key}
              onClick={() => onChange(level.key)}
              className={`flex flex-col items-center gap-1 transition-all duration-200 touch-target px-2 py-1 rounded-lg ${
                value === level.key
                  ? `${level.bgClass} ${level.borderClass} border scale-105`
                  : 'hover:bg-slate-100/40 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className={`${value === level.key ? level.textClass : 'text-slate-400'}`}>
                {level.icon}
              </div>
              <span className={`text-[10px] font-medium ${value === level.key ? level.textClass : 'text-slate-400'}`}>
                {level.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-slate-400 mt-3 text-center">
        Jerald tailors suggestions based on your energy level
      </p>
    </div>
  );
}
