/**
 * TaskList.tsx
 * ------------
 * Chronologically sorted task list with inline time editing and validation.
 *
 * Features:
 *   - Glassmorphism card styling
 *   - Completion animations with progress tracking
 *   - Inline time editing with automatic re-sort
 *   - Interactive duration selector with glassmorphic dropdown
 *   - Validation with shake animation for duplicate/empty inputs
 *   - Energy-aware color coding
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Task, UserEnergyState } from '../types';
import { formatTime, formatTime24, validateTaskTitle } from '../lib/utils';
import {
  CheckCircle2,
  Circle,
  Clock,
  Zap,
  Brain,
  Coffee,
  Trash2,
  Calendar,
  GripVertical,
  AlertCircle,
  ChevronDown,
  Timer,
} from 'lucide-react';

// ------------------------------------------------------------------
// DURATION SELECTOR COMPONENT
// ------------------------------------------------------------------

const DURATION_OPTIONS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h', value: 60 },
  { label: '2h', value: 120 },
];

function DurationSelector({
  duration,
  onChange,
}: {
  duration: number;
  onChange: (newDuration: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const formatDuration = (mins: number): string => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const minsRemaining = mins % 60;
    return minsRemaining > 0 ? `${hours}h ${minsRemaining}m` : `${hours}h`;
  };

  const handleSelect = (value: number) => {
    if (value !== duration) {
      onChange(value);
    }
    setIsOpen(false);
  };

  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 transition-all touch-target"
      >
        <Timer className="w-3 h-3" />
        <span>{formatDuration(duration)}</span>
        <ChevronDown className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && dropdownPosition && (
        <div
          className="fixed z-[100] glass-panel-strong rounded-xl p-1 min-w-[80px] shadow-xl animate-fadeIn"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
        >
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(opt.value);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                duration === opt.value
                  ? 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-orange-500/10 hover:text-orange-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// TASK LIST
// ------------------------------------------------------------------

interface TaskListProps {
  tasks: Task[];
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (id: string) => void;
  energy: UserEnergyState;
  showDate?: boolean;
  onTimeChanged?: () => void;
}

// Shake animation component
function ShakeWrapper({ children, shake }: { children: React.ReactNode; shake: boolean }) {
  return (
    <div
      className={shake ? 'animate-shake' : ''}
      style={{
        animation: shake ? 'shake 0.4s ease-in-out' : undefined,
      }}
    >
      {children}
    </div>
  );
}

export default function TaskList({
  tasks,
  onUpdateTask,
  onDeleteTask,
  energy: _energy,
  showDate = false,
  onTimeChanged,
}: TaskListProps) {
  const [editingTimeTaskId, setEditingTimeTaskId] = useState<string | null>(null);
  const [editTimeValue, setEditTimeValue] = useState('');
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [shakeTaskId, setShakeTaskId] = useState<string | null>(null);
  const [editTitleTaskId, setEditTitleTaskId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');

  // Sort tasks: uncompleted first, then by time, then by creation date
  const sortedTasks = useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.startTime !== undefined && b.startTime !== undefined) return a.startTime - b.startTime;
      if (a.startTime !== undefined) return -1;
      if (b.startTime !== undefined) return 1;
      return b.createdAt - a.createdAt;
    });
    return arr;
  }, [tasks]);

  // Get existing task titles for validation (excluding current task)
  const existingTitles = useMemo(
    () => tasks.map((t) => t.title),
    [tasks]
  );

  // Trigger shake animation
  const triggerShake = useCallback((taskId: string) => {
    setShakeTaskId(taskId);
    setTimeout(() => setShakeTaskId(null), 400);
  }, []);

  const handleToggleComplete = useCallback((task: Task) => {
    if (task.completed) {
      onUpdateTask({ ...task, completed: false });
    } else {
      // Fire optimistic update immediately so progress ring increments instantly.
      // The CSS transition on the task card handles the visual fade.
      setCompletingTaskId(task.id);
      onUpdateTask({ ...task, completed: true });
      setTimeout(() => setCompletingTaskId(null), 400);
    }
  }, [onUpdateTask]);

  const handleStartTimeEdit = useCallback((task: Task) => {
    if (task.startTime === undefined) return;
    setEditingTimeTaskId(task.id);
    setEditTimeValue(formatTime24(task.startTime));
  }, []);

  const handleSaveTime = useCallback((task: Task) => {
    if (!editTimeValue) {
      setEditingTimeTaskId(null);
      return;
    }

    const [h, m] = editTimeValue.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      triggerShake(task.id);
      return;
    }

    const newStart = h * 60 + m;

    // Check for duplicate time on same date
    const duplicateTime = tasks.find(
      (t) => t.id !== task.id && t.date === task.date && t.startTime === newStart
    );

    if (duplicateTime) {
      triggerShake(task.id);
      return;
    }

    onUpdateTask({ ...task, startTime: newStart });
    setEditingTimeTaskId(null);
    setEditTimeValue('');
    onTimeChanged?.();
  }, [editTimeValue, tasks, onUpdateTask, triggerShake, onTimeChanged]);

  const handleEditTitle = useCallback((task: Task) => {
    setEditTitleTaskId(task.id);
    setEditTitleValue(task.title);
  }, []);

  const handleSaveTitle = useCallback((task: Task) => {
    const trimmedTitle = editTitleValue.trim();

    // Validate title
    const error = validateTaskTitle(trimmedTitle, existingTitles.filter((t) => t !== task.title));
    if (error) {
      triggerShake(task.id);
      return;
    }

    if (trimmedTitle && trimmedTitle !== task.title) {
      onUpdateTask({ ...task, title: trimmedTitle });
    }

    setEditTitleTaskId(null);
    setEditTitleValue('');
  }, [editTitleValue, existingTitles, onUpdateTask, triggerShake]);

  const getEnergyIcon = (level: Task['energyLevel']) => {
    switch (level) {
      case 'High Energy': return <Zap className="w-3 h-3" />;
      case 'Focus': return <Brain className="w-3 h-3" />;
      default: return <Coffee className="w-3 h-3" />;
    }
  };

  const getEnergyColor = (level: Task['energyLevel']) => {
    switch (level) {
      case 'High Energy': return 'text-orange-500 bg-orange-500/10';
      case 'Focus': return 'text-blue-500 bg-blue-500/10';
      default: return 'text-slate-400 bg-slate-400/10';
    }
  };

  const getPriorityStyle = (priority: Task['priority']) => {
    switch (priority) {
      case 'High':
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'Medium':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-slate-200/40 text-slate-500 dark:bg-slate-700/30 dark:text-slate-400 border-slate-400/20';
    }
  };

  if (sortedTasks.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/10 to-blue-500/10 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-10 h-10 text-slate-300 dark:text-slate-600" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">All caught up!</p>
        <p className="text-xs mt-1 text-slate-400">Add a task to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>

      {sortedTasks.map((task) => {
        const isCompleting = completingTaskId === task.id;
        const isEditingTime = editingTimeTaskId === task.id;
        const isEditingTitle = editTitleTaskId === task.id;
        const shouldShake = shakeTaskId === task.id;
        const hasError = shakeTaskId === task.id;

        return (
          <ShakeWrapper key={task.id} shake={shouldShake}>
            <div
              className={`group flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-300 hover:scale-[1.01] ${
                task.completed
                  ? 'opacity-40'
                  : 'glass-panel hover:shadow-orange-500/5 dark:hover:shadow-orange-500/10'
              } ${isCompleting ? 'opacity-10 translate-x-4' : ''} ${hasError ? 'ring-2 ring-red-500/50' : ''}`}
            >
              {/* Drag handle (visual only) */}
              <div className="opacity-0 group-hover:opacity-30 transition-opacity pt-1 text-slate-300 cursor-grab">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* Checkbox */}
              <button
                onClick={() => handleToggleComplete(task)}
                className={`mt-0.5 shrink-0 transition-all duration-200 touch-target p-0.5 rounded-full ${
                  task.completed
                    ? 'text-orange-500 scale-110'
                    : 'text-slate-400 hover:text-orange-500 hover:scale-105'
                }`}
                aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
              >
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>

              {/* Task body */}
              <div className="flex-1 min-w-0">
                {/* Title - editable on click */}
                {isEditingTitle ? (
                  <input
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={() => handleSaveTitle(task)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(task);
                      if (e.key === 'Escape') {
                        setEditTitleTaskId(null);
                        setEditTitleValue('');
                      }
                    }}
                    autoFocus
                    className="w-full text-sm bg-transparent outline-none border-b border-orange-500/40 focus:border-orange-500 text-slate-800 dark:text-slate-100"
                  />
                ) : (
                  <button
                    onClick={() => handleEditTitle(task)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleEditTitle(task);
                    }}
                    className={`text-sm text-left w-full transition-all ${
                      task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100 hover:text-orange-600 dark:hover:text-orange-400'
                    }`}
                    title="Click or double-click to edit"
                  >
                    {task.title}
                  </button>
                )}

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Editable time */}
                  {task.startTime !== undefined && (
                    <>
                      {isEditingTime ? (
                        <input
                          type="time"
                          value={editTimeValue}
                          onChange={(e) => setEditTimeValue(e.target.value)}
                          onBlur={() => handleSaveTime(task)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTime(task);
                            if (e.key === 'Escape') setEditingTimeTaskId(null);
                          }}
                          autoFocus
                          className="text-[11px] px-2 py-1 rounded-lg border outline-none focus:ring-2 focus:ring-orange-500/40 bg-white/80 dark:bg-slate-800/80 border-orange-500/40 text-slate-800 dark:text-slate-100"
                        />
                      ) : (
                        <button
                          onClick={() => handleStartTimeEdit(task)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-slate-500 hover:text-orange-500 hover:bg-orange-500/10 transition-all touch-target"
                        >
                          <Clock className="w-3 h-3" />
                          {formatTime(task.startTime)}
                        </button>
                      )}
                    </>
                  )}

                  {/* Energy badge */}
                  <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${getEnergyColor(task.energyLevel)}`}>
                    {getEnergyIcon(task.energyLevel)}
                    {task.energyLevel}
                  </span>

                  {/* Priority pill */}
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${getPriorityStyle(task.priority)}`}
                  >
                    {task.priority}
                  </span>

                  {/* Date label */}
                  {showDate && (
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {task.date}
                    </span>
                  )}

                  {/* Duration Selector */}
                  <DurationSelector
                    duration={task.duration || 30}
                    onChange={(newDuration) => onUpdateTask({ ...task, duration: newDuration })}
                  />
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={() => onDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-60 p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all touch-target"
                aria-label="Delete task"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Error indicator */}
              {hasError && (
                <div className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500 text-white">
                  <AlertCircle className="w-3 h-3" />
                </div>
              )}
            </div>
          </ShakeWrapper>
        );
      })}
    </div>
  );
}
