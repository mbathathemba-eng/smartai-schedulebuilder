/**
 * App.tsx
 * -------
 * Root application with gamification, progress tracking, and milestone celebrations.
 *
 * Features:
 *   - Circular progress ring (blue to orange gradient)
 *   - Confetti celebration milestone modal on 100% completion
 *   - Floating quick-capture button with NLP parsing
 *   - Glitch-free theme transitions
 *   - localStorage persistence with Supabase sync
 *   - Bulletproof state synchronization across views
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Task, ChatMessage, ViewTab, UserEnergyState } from './types';
import { todayStr, tomorrowStr, parseSmartInput, formatLocalDate } from './lib/utils';
import { useTasks, useChatMessages, useUserSettings } from './hooks/useSupabase';
import { processAiMessageAsync, AiError } from './services/aiService';

import TabNavigation from './components/TabNavigation';
import EnergySlider from './components/EnergySlider';
import TaskList from './components/TaskList';
import JeraldPanel from './components/JeraldPanel';
import CalendarView from './components/CalendarView';
import ThemeToggle from './components/ThemeToggle';
import SettingsDrawer from './components/SettingsDrawer';
import {
  Plus,
  X,
  Calendar,
  CalendarDays,
  CalendarRange,
  Inbox,
  Sparkles,
  Trophy,
  PartyPopper,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Star,
  Zap,
  User,
} from 'lucide-react';

// ------------------------------------------------------------------
// CONFETTI PARTICLES
// ------------------------------------------------------------------

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
}

function ConfettiOverlay({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const colors = ['#f97316', '#3b82f6', '#22c55e', '#fbbf24', '#ec4899', '#8b5cf6'];
    const newParticles: Particle[] = [];

    for (let i = 0; i < 60; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 8,
        speedX: (Math.random() - 0.5) * 4,
        speedY: 3 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }

    setParticles(newParticles);

    const interval = setInterval(() => {
      setParticles((prev) =>
        prev
          .map((p) => ({
            ...p,
            y: p.y + p.speedY,
            x: p.x + p.speedX,
            rotation: p.rotation + p.rotationSpeed,
            speedY: p.speedY + 0.1,
          }))
          .filter((p) => p.y < window.innerHeight + 50)
      );
    }, 16);

    return () => clearInterval(interval);
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[150] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            boxShadow: `0 0 8px ${p.color}40`,
          }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// PROGRESS RING
// ------------------------------------------------------------------

function ProgressRing({ progress, size = 140, strokeWidth = 8 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  const isComplete = progress === 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="progress-ring transform -rotate-90" width={size} height={size}>
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-slate-200/60 dark:text-slate-700/60"
        />
        {/* Progress ring with gradient */}
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          {isComplete && (
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-1000 ease-out ${isComplete ? 'animate-pulse-glow' : ''}`}
          filter={isComplete ? 'url(#glow)' : undefined}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isComplete ? (
          <>
            <Star className={`w-${size > 60 ? 6 : 4} h-${size > 60 ? 6 : 4} text-orange-500 animate-bounce`} />
            <span className={`text-${size > 60 ? 'xs' : '[8px]'} text-orange-500 font-medium mt-0.5`}>
              Done!
            </span>
          </>
        ) : (
          <>
            <span className={`text-${size > 60 ? 'xs' : '[8px]'} font-bold text-slate-800 dark:text-slate-100`}>
              {progress}%
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// MILESTONE MODAL
// ------------------------------------------------------------------

function MilestoneModal({ onClose, onDismiss }: { onClose: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-lg">
      <ConfettiOverlay active={true} />
      <div className="glass-panel-strong rounded-2xl p-6 max-w-sm w-full text-center milestone-celebration relative z-10">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 via-yellow-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/40 glow-orange animate-pulse-glow">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          All Tasks Complete!
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          You've conquered your schedule for today. Take a moment to celebrate!
        </p>
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex flex-col items-center">
            <Zap className="w-6 h-6 text-orange-500" />
            <span className="text-xs text-slate-400 mt-1">Energy</span>
          </div>
          <div className="flex flex-col items-center">
            <Star className="w-6 h-6 text-yellow-500" />
            <span className="text-xs text-slate-400 mt-1">Focus</span>
          </div>
          <div className="flex flex-col items-center">
            <PartyPopper className="w-6 h-6 text-green-500" />
            <span className="text-xs text-slate-400 mt-1">Mood</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium glass-panel hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all touch-target"
          >
            Dismiss
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] transition-all touch-target"
          >
            Start Fresh
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// QUICK CAPTURE BUTTON
// ------------------------------------------------------------------

function QuickCaptureButton({ onAddTask, energy, activeDate }: { onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void; energy: UserEnergyState; activeDate: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (!input.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    const parsed = parseSmartInput(input);
    // If the user explicitly mentions a date (today/tomorrow/Monday etc), use that
    // Otherwise, use the currently active/inspected calendar date
    const targetDate = parsed.date || activeDate;
    onAddTask({
      title: parsed.title,
      duration: 30,
      priority: 'Medium',
      energyLevel: energy === 'High' ? 'High Energy' : energy === 'Medium' ? 'Focus' : 'Casual',
      startTime: parsed.time,
      completed: false,
      date: targetDate,
    });
    setInput('');
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-20 lg:bottom-8 right-4 z-40">
      {isOpen ? (
        <div className={`glass-panel-strong rounded-2xl p-4 w-72 shadow-2xl float-button-enter ${shake ? 'animate-shake' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Quick Capture</span>
            <button
              onClick={() => setIsOpen(false)}
              className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 touch-target"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') setIsOpen(false);
            }}
            placeholder="Try: Meeting at 2pm tomorrow"
            className="w-full bg-slate-100/50 dark:bg-slate-800/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <p className="text-[10px] text-slate-400 mt-2">
            Captures to Inbox. Use "today", "tomorrow", or dates.
          </p>
          <button
            onClick={handleSubmit}
            disabled={!input.trim()}
            className="w-full mt-3 px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-orange-500/30 transition-all touch-target"
          >
            Capture
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-xl shadow-orange-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 touch-target glow-orange"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// VIEW HEADER
// ------------------------------------------------------------------

function ViewHeader({
  title,
  icon,
  tasks,
  activeDate,
  onChangeDate,
  showDateNav = false,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  activeDate?: string;
  onChangeDate?: (date: string) => void;
  showDateNav?: boolean;
}) {
  const progress = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
  }, [tasks]);

  const shiftDate = (days: number) => {
    if (!activeDate || !onChangeDate) return;
    const parts = activeDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + days);
    onChangeDate(formatLocalDate(d));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4 w-full">
      <div className="flex items-center gap-4 max-w-7xl mx-auto">
        {/* View Icon and Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-blue-500/20 flex items-center justify-center text-orange-500">
            {icon}
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h1>
        </div>

        {/* Progress Ring */}
        {tasks.length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <ProgressRing progress={progress} size={48} strokeWidth={4} />
          </div>
        )}
      </div>

      {/* Date Navigation */}
      {showDateNav && activeDate && onChangeDate && (
        <div className="flex items-center gap-2 mt-4 max-w-7xl mx-auto flex-wrap">
          <button
            onClick={() => shiftDate(-1)}
            className="p-2 rounded-xl glass-panel text-slate-600 dark:text-slate-300 hover:text-orange-500 hover:scale-105 transition-all touch-target"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-slate-700 dark:text-slate-200 touch-target">
            <CalendarClock className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">
              {activeDate === todayStr() ? 'Today' : activeDate === tomorrowStr() ? 'Tomorrow' : activeDate}
            </span>
          </button>
          <button
            onClick={() => shiftDate(1)}
            className="p-2 rounded-xl glass-panel text-slate-600 dark:text-slate-300 hover:text-orange-500 hover:scale-105 transition-all touch-target"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {activeDate !== todayStr() && (
            <button
              onClick={() => onChangeDate(todayStr())}
              className="px-3 py-2 rounded-xl text-xs font-medium text-orange-500 hover:bg-orange-500/10 active:scale-95 transition-all touch-target"
            >
              Back to Today
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// MAIN APP
// ------------------------------------------------------------------

export default function App() {
  const { tasks, loading: tasksLoading, addTask, updateTask, deleteTask } = useTasks();
  const { messages, addMessage, clearMessages } = useChatMessages();
  const { settings, loading: settingsLoading, updateSettings } = useUserSettings();

  const [activeTab, setActiveTab] = useState<ViewTab>('today');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [energy, setEnergy] = useState<UserEnergyState>('Medium');
  const [activeDate, setActiveDate] = useState<string>(todayStr());
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<AiError | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [hasShownMilestone, setHasShownMilestone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    // Initialize from localStorage or env
    return localStorage.getItem('gemini_api_key') || '';
  });

  // Sync settings from Supabase once loaded
  useEffect(() => {
    if (settings) {
      setTheme(settings.theme);
      setEnergy(settings.energyLevel);
      setActiveDate(settings.activeDate);
    }
  }, [settings]);

  // Apply theme class to <html> with transition
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    const timer = setTimeout(() => root.classList.remove('theme-transition'), 300);
    return () => clearTimeout(timer);
  }, [theme]);

  // Milestone detection - when ALL tasks for today are complete
  useEffect(() => {
    const todayTasks = tasks.filter((t) => t.date === todayStr());
    const completedToday = todayTasks.filter((t) => t.completed).length;
    if (
      todayTasks.length > 0 &&
      completedToday === todayTasks.length &&
      !hasShownMilestone
    ) {
      setShowMilestone(true);
      setHasShownMilestone(true);
    }
  }, [tasks, hasShownMilestone]);

  const handleThemeToggle = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    await updateSettings({ theme: next });
  }, [theme, updateSettings]);

  const handleEnergyChange = useCallback(async (next: UserEnergyState) => {
    setEnergy(next);
    await updateSettings({ energyLevel: next });
  }, [updateSettings]);

  const handleDateChange = useCallback(async (date: string) => {
    setActiveDate(date);
    await updateSettings({ activeDate: date });
  }, [updateSettings]);

  const handleSaveGeminiKey = useCallback((key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setGeminiApiKey(key);
    // Note: The API key change will take effect on next page load
    // when the ENV object is re-initialized
  }, []);

  const handleAddTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>) => {
    await addTask(task);
  }, [addTask]);

  const handleUpdateTask = useCallback(async (task: Task) => {
    await updateTask(task);
  }, [updateTask]);

  const handleDeleteTask = useCallback(async (id: string) => {
    await deleteTask(id);
  }, [deleteTask]);

  const sendChatMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setChatError(null);

    const userMsg: Omit<ChatMessage, 'id' | 'timestamp'> = {
      role: 'user',
      content: text.trim(),
      tasks: undefined,
    };
    await addMessage(userMsg);
    setChatInput('');
    setIsTyping(true);

    const result = await processAiMessageAsync(text.trim(), tasks, energy);
    setIsTyping(false);

    if (!result.ok) {
      setChatError(result.error);
      return;
    }

    // Handle energy state change detected from user text
    if (result.data.energyStateChange) {
      setEnergy(result.data.energyStateChange);
      await updateSettings({ energyLevel: result.data.energyStateChange });
    }

    const assistantMsg: Omit<ChatMessage, 'id' | 'timestamp'> = {
      role: 'assistant',
      content: result.data.reply,
      tasks: result.data.tasks,
    };
    await addMessage(assistantMsg);
    // Pure state injection: map agent tasks directly into global state with zero alteration.
    // Gemini has already computed the date, sanitized the title, and set the time.
    if (result.data.tasks.length > 0) {
      for (const t of result.data.tasks) {
        await addTask({
          title: t.title,
          duration: t.duration,
          priority: t.priority,
          energyLevel: t.energyLevel,
          startTime: t.startTime,
          completed: false,
          date: t.date,
          projectId: t.projectId,
        });
      }
    }
  }, [tasks, energy, addMessage, addTask, activeDate, updateSettings]);

  // Filter tasks by date - CRITICAL: strict filtering
  const tomorrow = tomorrowStr();

  // Today: exactly matches active date (defaults to today)
  const activeDateTasks = useMemo(() => tasks.filter((t) => t.date === activeDate), [tasks, activeDate]);

  // Tomorrow: exactly matches tomorrow's date
  const tomorrowTasks = useMemo(() => tasks.filter((t) => t.date === tomorrow), [tasks, tomorrow]);

  // Upcoming: strictly AFTER tomorrow (tomorrow's tasks must NOT leak)
  const upcomingTasks = useMemo(() => tasks.filter((t) => {
    if (!t.date || t.date === '') return false;
    return t.date > tomorrow;
  }), [tasks, tomorrow]);

  // Inbox: tasks with NO date (null, empty, or undefined)
  const inboxTasks = useMemo(() => tasks.filter((t) => !t.date || t.date === ''), [tasks]);

  // Overall progress for main ring
  const overallProgress = useMemo(() => {
    const incomplete = tasks.filter((t) => !t.completed).length;
    if (tasks.length === 0) return 0;
    return Math.round(((tasks.length - incomplete) / tasks.length) * 100);
  }, [tasks]);

  // Loading state
  if (tasksLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-3 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-orange-500" />
            </div>
          </div>
          <p className="text-sm text-slate-400">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (activeTab) {
      case 'today':
        return (
          <div className="flex flex-col h-full w-full">
            <ViewHeader
              title="Today"
              icon={<Calendar className="w-5 h-5" />}
              tasks={activeDateTasks}
              activeDate={activeDate}
              onChangeDate={handleDateChange}
              showDateNav
            />
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
              <div className="max-w-7xl mx-auto">
                <TaskList
                  tasks={activeDateTasks}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  energy={energy}
                />
              </div>
            </div>
          </div>
        );

      case 'tomorrow':
        return (
          <div className="flex flex-col h-full w-full">
            <ViewHeader title="Tomorrow" icon={<CalendarDays className="w-5 h-5" />} tasks={tomorrowTasks} />
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
              <div className="max-w-7xl mx-auto">
                <TaskList
                  tasks={tomorrowTasks}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  energy={energy}
                />
              </div>
            </div>
          </div>
        );

      case 'upcoming':
        return (
          <div className="flex flex-col h-full w-full">
            <ViewHeader title="Upcoming" icon={<CalendarRange className="w-5 h-5" />} tasks={upcomingTasks} />
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
              <div className="max-w-7xl mx-auto">
                <TaskList
                  tasks={upcomingTasks}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  energy={energy}
                  showDate
                />
              </div>
            </div>
          </div>
        );

      case 'inbox':
        return (
          <div className="flex flex-col h-full w-full">
            <ViewHeader title="Inbox" icon={<Inbox className="w-5 h-5" />} tasks={inboxTasks} />
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
              <div className="max-w-7xl mx-auto">
                <TaskList
                  tasks={inboxTasks}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  energy={energy}
                />
              </div>
            </div>
          </div>
        );

      case 'jerald':
        return (
          <JeraldPanel
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            isTyping={isTyping}
            error={chatError}
            onSend={sendChatMessage}
            onClearChat={clearMessages}
            energy={energy}
          />
        );

      case 'calendar':
        return (
          <CalendarView
            tasks={tasks}
            activeDate={activeDate}
            onChangeDate={handleDateChange}
            energy={energy}
            onAddTask={handleAddTask}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop layout */}
      <div className="hidden lg:flex flex-1 overflow-hidden w-full">
        <TabNavigation activeTab={activeTab} onChangeTab={setActiveTab} variant="desktop" />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top bar with theme, energy, and main progress */}
          <header className="h-14 border-b border-slate-200/30 dark:border-slate-700/30 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4">
              <ProgressRing progress={overallProgress} size={40} strokeWidth={3} />
              <span className="text-xs text-slate-500">{overallProgress}% done</span>
            </div>
            <div className="flex items-center gap-4">
              <EnergySlider value={energy} onChange={handleEnergyChange} compact />
              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-xl glass-panel transition-all hover:scale-105 active:scale-95 touch-target"
                aria-label="Open settings"
              >
                <User className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>
              <ThemeToggle theme={theme} onToggle={handleThemeToggle} />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="h-full w-full"
              >
                {renderView()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex lg:hidden flex-1 overflow-hidden flex-col w-full">
        <header className="h-12 border-b border-slate-200/30 dark:border-slate-700/30 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <ProgressRing progress={overallProgress} size={32} strokeWidth={3} />
          </div>
          <div className="flex items-center gap-2">
            <EnergySlider value={energy} onChange={handleEnergyChange} compact />
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl glass-panel transition-all hover:scale-105 active:scale-95 touch-target"
              aria-label="Open settings"
            >
              <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            <ThemeToggle theme={theme} onToggle={handleThemeToggle} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-20 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="h-full w-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
        <TabNavigation activeTab={activeTab} onChangeTab={setActiveTab} variant="mobile" />
      </div>

      {/* Floating quick capture */}
      <QuickCaptureButton onAddTask={handleAddTask} energy={energy} activeDate={activeDate} />

      {/* Milestone modal with confetti */}
      {showMilestone && (
        <MilestoneModal
          onClose={() => setShowMilestone(false)}
          onDismiss={() => setShowMilestone(false)}
        />
      )}

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        geminiApiKey={geminiApiKey}
        onSaveGeminiKey={handleSaveGeminiKey}
      />
    </div>
  );
}
