/**
 * utils.ts
 * --------
 * Shared utility functions for ID generation, date formatting, time parsing,
 * and natural-language input processing.
 *
 * IMPORTANT: All date functions use local calendar boundaries, NOT UTC.
 * This prevents timezone offset bugs where clicking June 27 opens June 26.
 */

// ------------------------------------------------------------------
// ID GENERATION
// ------------------------------------------------------------------

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ------------------------------------------------------------------
// DATE FORMATTING (LOCAL TIMEZONE SAFE)
// ------------------------------------------------------------------

/**
 * Returns today's date in YYYY-MM-DD format using LOCAL time.
 * Never uses toISOString() which would cause timezone shifts.
 */
export function todayStr(): string {
  return formatLocalDate(new Date());
}

/**
 * Returns tomorrow's date in YYYY-MM-DD format using LOCAL time.
 */
export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
}

/**
 * Formats a Date object to YYYY-MM-DD using LOCAL calendar boundaries.
 * Uses 'en-CA' locale which outputs YYYY-MM-DD naturally.
 */
export function formatLocalDate(d: Date): string {
  return d.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD in local timezone
}

/**
 * Creates a date string from year, month (0-indexed), and day components.
 * Guarantees the result matches the exact calendar day clicked.
 */
export function makeDateStr(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  return formatLocalDate(d);
}

export function getDateLabel(isoDate: string): string {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  if (isoDate === today) return 'Today';
  if (isoDate === tomorrow) return 'Tomorrow';

  const parts = isoDate.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatMonthYear(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ------------------------------------------------------------------
// TIME FORMATTING
// ------------------------------------------------------------------

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function formatTime24(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function parseTimeStr(timeStr: string): number | undefined {
  // Handle "H:MM am/pm" format
  const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (colonMatch) {
    let h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const period = colonMatch[3]?.toLowerCase();
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  // Handle "H am/pm" format (e.g., "3pm")
  const simpleMatch = timeStr.match(/(\d{1,2})\s*(am|pm)/i);
  if (simpleMatch) {
    let h = parseInt(simpleMatch[1], 10);
    const period = simpleMatch[2].toLowerCase();
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h * 60;
  }

  return undefined;
}

// ------------------------------------------------------------------
// SMART INPUT PARSING
// ------------------------------------------------------------------

export interface ParsedInput {
  title: string;
  time?: number;
  date?: string;
}

/**
 * Parses natural language input to extract title, time, and date.
 * Supports patterns like:
 *   - "Meeting at 2pm"
 *   - "Call mom tomorrow at 10am"
 *   - "Dentist next monday"
 *   - "Gym at 6pm tomorrow"
 */
export function parseSmartInput(input: string): ParsedInput {
  let title = input.trim();
  let time: number | undefined;
  let date: string | undefined;

  // Time patterns
  const timePatterns = [
    /at\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    /(\d{1,2}:\d{2}\s*(?:am|pm))/i,
    /(\d{1,2})\s*(am|pm)/i,
  ];

  for (const pattern of timePatterns) {
    const match = title.match(pattern);
    if (match) {
      time = parseTimeStr(match[1]);
      title = title.replace(match[0], '').trim();
      break;
    }
  }

  // Date patterns
  const datePatterns = [
    { pattern: /\btomorrow\b/i, getDate: () => tomorrowStr() },
    { pattern: /\btoday\b/i, getDate: () => todayStr() },
    { pattern: /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, getDate: (m: RegExpMatchArray) => getNextWeekday(m[1]) },
    { pattern: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, getDate: (m: RegExpMatchArray) => getNextWeekday(m[1]) },
  ];

  for (const { pattern, getDate } of datePatterns) {
    const match = title.match(pattern);
    if (match) {
      date = getDate(match as RegExpMatchArray);
      title = title.replace(match[0], '').trim();
      break;
    }
  }

  // Clean up title
  title = title.replace(/\s+/g, ' ').trim();
  if (title.toLowerCase().startsWith('add ')) {
    title = title.substring(4).trim();
  }

  return { title, time, date };
}

function getNextWeekday(dayName: string): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const target = days.indexOf(dayName.toLowerCase());
  const today = new Date();
  const todayDay = today.getDay();
  let diff = target - todayDay;
  if (diff <= 0) diff += 7;
  today.setDate(today.getDate() + diff);
  return formatLocalDate(today);
}

// ------------------------------------------------------------------
// VALIDATION HELPERS
// ------------------------------------------------------------------

/**
 * Validates that a task title is not empty and not a duplicate.
 * Returns error message or null if valid.
 */
export function validateTaskTitle(title: string, existingTitles: string[]): string | null {
  const trimmed = title.trim();
  if (!trimmed) return 'Task title cannot be empty';
  if (existingTitles.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
    return 'Task with this title already exists';
  }
  return null;
}

/**
 * Validates that a time is not already allocated to another task.
 * Returns error message or null if valid.
 */
export function validateTaskTime(
  time: number | undefined,
  date: string,
  taskId: string,
  existingTasks: Array<{ id: string; startTime?: number; date: string }>
): string | null {
  if (time === undefined) return null;

  const conflictingTask = existingTasks.find(
    t => t.id !== taskId && t.date === date && t.startTime === time
  );

  if (conflictingTask) {
    return `Time already allocated to "${conflictingTask.id}"`;
  }
  return null;
}
