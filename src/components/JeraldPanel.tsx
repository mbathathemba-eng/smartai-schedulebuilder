/**
 * JeraldPanel.tsx
 * ---------------
 * Interactive AI coaching panel for conversations with Jerald.
 * Features message thread, quick prompt chips, typing indicator, and energy context.
 */

import { useRef, useEffect, useState } from 'react';
import { ChatMessage, UserEnergyState } from '../types';
import { AiError } from '../services/aiService';
import {
  Send,
  Sparkles,
  User,
  Bot,
  Wand2,
  Calendar,
  Coffee,
  Zap,
  AlertCircle,
  X,
  Sun,
  CloudSun,
  Moon,
  Clock,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface JeraldPanelProps {
  messages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  isTyping: boolean;
  error: AiError | null;
  onSend: (text: string) => void;
  onClearChat: () => void;
  energy: UserEnergyState;
}

const PROMPT_CHIPS = [
  { label: 'Optimize my day', icon: <Wand2 className="w-3.5 h-3.5" />, energy: 'High' },
  { label: 'Group by energy', icon: <Zap className="w-3.5 h-3.5" />, energy: 'Medium' },
  { label: 'Add a break', icon: <Coffee className="w-3.5 h-3.5" />, energy: 'Low' },
  { label: 'Morning routine', icon: <Calendar className="w-3.5 h-3.5" />, energy: 'High' },
];

const ENERGY_CONTEXT = {
  High: "You're feeling energized! Great time for challenging tasks.",
  Medium: "Steady energy. Perfect for focus work.",
  Low: "Taking it easy. Let's keep it simple.",
};

export default function JeraldPanel({
  messages,
  chatInput,
  setChatInput,
  isTyping,
  error,
  onSend,
  onClearChat,
  energy,
}: JeraldPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, error]);

  const errorLabel = (err: AiError): string => {
    switch (err.code) {
      case 'UNAUTHORIZED': return 'Invalid API key. Check your .env configuration.';
      case 'RATE_LIMIT': return 'Rate limit hit. Please wait and retry.';
      case 'SERVER_ERROR': return 'Provider server error. Try again shortly.';
      case 'NETWORK_ERROR': return 'Network error. Check your connection.';
      default: return err.message;
    }
  };

  const energyIcon = () => {
    switch (energy) {
      case 'High': return <Sun className="w-5 h-5 text-orange-400" />;
      case 'Medium': return <CloudSun className="w-5 h-5 text-blue-400" />;
      case 'Low': return <Moon className="w-5 h-5 text-indigo-400" />;
    }
  };

  const energyBg = energy === 'High' ? 'bg-orange-500/20' : energy === 'Medium' ? 'bg-blue-500/20' : 'bg-slate-500/20';
  const energyText = energy === 'High' ? 'text-orange-400' : energy === 'Medium' ? 'text-blue-400' : 'text-slate-400';
  const energyBorder = energy === 'High' ? 'border-orange-500/30' : energy === 'Medium' ? 'border-blue-500/30' : 'border-slate-500/30';

  const handleSend = () => {
    if (!chatInput.trim()) return;
    onSend(chatInput);
    setShowQuickActions(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200/30 dark:border-slate-700/30 glass-panel-strong">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${energyBg} ${energyBorder} border`}>
            <Bot className={`w-5 h-5 ${energyText}`} />
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Jerald</span>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              {energyIcon()}
              <span>{energy} Energy</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`${energyBg} ${energyBorder} border rounded-lg px-2 py-1`}>
            <span className={`text-[10px] font-medium ${energyText}`}>{ENERGY_CONTEXT[energy]}</span>
          </div>
          {confirmClear ? (
            <div className="flex items-center gap-1 animate-fadeIn">
              <button
                onClick={() => {
                  onClearChat();
                  setShowQuickActions(true);
                  setConfirmClear(false);
                }}
                className="p-2 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors touch-target"
                aria-label="Confirm clear chat"
                title="Confirm clear"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-500/10 transition-colors touch-target"
                aria-label="Cancel clear chat"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={messages.length === 0}
              className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-500/10 transition-colors touch-target disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
              aria-label="Clear chat"
              title="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="mx-4 mt-4 rounded-xl border px-4 py-3 flex items-start gap-3 bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium">{errorLabel(error)}</p>
            {error.status && <p className="text-[10px] opacity-70 mt-0.5">Status: {error.status}</p>}
          </div>
          <button className="p-1 rounded hover:bg-red-500/20 transition-colors touch-target">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick action chips */}
      {showQuickActions && messages.length === 0 && (
        <div className="px-4 pt-4 pb-2 flex flex-wrap gap-2">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => {
                onSend(chip.label);
                setShowQuickActions(false);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 hover-lift glass-panel hover:border-orange-500/30 hover:shadow-orange-500/5 touch-target"
            >
              {chip.icon}
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !showQuickActions && (
          <div className="text-center py-12">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${energyBg} ${energyBorder} border`}>
              <Sparkles className={`w-7 h-7 ${energyText}`} />
            </div>
            <p className="text-sm font-medium mb-1 text-slate-700 dark:text-slate-200">Ask Jerald</p>
            <p className="text-xs text-slate-400">Get help optimizing your schedule</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20'
                  : `${energyBg} ${energyText} ${energyBorder} border`
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'glass-panel-strong text-slate-800 dark:text-slate-100'
                  : 'glass-panel text-slate-700 dark:text-slate-200'
              }`}
            >
              {msg.content.split('\n').map((line, i) => (
                <p key={i} className={line.startsWith('**') ? 'font-semibold mt-2 mb-1' : ''}>
                  {line.replace(/\*\*/g, '')}
                </p>
              ))}
              {msg.tasks && msg.tasks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className={`w-4 h-4 ${energyText}`} />
                    <span className={`text-[11px] font-semibold uppercase tracking-wider ${energyText}`}>
                      Added {msg.tasks.length} task{msg.tasks.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {msg.tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{t.title}</span>
                        {t.startTime !== undefined && (
                          <span className="text-[10px] text-slate-400">
                            ({Math.floor(t.startTime / 60)}:{String(t.startTime % 60).padStart(2, '0')})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[10px] text-slate-400 mt-2">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${energyBg} ${energyText} ${energyBorder} border`}>
              <Bot className="w-4 h-4" />
            </div>
            <div className="glass-panel rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" />
                <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" />
                <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200/30 dark:border-slate-700/30 glass-panel-strong">
        <div className="flex items-center gap-3 rounded-xl glass-panel px-4 py-3 focus-within:ring-2 focus-within:ring-orange-500/30 transition-all">
          <input
            ref={inputRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Jerald..."
            className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          <button
            onClick={handleSend}
            disabled={!chatInput.trim() || isTyping}
            className={`p-2 rounded-lg transition-all duration-200 touch-target ${
              chatInput.trim() && !isTyping
                ? `${energyBg} ${energyText} hover:scale-105`
                : 'text-slate-300 dark:text-slate-600'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
