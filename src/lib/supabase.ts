/**
 * Supabase Client Singleton
 * -------------------------
 * Single shared Supabase client instance for the entire app.
 * Reads credentials from Vite env vars.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Tables = {
  tasks: {
    id: string;
    title: string;
    duration: number;
    priority: 'High' | 'Medium' | 'Low';
    energy_level: 'High Energy' | 'Focus' | 'Casual';
    start_time: number | null;
    completed: boolean;
    date: string;
    project_id: string | null;
    created_at: string;
  };
  chat_messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    tasks: unknown[] | null;
  };
  user_settings: {
    id: string;
    theme: 'light' | 'dark';
    energy_level: 'High' | 'Medium' | 'Low';
    active_date: string;
    created_at: string;
    updated_at: string;
  };
};
