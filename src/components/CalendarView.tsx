/**
 * CalendarView.tsx
 * ----------------
 * Full month calendar view with task indicators and date navigation.
 *
 * CRITICAL: Uses LOCAL date boundaries (toLocaleDateString) to prevent
 * timezone offset bugs where clicking June 27 opens June 26.
 *
 * Features:
 *   - Glassmorphism styling with orange accent for active dates
 *   - Task completion indicators per day
 *   - Touch-safe targets (min-h-[44px])
 *   - Quick-add task button that uses the selected date
 */

import { useState, useMemo, useCallback } from 'react';
import { Task, UserEnergyState } from '../types';
import { todayStr, formatMonthYear, daysInMonth, firstDayOfMonth, getDateLabel, makeDateStr } from '../lib/utils';
import { Plus, ChevronLeft, ChevronRight, Calendar, CheckCircle2, X } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  activeDate: string;
  onChangeDate: (date: string) => void;
  energy: UserEnergyState;
  onAddTask?: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

export default function CalendarView({ tasks, activeDate, onChangeDate, energy, onAddTask }: CalendarViewProps) {
  // Track which month we're viewing (separate from selected date)
  const [viewYear, setViewYear] = useState(() => {
    const parts = activeDate.split('-').map(Number);
    return parts[0];
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const parts = activeDate.split('-').map(Number);
    return parts[1] - 1; // 0-indexed
  });

  // Quick add state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddInput, setQuickAddInput] = useState('');

  const totalDays = daysInMonth(viewYear, viewMonth);
  const firstDay = firstDayOfMonth(viewYear, viewMonth);

  // Task counts by date
  const taskCountsByDate = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    tasks.forEach((t) => {
      if (!t.date) return;
      const existing = map.get(t.date) || { total: 0, completed: 0 };
      map.set(t.date, {
        total: existing.total + 1,
        completed: existing.completed + (t.completed ? 1 : 0),
      });
    });
    return map;
  }, [tasks]);

  const shiftMonth = (delta: number) => {
    const newDate = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(newDate.getFullYear());
    setViewMonth(newDate.getMonth());
  };

  // CRITICAL FIX: Use makeDateStr with LOCAL date components
  // This prevents timezone offset bugs
  const selectDate = useCallback((day: number) => {
    // Using local date constructor ensures June 27 stays June 27
    const dateStr = makeDateStr(viewYear, viewMonth, day);
    onChangeDate(dateStr);
  }, [viewYear, viewMonth, onChangeDate]);

  const isToday = (day: number): boolean => {
    const dateStr = makeDateStr(viewYear, viewMonth, day);
    return dateStr === todayStr();
  };

  const isActive = (day: number): boolean => {
    const dateStr = makeDateStr(viewYear, viewMonth, day);
    return dateStr === activeDate;
  };

  const getTaskInfo = (day: number) => {
    const dateStr = makeDateStr(viewYear, viewMonth, day);
    return taskCountsByDate.get(dateStr) || { total: 0, completed: 0 };
  };

  const handleQuickAdd = useCallback(() => {
    if (!quickAddInput.trim() || !onAddTask) return;

    onAddTask({
      title: quickAddInput.trim(),
      duration: 30,
      priority: 'Medium',
      energyLevel: energy === 'High' ? 'High Energy' : energy === 'Medium' ? 'Focus' : 'Casual',
      completed: false,
      date: activeDate, // Use the selected calendar date
    });

    setQuickAddInput('');
    setShowQuickAdd(false);
  }, [quickAddInput, onAddTask, energy, activeDate]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= totalDays; i++) cells.push(i);

  const energyAccent = energy === 'High' ? 'from-orange-500 to-orange-600' : energy === 'Medium' ? 'from-blue-500 to-blue-600' : 'from-slate-400 to-slate-500';

  // Get task info for the active date
  const activeDayTaskInfo = useMemo(() => {
    return taskCountsByDate.get(activeDate) || { total: 0, completed: 0 };
  }, [activeDate, taskCountsByDate]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-8 w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-blue-500/20 flex items-center justify-center">
          <Calendar className="w-5 h-5 text-orange-500" />
        </div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Calendar</h1>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => shiftMonth(-1)}
          className="p-3 rounded-xl glass-panel text-slate-600 dark:text-slate-300 hover:text-orange-500 hover:border-orange-500/30 transition-all touch-target hover:scale-105"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {formatMonthYear(makeDateStr(viewYear, viewMonth, 1))}
          </span>
        </div>
        <button
          onClick={() => shiftMonth(1)}
          className="p-3 rounded-xl glass-panel text-slate-600 dark:text-slate-300 hover:text-orange-500 hover:border-orange-500/30 transition-all touch-target hover:scale-105"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {weekDays.map((wd) => (
            <div key={wd} className="text-center text-xs font-bold text-slate-500 dark:text-slate-400 py-2">
              {wd}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const taskInfo = getTaskInfo(day);
            const todayCell = isToday(day);
            const activeCell = isActive(day);

            return (
              <button
                key={day}
                onClick={() => selectDate(day)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target relative ${
                  activeCell
                    ? 'bg-gradient-to-br from-orange-500/30 to-orange-400/20 text-orange-600 dark:text-orange-400 border-2 border-orange-500/40 shadow-lg shadow-orange-500/10 scale-[1.02]'
                    : todayCell
                    ? 'bg-gradient-to-br from-blue-500/15 to-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className={`text-sm font-semibold ${activeCell ? 'scale-110' : ''} transition-transform`}>
                  {day}
                </span>

                {/* Task indicator dots */}
                {taskInfo.total > 0 && (
                  <div className="flex items-center gap-0.5 absolute bottom-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      taskInfo.completed === taskInfo.total
                        ? 'bg-green-500'
                        : taskInfo.completed > 0
                        ? 'bg-orange-500'
                        : 'bg-blue-500'
                    }`} />
                    {taskInfo.total > 1 && (
                      <span className="text-[9px] text-slate-400">{taskInfo.total}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date info */}
      <div className="mt-6 glass-panel rounded-xl p-4 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${energyAccent} flex items-center justify-center shadow-lg`}>
          <Calendar className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {getDateLabel(activeDate)}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-slate-500">
              {activeDayTaskInfo.total} task{activeDayTaskInfo.total !== 1 ? 's' : ''} scheduled
            </span>
            {activeDayTaskInfo.total > 0 && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {activeDayTaskInfo.completed}/{activeDayTaskInfo.total} done
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeDate !== todayStr() && (
            <button
              onClick={() => onChangeDate(todayStr())}
              className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-100/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-orange-500/10 hover:text-orange-500 transition-all touch-target"
            >
              Today
            </button>
          )}
          {onAddTask && (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 transition-all touch-target flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && onAddTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md">
          <div className="glass-panel-strong rounded-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Add task for {getDateLabel(activeDate)}
              </h3>
              <button
                onClick={() => {
                  setShowQuickAdd(false);
                  setQuickAddInput('');
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 touch-target"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={quickAddInput}
              onChange={(e) => setQuickAddInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd();
                if (e.key === 'Escape') {
                  setShowQuickAdd(false);
                  setQuickAddInput('');
                }
              }}
              placeholder="Task title..."
              autoFocus
              className="w-full bg-slate-100/50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowQuickAdd(false);
                  setQuickAddInput('');
                }}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium glass-panel hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all touch-target"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAdd}
                disabled={!quickAddInput.trim()}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-orange-500/30 transition-all touch-target"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
