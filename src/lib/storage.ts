/**
 * Persistence layer using localStorage.
 * All CRUD operations for tasks, projects, and chat history are centralized here
 * so swapping to Supabase later only requires changing this file.
 */

import { Task, Project, ChatMessage } from '../types';

const TASKS_KEY = 'smartai-tasks';
const PROJECTS_KEY = 'smartai-projects';
const CHAT_KEY = 'smartai-chat';

/** Load tasks from localStorage. Returns empty array on failure. */
export function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist the full task array to localStorage. */
export function saveTasks(tasks: Task[]) {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // storage quota exceeded or private mode
  }
}

/** Load projects from localStorage. Falls back to default projects. */
export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return defaultProjects();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : defaultProjects();
  } catch {
    return defaultProjects();
  }
}

/** Persist projects to localStorage. */
export function saveProjects(projects: Project[]) {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // ignore
  }
}

/** Load chat history from localStorage. */
export function loadChat(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist chat history to localStorage. */
export function saveChat(messages: ChatMessage[]) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  } catch {
    // ignore
  }
}

/** Default seed projects when no stored data exists. */
function defaultProjects(): Project[] {
  return [
    { id: 'proj-work', name: 'Work', color: '#de4c4a' },
    { id: 'proj-personal', name: 'Personal', color: '#4c6ef5' },
    { id: 'proj-health', name: 'Health', color: '#40c057' },
  ];
}
