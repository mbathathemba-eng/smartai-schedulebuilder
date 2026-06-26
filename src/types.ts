/**
 * Core type definitions for the Smart AI Schedule Builder.
 */

/** Task priority levels, ordered from most to least urgent. */
export type Priority = 'High' | 'Medium' | 'Low';

/** Energy level tags used by the auto-scheduler to place tasks at optimal times. */
export type EnergyLevel = 'High Energy' | 'Focus' | 'Casual';

/** Navigation tabs available in the bottom/tab bar. */
export type ViewTab = 'today' | 'tomorrow' | 'upcoming' | 'inbox' | 'jerald' | 'calendar';

/** Represents a single scheduled or unscheduled task. */
export interface Task {
  id: string;
  title: string;
  duration: number; // minutes
  priority: Priority;
  energyLevel: EnergyLevel;
  startTime?: number; // minutes from midnight
  completed: boolean;
  createdAt: number;
  date: string; // ISO date YYYY-MM-DD
  projectId?: string;
}

/** A user-defined project bucket for grouping tasks. */
export interface Project {
  id: string;
  name: string;
  color: string;
}

/** A single message in the Jerald chat thread. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tasks?: Task[];
}

/** User's current energy level state for conditional Jerald coaching. */
export type UserEnergyState = 'High' | 'Medium' | 'Low';
