/**
 * useSupabase.ts
 * --------------
 * Typed React hooks for Supabase CRUD with localStorage persistence.
 *
 * Features:
 *   - Instant localStorage hydration for fast initial load
 *   - Background Supabase sync for persistence
 *   - Optimistic updates with rollback on error
 *   - Automatic state restoration on app boot
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Task, ChatMessage, UserEnergyState } from '../types';
import { todayStr } from '../lib/utils';

// ------------------------------------------------------------------
// LOCAL STORAGE KEYS
// ------------------------------------------------------------------

const STORAGE_KEYS = {
  TASKS: 'smartai_tasks',
  SETTINGS: 'smartai_settings',
  MESSAGES: 'smartai_messages',
};

// ------------------------------------------------------------------
// LOCAL STORAGE HELPERS
// ------------------------------------------------------------------

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved) as T;
    }
  } catch {
    // Invalid JSON or storage error
  }
  return fallback;
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

// ------------------------------------------------------------------
// TASKS
// ------------------------------------------------------------------

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() =>
    loadFromStorage<Task[]>(STORAGE_KEYS.TASKS, [])
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  // Save to localStorage whenever tasks change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TASKS, tasks);
  }, [tasks]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      const mapped = (data || []).map((row) => ({
        id: row.id,
        title: row.title,
        duration: row.duration,
        priority: row.priority,
        energyLevel: row.energy_level,
        startTime: row.start_time ?? undefined,
        completed: row.completed,
        date: row.date,
        projectId: row.project_id ?? undefined,
        createdAt: new Date(row.created_at).getTime(),
      }));
      setTasks(mapped);
      setSynced(true);
    }
    setLoading(false);
  }, []);

  // Initial fetch from Supabase (background sync)
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(async (task: Omit<Task, 'id' | 'createdAt'>) => {
    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const tempTask: Task = {
      ...task,
      id: tempId,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, tempTask]);

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: task.title,
        duration: task.duration,
        priority: task.priority,
        energy_level: task.energyLevel,
        start_time: task.startTime ?? null,
        completed: task.completed,
        date: task.date,
        project_id: task.projectId ?? null,
      })
      .select()
      .single();

    if (error) {
      // Rollback optimistic update
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      throw error;
    }

    // Replace temp task with real one
    const newTask: Task = {
      id: data.id,
      title: data.title,
      duration: data.duration,
      priority: data.priority,
      energyLevel: data.energy_level,
      startTime: data.start_time ?? undefined,
      completed: data.completed,
      date: data.date,
      projectId: data.project_id ?? undefined,
      createdAt: new Date(data.created_at).getTime(),
    };
    setTasks((prev) => prev.map((t) => (t.id === tempId ? newTask : t)));
    return newTask;
  }, []);

  const updateTask = useCallback(async (task: Task) => {
    // Optimistic update
    const previousTask = tasks.find((t) => t.id === task.id);
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));

    const { error } = await supabase
      .from('tasks')
      .update({
        title: task.title,
        duration: task.duration,
        priority: task.priority,
        energy_level: task.energyLevel,
        start_time: task.startTime ?? null,
        completed: task.completed,
        date: task.date,
        project_id: task.projectId ?? null,
      })
      .eq('id', task.id);

    if (error) {
      // Rollback
      if (previousTask) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? previousTask : t)));
      }
      throw error;
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id: string) => {
    // Optimistic delete
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));

    const { error } = await supabase.from('tasks').delete().eq('id', id);

    if (error) {
      // Rollback
      setTasks(previousTasks);
      throw error;
    }
  }, [tasks]);

  return { tasks, loading, error, synced, addTask, updateTask, deleteTask, refresh: fetchTasks };
}

// ------------------------------------------------------------------
// CHAT MESSAGES
// ------------------------------------------------------------------

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadFromStorage<ChatMessage[]>(STORAGE_KEYS.MESSAGES, [])
  );
  const [loading, setLoading] = useState(true);

  // Save to localStorage whenever messages change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MESSAGES, messages);
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('timestamp', { ascending: true });

    if (!error && data) {
      setMessages(
        data.map((row) => ({
          id: row.id,
          role: row.role as 'user' | 'assistant',
          content: row.content,
          timestamp: new Date(row.timestamp).getTime(),
          tasks: (row.tasks as Task[] | null) ?? undefined,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const addMessage = useCallback(async (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    // Optimistic add
    const tempId = `temp_msg_${Date.now()}`;
    const tempMsg: ChatMessage = {
      ...msg,
      id: tempId,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        role: msg.role,
        content: msg.content,
        tasks: msg.tasks ?? null,
      })
      .select()
      .single();

    if (error) {
      // Rollback
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw error;
    }

    const newMsg: ChatMessage = {
      id: data.id,
      role: data.role as 'user' | 'assistant',
      content: data.content,
      timestamp: new Date(data.timestamp).getTime(),
      tasks: (data.tasks as Task[] | null) ?? undefined,
    };

    // Replace temp message with real one
    setMessages((prev) => prev.map((m) => (m.id === tempId ? newMsg : m)));
    return newMsg;
  }, []);

  return { messages, loading, addMessage, refresh: fetchMessages };
}

// ------------------------------------------------------------------
// USER SETTINGS
// ------------------------------------------------------------------

interface UserSettings {
  id: string;
  theme: 'light' | 'dark';
  energyLevel: UserEnergyState;
  activeDate: string;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'id'> = {
  theme: 'dark',
  energyLevel: 'Medium',
  activeDate: todayStr(),
};

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(() => {
    const saved = loadFromStorage<Partial<UserSettings>>(STORAGE_KEYS.SETTINGS, {});
    if (saved.id) {
      return {
        id: saved.id,
        theme: saved.theme || DEFAULT_SETTINGS.theme,
        energyLevel: saved.energyLevel || DEFAULT_SETTINGS.energyLevel,
        activeDate: saved.activeDate || DEFAULT_SETTINGS.activeDate,
      };
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Save to localStorage whenever settings change
  useEffect(() => {
    if (settings) {
      saveToStorage(STORAGE_KEYS.SETTINGS, settings);
    }
  }, [settings]);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .maybeSingle();

    if (!error && data) {
      setSettings({
        id: data.id,
        theme: data.theme,
        energyLevel: data.energy_level as UserEnergyState,
        activeDate: data.active_date,
      });
    } else if (!data) {
      // Seed default settings row (locally and in Supabase)
      const defaultSettings = {
        theme: DEFAULT_SETTINGS.theme,
        energy_level: DEFAULT_SETTINGS.energyLevel,
        active_date: DEFAULT_SETTINGS.activeDate,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('user_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (!insertErr && inserted) {
        setSettings({
          id: inserted.id,
          theme: inserted.theme,
          energyLevel: inserted.energy_level as UserEnergyState,
          activeDate: inserted.active_date,
        });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (partial: Partial<{ theme: 'light' | 'dark'; energyLevel: UserEnergyState; activeDate: string }>) => {
      if (!settings) return;

      // Optimistic update
      const previousSettings = { ...settings };
      setSettings((prev) => (prev ? { ...prev, ...partial } : prev));

      const payload: Record<string, unknown> = {};
      if (partial.theme !== undefined) payload.theme = partial.theme;
      if (partial.energyLevel !== undefined) payload.energy_level = partial.energyLevel;
      if (partial.activeDate !== undefined) payload.active_date = partial.activeDate;
      payload.updated_at = new Date().toISOString();

      const { error } = await supabase.from('user_settings').update(payload).eq('id', settings.id);

      if (error) {
        // Rollback
        setSettings(previousSettings);
        throw error;
      }
    },
    [settings]
  );

  return { settings, loading, updateSettings, refresh: fetchSettings };
}
