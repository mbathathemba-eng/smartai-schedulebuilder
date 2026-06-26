/**
 * AI Service Layer
 * ----------------
 * All AI-related logic for Jerald AI Coach lives here.
 *
 * Architecture:
 *   - Google Gemini 2.5 Flash as primary AI engine (via official SDK)
 *   - Intent dictionary with pattern matching for robust local NLP fallback
 *   - Energy-aware dynamic scheduling suggestions
 *   - Async clients for Gemini, OpenAI, Anthropic, and custom proxy
 *   - Provider auto-detection with priority: Gemini > OpenAI > Anthropic > Proxy > Local
 *   - Standardized error handling with typed error codes for UI consumption
 */

import { GoogleGenAI } from '@google/genai';
import { Task, EnergyLevel, Priority, UserEnergyState } from '../types';
import { generateId, todayStr, parseTimeStr, formatLocalDate } from '../lib/utils';

// ------------------------------------------------------------------
// ENVIRONMENT CONFIGURATION
// ------------------------------------------------------------------

/** Reads Vite environment variables at runtime. */
const ENV = {
  GEMINI_KEY: import.meta.env.VITE_GEMINI_API_KEY as string | undefined,
  GEMINI_MODEL: (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'gemini-2.5-flash-preview-05-20',

  OPENAI_KEY: import.meta.env.VITE_OPENAI_API_KEY as string | undefined,
  OPENAI_URL: (import.meta.env.VITE_OPENAI_API_URL as string | undefined) || 'https://api.openai.com/v1/chat/completions',
  OPENAI_MODEL: (import.meta.env.VITE_OPENAI_MODEL as string | undefined) || 'gpt-4o-mini',

  ANTHROPIC_KEY: import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined,
  ANTHROPIC_URL: (import.meta.env.VITE_ANTHROPIC_API_URL as string | undefined) || 'https://api.anthropic.com/v1/messages',
  ANTHROPIC_MODEL: (import.meta.env.VITE_ANTHROPIC_MODEL as string | undefined) || 'claude-3-haiku-20240307',

  PROXY_URL: import.meta.env.VITE_AI_PROXY_URL as string | undefined,
};

// ------------------------------------------------------------------
// GEMINI CLIENT INITIALIZATION
// ------------------------------------------------------------------

/** Singleton Gemini client - lazy-init only when key is present. */
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!ENV.GEMINI_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: ENV.GEMINI_KEY });
  }
  return geminiClient;
}

// ------------------------------------------------------------------
// TYPES
// ------------------------------------------------------------------

/** Structured JSON output schema for Gemini AI */
export interface GeminiStructuredOutput {
  taskTitle: string | null;
  time: string | null; // HH:MM format
  dateOffset: number | null; // 0 = today, 1 = tomorrow, 2+ = days out, null = Inbox
  detectedEnergy: 'low' | 'medium' | 'high' | null;
  coachingMessage: string;
}

/** Shape of the response returned by the AI service. */
export interface AiResponse {
  /** Human-readable reply text shown in the chat bubble. */
  reply: string;
  /** Any new tasks the AI wants to inject into the schedule. */
  tasks: Task[];
  /** Energy state change detected from user text. */
  energyStateChange?: UserEnergyState;
  /** Structured extraction result from Gemini */
  structured?: GeminiStructuredOutput;
}

/** Standardized error shape returned when a network call fails. */
export interface AiError {
  code: 'UNAUTHORIZED' | 'RATE_LIMIT' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  status?: number;
}

/** Union type representing either a successful AI response or a structured error. */
export type AiResult = { ok: true; data: AiResponse } | { ok: false; error: AiError };

/** Intent type for the local NLP engine */
type IntentType =
  | 'morning_routine'
  | 'study_session'
  | 'optimize_day'
  | 'group_by_energy'
  | 'add_break'
  | 'add_task'
  | 'clear_tasks'
  | 'swap_energy'
  | 'unknown';

// ------------------------------------------------------------------
// INTENT DICTIONARY (Robust NLP Engine)
// ------------------------------------------------------------------

interface IntentPattern {
  type: IntentType;
  patterns: RegExp[];
  keywords: string[];
}

const INTENT_DICTIONARY: IntentPattern[] = [
  {
    type: 'morning_routine',
    patterns: [
      /build\s*(me)?\s*(a)?\s*morning\s*(routine|schedule)?/i,
      /morning\s*(routine|schedule|routine)/i,
      /start\s*(my)?\s*day/i,
      /wake\s*up\s*(routine)?/i,
    ],
    keywords: ['morning', 'routine', 'wake up', 'start day'],
  },
  {
    type: 'study_session',
    patterns: [
      /study\s*(session|plan|schedule)?/i,
      /exam\s*(prep|preparation)?/i,
      /help\s*(me)?\s*study/i,
      /focus\s*(session|block)?/i,
      /rearrange\s*(my)?\s*(day|schedule)?/i,
    ],
    keywords: ['study', 'exam', 'focus', 'homework', 'cram', 'review'],
  },
  {
    type: 'optimize_day',
    patterns: [
      /optimize\s*(my)?\s*(day|schedule)?/i,
      /best\s*(schedule|plan)/i,
      /improve\s*(my)?\s*(schedule|day)/i,
      /what\s*should\s*i\s*do/i,
      /schedule\s*(optimize|improve)/i,
    ],
    keywords: ['optimize', 'improve', 'best', 'efficient', 'schedule'],
  },
  {
    type: 'group_by_energy',
    patterns: [
      /group\s*(by)?\s*energy/i,
      /energy\s*(level|group)/i,
      /show\s*(by)?\s*energy/i,
      /sort\s*(by)?\s*energy/i,
    ],
    keywords: ['energy', 'group', 'sort'],
  },
  {
    type: 'add_break',
    patterns: [
      /add\s*(a)?\s*break/i,
      /make\s*room\s*(for)?\s*(a)?\s*break/i,
      /take\s*(a)?\s*break/i,
      /insert\s*(a)?\s*break/i,
      /need\s*(a)?\s*break/i,
    ],
    keywords: ['break', 'rest', 'pause', 'recharge'],
  },
  {
    type: 'add_task',
    patterns: [
      /add\s+(.+)/i,
      /create\s+(.+)/i,
      /schedule\s+(.+)/i,
      /(\w+)\s+at\s+\d{1,2}(:\d{2})?\s*(am|pm)?/i,
      /remind\s+me\s+(to\s+)?/i,
    ],
    keywords: ['add', 'create', 'schedule', 'remind', 'call', 'buy', 'write', 'clean', 'meet'],
  },
  {
    type: 'clear_tasks',
    patterns: [
      /clear\s*(my)?\s*(schedule|tasks|day)?/i,
      /remove\s*(all)?\s*(my)?\s*tasks/i,
      /empty\s*(my)?\s*(schedule|inbox)?/i,
      /reset\s*(my)?\s*day/i,
    ],
    keywords: ['clear', 'remove', 'empty', 'reset', 'delete all'],
  },
  {
    type: 'swap_energy',
    patterns: [
      /swap\s*(intensive|high)?\s*tasks/i,
      /clear\s*(high)?\s*energy\s*tasks/i,
      /remove\s*(challenging|intensive)/i,
      /too\s*(tired|much|exhausted)/i,
      /lower\s*energy\s*tasks/i,
    ],
    keywords: ['swap', 'too tired', 'exhausted', 'lower intensity', 'less challenging'],
  },
];

// ------------------------------------------------------------------
// ENERGY STATE DETECTION
// ------------------------------------------------------------------

/**
 * Detects energy level mentions in user text.
 * Returns the detected energy level or undefined if none found.
 *
 * Patterns recognized:
 *   - "I have low energy"
 *   - "my energy is high"
 *   - "feeling medium energy"
 *   - "low energy today"
 *   - "high energy but..."
 */
export function detectEnergyState(text: string): UserEnergyState | undefined {
  const lower = text.toLowerCase();

  // Pattern matching for energy mentions
  const energyPatterns: { level: UserEnergyState; patterns: RegExp[] }[] = [
    {
      level: 'Low',
      patterns: [
        /\b(low|low\s*energy|drained|exhausted|tired|no\s*energy)\b/i,
        /i\s*(have\s*)?(am\s*)?(feel\s*)?(low\s*energy)/i,
        /my\s*energy\s*(is\s*)?(low)/i,
        /energy\s*(is\s*)?(low)/i,
      ],
    },
    {
      level: 'High',
      patterns: [
        /\b(high\s*energy|energized|pumped|motivated|lots\s*of\s*energy)\b/i,
        /i\s*(have\s*)?(am\s*)?(feel\s*)?(high\s*energy)/i,
        /my\s*energy\s*(is\s*)?(high)/i,
        /energy\s*(is\s*)?(high)/i,
      ],
    },
    {
      level: 'Medium',
      patterns: [
        /\b(medium\s*energy|moderate|okay|average\s*energy)\b/i,
        /i\s*(have\s*)?(am\s*)?(feel\s*)?(medium\s*energy)/i,
        /my\s*energy\s*(is\s*)?(medium)/i,
        /energy\s*(is\s*)?(medium)/i,
      ],
    },
  ];

  for (const { level, patterns } of energyPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        return level;
      }
    }
  }

  return undefined;
}

// ------------------------------------------------------------------
// CONVERSATIONAL SANITIZATION
// ------------------------------------------------------------------

/**
 * Sanitizes user input by removing conversational filler and introductory phrases.
 * This prevents Jerald from copying phrases like "yea I have low energy but I want to..."
 * as literal task names.
 *
 * @param text - Raw user input
 * @returns Sanitized text with filler removed
 */
export function sanitizeUserInput(text: string): string {
  let sanitized = text;

  // Remove common conversational fillers
  const fillers = [
    // Acknowledgments
    /^(yea|yeah|yes|yep|yup|ok|okay|sure|right|got\s*it|understood|gotcha)[,\s]+/i,
    // Self-descriptive clauses followed by "but" or "and"
    /^(i\s+have\s+(low|medium|high)\s*energy)[,\s]*(but|and|so|i\s*want|i\s*need)?[,\s]*/i,
    /^(my\s+energy\s+is\s+(low|medium|high))[,\s]*(but|and|so|i\s*want|i\s*need)?[,\s]*/i,
    /^(feeling\s+(low|medium|high)\s*energy)[,\s]*(but|and|so|i\s*want|i\s*need)?[,\s]*/i,
    /^(i'm\s+feeling\s+(low|medium|high)\s*energy)[,\s]*(but|and|so|i\s*want|i\s*need)?[,\s]*/i,
    // Introductory phrases
    /^(i\s+want\s+to\s+)/i,
    /^(i\s+need\s+to\s+)/i,
    /^(i'd\s+like\s+to\s+)/i,
    /^(can\s+you\s+help\s+me\s+)/i,
    /^(could\s+you\s+)/i,
    /^(please\s+)/i,
    /^(actually,?\s+)/i,
    /^(honestly,?\s+)/i,
    /^(basically,?\s+)/i,
  ];

  for (const filler of fillers) {
    sanitized = sanitized.replace(filler, '');
  }

  // Remove energy mentions from the task portion
  sanitized = sanitized
    .replace(/\b(i\s+have\s+(low|medium|high)\s*energy)\b[,\s]*/gi, '')
    .replace(/\b(my\s+energy\s+is\s+(low|medium|high))\b[,\s]*/gi, '')
    .replace(/\b(feeling\s+(low|medium|high)\s*energy)\b[,\s]*/gi, '')
    .replace(/\b(low|medium|high)\s*energy\b[,\s]*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized;
}

/**
 * Detects intent from user input using pattern matching and keyword detection.
 */
function detectIntent(text: string): IntentType {
  const lower = text.toLowerCase().trim();

  // Score each intent
  const scores: Map<IntentType, number> = new Map();

  for (const intent of INTENT_DICTIONARY) {
    let score = 0;

    // Pattern matching (higher weight)
    for (const pattern of intent.patterns) {
      if (pattern.test(lower)) {
        score += 10;
      }
    }

    // Keyword matching (lower weight)
    for (const keyword of intent.keywords) {
      if (lower.includes(keyword)) {
        score += 3;
      }
    }

    if (score > 0) {
      scores.set(intent.type, (scores.get(intent.type) || 0) + score);
    }
  }

  // Find highest scoring intent
  let bestIntent: IntentType = 'unknown';
  let highestScore = 0;

  scores.forEach((score, intent) => {
    if (score > highestScore) {
      highestScore = score;
      bestIntent = intent;
    }
  });

  return bestIntent;
}

/**
 * Extracts time and task details from natural language input.
 */
function extractTaskDetails(text: string): { title: string; time?: number; duration?: number } {
  let title = text;
  let time: number | undefined;
  let duration: number | undefined;

  // Extract time (e.g., "at 2pm", "at 14:00", "3pm")
  const timePatterns = [
    /at\s+(\d{1,2}:\d{2}\s*(?:am|pm)?)/i,
    /at\s+(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2}:\d{2}\s*(?:am|pm))/i,
    /(\d{1,2})\s*(am|pm)/i,
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      time = parseTimeStr(match[1] + (match[2] || ''));
      title = title.replace(match[0], '').trim();
      break;
    }
  }

  // Extract duration (e.g., "for 30 minutes", "30 min", "1 hour")
  const durationMatch = text.match(/(?:for\s+)?(\d+)\s*(min(?:ute)?s?|hours?|h)/i);
  if (durationMatch) {
    const amount = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();
    duration = unit.startsWith('h') ? amount * 60 : amount;
    title = title.replace(durationMatch[0], '').trim();
  }

  // Clean up title
  title = title
    .replace(/^(add|create|schedule|remind me to)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, time, duration };
}

// ------------------------------------------------------------------
// PROVIDER DETECTION
// ------------------------------------------------------------------

/** Available AI provider types. */
type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'proxy' | 'local';

/**
 * Determines which AI provider to use based on environment variables.
 * Priority: Gemini > OpenAI > Anthropic > Proxy > Local Simulation.
 */
function detectProvider(): AiProvider {
  if (ENV.GEMINI_KEY) return 'gemini';
  if (ENV.OPENAI_KEY) return 'openai';
  if (ENV.ANTHROPIC_KEY) return 'anthropic';
  if (ENV.PROXY_URL) return 'proxy';
  return 'local';
}

// ------------------------------------------------------------------
// MAIN ENTRY POINT
// ------------------------------------------------------------------

/**
 * Processes a user message through the AI pipeline.
 *
 * Behavior:
 *   - If Gemini is configured, uses official Google SDK with Gemini 2.5 Flash.
 *   - Falls back to OpenAI, Anthropic, or custom proxy if configured.
 *   - If offline or no keys are set, falls back to the local simulation engine.
 *   - Returns a standardized AiResult so the UI can handle errors gracefully.
 */
export async function processAiMessageAsync(userText: string, existingTasks: Task[], energy?: UserEnergyState): Promise<AiResult> {
  const provider = detectProvider();

  if (provider === 'local') {
    // Offline fallback — instant, no network.
    const result = runLocalSimulation(userText, existingTasks, energy);
    return { ok: true, data: result };
  }

  try {
    if (provider === 'gemini') {
      return await callGemini(userText, existingTasks, energy);
    }
    if (provider === 'proxy') {
      return await callProxy(userText, existingTasks);
    }
    if (provider === 'openai') {
      return await callOpenAI(userText, existingTasks);
    }
    if (provider === 'anthropic') {
      return await callAnthropic(userText, existingTasks);
    }
    return { ok: true, data: runLocalSimulation(userText, existingTasks, energy) };
  } catch (err) {
    return { ok: false, error: normalizeError(err) };
  }
}

// ------------------------------------------------------------------
// NETWORK CLIENTS
// ------------------------------------------------------------------

/**
 * Calls Gemini 2.5 Flash using the official Google GenAI SDK.
 * This is the primary AI engine when VITE_GEMINI_API_KEY is configured.
 * Enforces strict structured JSON output schema.
 */
async function callGemini(userText: string, existingTasks: Task[], energy?: UserEnergyState): Promise<AiResult> {
  const client = getGeminiClient();
  if (!client) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Gemini API key not configured.' } };
  }

  const systemPrompt = buildGeminiSystemPrompt(existingTasks, energy);
  const detectedEnergy = detectEnergyState(userText);

  try {
    const response = await client.models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: userText }],
        },
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3, // Lower temp for more consistent structured output
        maxOutputTokens: 512,
        topP: 0.8,
      },
    });

    const rawReply = response.text || '';

    // Parse structured JSON output from Gemini (pass original text for date inference)
    const structured = parseStructuredOutput(rawReply, userText);

    // Extract tasks from structured output
    const tasks: Task[] = [];
    if (structured.taskTitle) {
      tasks.push(structuredOutputToTask(structured));
    }

    // Map detected energy to UserEnergyState
    let energyStateChange: UserEnergyState | undefined;
    if (structured.detectedEnergy) {
      energyStateChange = structured.detectedEnergy === 'low' ? 'Low' :
                          structured.detectedEnergy === 'high' ? 'High' : 'Medium';
    }

    return {
      ok: true,
      data: {
        reply: structured.coachingMessage,
        tasks,
        energyStateChange: energyStateChange || detectedEnergy,
        structured,
      },
    };
  } catch (err) {
    // Handle Gemini-specific errors
    if (err instanceof Error) {
      if (err.message.includes('API_KEY') || err.message.includes('401')) {
        return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid Gemini API key.' } };
      }
      if (err.message.includes('429') || err.message.includes('quota')) {
        return { ok: false, error: { code: 'RATE_LIMIT', message: 'Gemini rate limit exceeded. Please wait a moment.' } };
      }
      if (err.message.includes('503') || err.message.includes('overloaded')) {
        return { ok: false, error: { code: 'SERVER_ERROR', message: 'Gemini is temporarily overloaded. Try again shortly.' } };
      }
    }
    return { ok: false, error: normalizeError(err) };
  }
}

/**
 * Parses structured JSON output from Gemini response.
 * Falls back to local simulation parsing if JSON is malformed.
 *
 * ALSO: Detects "tomorrow" / "today" keywords in raw text to infer dateOffset
 * if the model failed to set it correctly.
 */
function parseStructuredOutput(rawReply: string, originalUserText: string): GeminiStructuredOutput {
  // Try to extract JSON object from the response
  const jsonMatch = rawReply.match(/\{[\s\S]*"taskTitle"[\s\S]*"coachingMessage"[\s\S]*\}/);

  let parsed: Record<string, unknown> | null = null;

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // JSON malformed, fall through
    }
  }

  // Extract raw task title from parsed or null
  let taskTitle: string | null = parsed && typeof parsed.taskTitle === 'string' ? parsed.taskTitle : null;
  let dateOffset: number | null = parsed && typeof parsed.dateOffset === 'number' ? parsed.dateOffset : null;

  // Detect "tomorrow" or "today" in user text to infer dateOffset
  const lowerUserText = originalUserText.toLowerCase();
  const hasTomorrow = /\btomorrow\b/i.test(lowerUserText);
  const hasToday = /\btoday\b/i.test(lowerUserText);

  // If model didn't set dateOffset but user text mentions dates, override
  if (dateOffset === null) {
    if (hasTomorrow) {
      dateOffset = 1;
    } else if (hasToday) {
      dateOffset = 0;
    }
  }

  // If taskTitle is null but user text contains a task description, extract it
  if (!taskTitle && parsed) {
    // Try to extract from the raw reply's coachingMessage
    const coachingMsg = typeof parsed.coachingMessage === 'string' ? parsed.coachingMessage : rawReply;

    // If coaching message mentions "tomorrow", the task date should be tomorrow
    if (/\btomorrow\b/i.test(coachingMsg) && dateOffset === null) {
      dateOffset = 1;
    }
  }

  // Sanitize task title: remove date/time phrases
  if (taskTitle) {
    taskTitle = sanitizeTaskTitle(taskTitle);
  }

  return {
    taskTitle,
    time: parsed && typeof parsed.time === 'string' ? parsed.time : null,
    dateOffset,
    detectedEnergy: parsed && ['low', 'medium', 'high'].includes(parsed.detectedEnergy as string)
      ? (parsed.detectedEnergy as 'low' | 'medium' | 'high')
      : null,
    coachingMessage: parsed && typeof parsed.coachingMessage === 'string' ? parsed.coachingMessage : rawReply,
  };
}

/**
 * Sanitizes task titles by removing:
 *   - "tomorrow", "today", "next week", etc.
 *   - Time references like "at 3pm", "at 14:00"
 *   - Date references like "on Monday", "on June 15"
 */
function sanitizeTaskTitle(title: string): string {
  return title
    // Remove day references
    .replace(/\b(tomorrow|today|tonight|yesterday)\b/gi, '')
    .replace(/\b(next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month))\b/gi, '')
    .replace(/\b(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    // Remove time references
    .replace(/\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '')
    // Remove date patterns
    .replace(/\b(on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    // Clean up
    .replace(/\s+/g, ' ')
    .replace(/^[-—,.\s]+|[-—,.\s]+$/g, '')
    .trim();
}

/**
 * Converts structured output to a Task object.
 * Computes the target date from dateOffset using local calendar boundaries
 * (never UTC) so "tomorrow" lands on the correct calendar day.
 */
function structuredOutputToTask(structured: GeminiStructuredOutput): Task {
  // Compute proper date from offset using local calendar boundaries
  let taskDate: string;

  if (structured.dateOffset === null || structured.dateOffset === 0) {
    // dateOffset null or 0 = today
    taskDate = todayStr();
  } else {
    // dateOffset 1+ = days from today; use local midnight to avoid TZ drift
    const d = new Date();
    d.setDate(d.getDate() + structured.dateOffset);
    taskDate = formatLocalDate(d);
  }

  // Parse time if present
  let startTime: number | undefined;
  if (structured.time) {
    const [h, m] = structured.time.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      startTime = h * 60 + m;
    }
  }

  // Sanitize title one more time to be sure
  const cleanTitle = sanitizeTaskTitle(structured.taskTitle || 'Untitled Task');

  return {
    id: generateId(),
    title: cleanTitle,
    duration: 30,
    priority: 'Medium',
    energyLevel: structured.detectedEnergy === 'low' ? 'Casual' :
                 structured.detectedEnergy === 'high' ? 'High Energy' : 'Focus',
    startTime,
    completed: false,
    createdAt: Date.now(),
    date: taskDate,
  };
}

/**
 * Builds the system prompt for Gemini with strict structured output requirements.
 */
function buildGeminiSystemPrompt(existingTasks: Task[], energy?: UserEnergyState): string {
  const pending = existingTasks.filter((t) => !t.completed);
  const taskList = pending.map((t) => `- ${t.title} (${t.energyLevel}, ${t.priority}${t.startTime ? `, ${Math.floor(t.startTime / 60)}:${String(t.startTime % 60).padStart(2, '0')}` : ''})`).join('\n') || 'No pending tasks.';
  const energyContext = energy ? `The user's current energy level is: ${energy}.` : '';

  return `You are Jerald, an advanced adaptive schedule coach inside a task-scheduling app. Your job is to strip out conversational filler and extract exact parameter targets from user text.

${energyContext}

The user has the following pending tasks:
${taskList}

CRITICAL: You MUST respond with ONLY a valid JSON object in this EXACT schema - no other text:
{
  "taskTitle": "Concise, cleaned action string (e.g., 'Cook dinner') or null",
  "time": "HH:MM formatted string or null",
  "dateOffset": number (0 for today, 1 for tomorrow, 2+ for days out, or null for Inbox),
  "detectedEnergy": "low" | "medium" | "high" | null,
  "coachingMessage": "Jerald's smart coaching feedback context"
}

Rules:
1. Strip conversational filler like "yea", "I have low energy but", "can you help me" from task names
2. Extract the core action only for taskTitle (e.g., "yea I have low energy but I want to cook dinner at 18:00" → taskTitle: "Cook dinner", time: "18:00")
3. Detect energy mentions: "low energy", "drained", "exhausted" → low; "high energy", "energized" → high; "medium energy", "okay" → medium
4. Parse dates: "today" → 0, "tomorrow" → 1, "next Monday" → calculate days from today
5. coachingMessage should be warm, concise, and actionable
6. Return null for taskTitle if no task is being added
7. Respond with ONLY the JSON object, no markdown formatting`;
}

/**
 * Calls a custom proxy / backend endpoint.
 */
async function callProxy(userText: string, existingTasks: Task[]): Promise<AiResult> {
  const url = ENV.PROXY_URL!;
  const payload = buildPayload(userText, existingTasks);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return { ok: false, error: await parseHttpError(res) };
  }

  const data = await res.json();
  return { ok: true, data: extractTasksFromReply(data.reply || data.message || '', data.tasks || []) };
}

/**
 * Calls the OpenAI Chat Completions API directly.
 */
async function callOpenAI(userText: string, existingTasks: Task[]): Promise<AiResult> {
  const isDev = import.meta.env.DEV;
  const url = isDev ? '/api/openai/v1/chat/completions' : ENV.OPENAI_URL;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ENV.OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: ENV.OPENAI_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(existingTasks) },
        { role: 'user', content: userText },
      ],
      temperature: 0.7,
      max_tokens: 512,
    }),
  });

  if (!res.ok) {
    return { ok: false, error: await parseHttpError(res) };
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content || '';
  return { ok: true, data: extractTasksFromReply(reply, []) };
}

/**
 * Calls the Anthropic Messages API directly.
 */
async function callAnthropic(userText: string, existingTasks: Task[]): Promise<AiResult> {
  const isDev = import.meta.env.DEV;
  const url = isDev ? '/api/anthropic/v1/messages' : ENV.ANTHROPIC_URL;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ENV.ANTHROPIC_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ENV.ANTHROPIC_MODEL,
      max_tokens: 512,
      messages: [
        { role: 'user', content: `${buildSystemPrompt(existingTasks)}\n\nUser: ${userText}` },
      ],
    }),
  });

  if (!res.ok) {
    return { ok: false, error: await parseHttpError(res) };
  }

  const data = await res.json();
  const reply = data.content?.[0]?.text || '';
  return { ok: true, data: extractTasksFromReply(reply, []) };
}

// ------------------------------------------------------------------
// ERROR HANDLING
// ------------------------------------------------------------------

/**
 * Converts a failed HTTP response into a structured AiError.
 */
async function parseHttpError(res: Response): Promise<AiError> {
  let message = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    message = body.error?.message || body.message || message;
  } catch {
    // non-JSON error body
  }

  if (res.status === 401 || res.status === 403) {
    return { code: 'UNAUTHORIZED', message: `Invalid API key or unauthorized. ${message}`, status: res.status };
  }
  if (res.status === 429) {
    return { code: 'RATE_LIMIT', message: `Rate limit exceeded. Please wait a moment. ${message}`, status: res.status };
  }
  if (res.status >= 500) {
    return { code: 'SERVER_ERROR', message: `Provider server error. ${message}`, status: res.status };
  }
  return { code: 'UNKNOWN', message, status: res.status };
}

/**
 * Normalizes thrown exceptions into an AiError.
 */
function normalizeError(err: unknown): AiError {
  if (err instanceof Error) {
    if (err.message.includes('fetch') || err.message.includes('network')) {
      return { code: 'NETWORK_ERROR', message: 'Network error. Check your connection or proxy configuration.' };
    }
    return { code: 'UNKNOWN', message: err.message };
  }
  return { code: 'UNKNOWN', message: 'An unexpected error occurred.' };
}

// ------------------------------------------------------------------
// PROMPT BUILDERS
// ------------------------------------------------------------------

/** Builds a system prompt for the LLM */
function buildSystemPrompt(existingTasks: Task[]): string {
  const pending = existingTasks.filter((t) => !t.completed);
  const taskList = pending.map((t) => `- ${t.title} (${t.energyLevel}, ${t.priority})`).join('\n') || 'No pending tasks.';

  return `You are Jerald, an AI Planning Coach inside a task-scheduling app.
The user has the following pending tasks:
${taskList}

When the user asks for scheduling help, respond concisely and helpfully.
If you suggest new tasks, format them as a JSON array at the very end of your message like:
[{"title":"Task name","duration":30,"priority":"Medium","energyLevel":"Focus","time":"14:00"}]
Only include the JSON block if you are actually adding tasks.`;
}

/** Builds the payload object for proxy backends */
function buildPayload(userText: string, existingTasks: Task[]) {
  return {
    message: userText,
    context: {
      pendingTasks: existingTasks.filter((t) => !t.completed),
      totalTasks: existingTasks.length,
    },
  };
}

// ------------------------------------------------------------------
// REPLY PARSING
// ------------------------------------------------------------------

/**
 * Extracts tasks from an AI reply.
 */
function extractTasksFromReply(reply: string, fallbackTasks: Task[]): AiResponse {
  const tasks: Task[] = [...fallbackTasks];
  let cleanReply = reply;

  const jsonMatch = reply.match(/\[\s*\{[\s\S]*?\}\s*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: unknown) => {
          if (isTaskLike(item)) {
            tasks.push(taskLikeToTask(item));
          }
        });
      }
      cleanReply = reply.replace(jsonMatch[0], '').trim();
    } catch {
      // JSON malformed; ignore and return raw reply
    }
  }

  return { reply: cleanReply, tasks };
}

function isTaskLike(item: unknown): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null && 'title' in item;
}

function taskLikeToTask(item: Record<string, unknown>): Task {
  const timeStr = typeof item.time === 'string' ? item.time : undefined;
  let startTime: number | undefined;
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    startTime = h * 60 + m;
  }
  return {
    id: generateId(),
    title: String(item.title),
    duration: typeof item.duration === 'number' ? item.duration : 30,
    priority: (item.priority as Priority) || 'Medium',
    energyLevel: (item.energyLevel as EnergyLevel) || 'Focus',
    startTime,
    completed: false,
    createdAt: Date.now(),
    date: todayStr(),
  };
}

// ------------------------------------------------------------------
// LOCAL SIMULATION ENGINE (Intent-Based NLP)
// ------------------------------------------------------------------

/**
 * Synchronous local engine using robust intent detection.
 * Energy context influences scheduling suggestions dynamically.
 *
 * CRITICAL: Sanitizes user input to prevent conversational fillers from
 * becoming task names. Also detects energy state changes from text.
 *
 * Also provides structured output for consistency with Gemini API.
 */
export function runLocalSimulation(userText: string, existingTasks: Task[], energy: UserEnergyState = 'Medium'): AiResponse {
  const tasks: Task[] = [];
  let reply = '';

  // STEP 1: Detect energy state change from user text
  const detectedEnergy = detectEnergyState(userText);

  // STEP 2: Sanitize user input to remove conversational fillers
  const sanitizedText = sanitizeUserInput(userText);

  // STEP 3: Determine effective energy (use detected or fallback to current)
  const effectiveEnergy = detectedEnergy || energy;

  // STEP 4: Detect intent from sanitized text
  const intent = detectIntent(sanitizedText);

  // Extract structured data for consistent output
  const structured: GeminiStructuredOutput = {
    taskTitle: null,
    time: null,
    dateOffset: null,
    detectedEnergy: detectedEnergy ? detectedEnergy.toLowerCase() as 'low' | 'medium' | 'high' : null,
    coachingMessage: '',
  };

  // Energy-adaptive prefix
  const energyContext = {
    High: "With your high energy, let's tackle challenging tasks first! ",
    Medium: "Here are some balanced suggestions for your current energy level. ",
    Low: "Taking it easy today — here are some lighter, manageable options. ",
  };

  // If energy was detected, acknowledge it
  if (detectedEnergy) {
    const energyAck = detectedEnergy === 'Low'
      ? "I've noted you're feeling low energy. "
      : detectedEnergy === 'High'
      ? "I've noted you're feeling energized! "
      : "I've noted your energy level. ";
    reply = energyAck;
  }

  switch (intent) {
    case 'morning_routine': {
      reply += `${energyContext[effectiveEnergy]}Here's a balanced morning routine to kickstart your day!`;
      if (effectiveEnergy === 'High') {
        tasks.push(
          createTask('High-intensity workout', 45, 'High', 'High Energy', '06:30'),
          createTask('Cold shower', 10, 'Medium', 'High Energy', '07:20'),
          createTask('Protein-rich breakfast', 20, 'Medium', 'Casual', '07:35'),
          createTask('Review goals and visualize success', 15, 'High', 'Focus', '08:00')
        );
      } else if (effectiveEnergy === 'Low') {
        tasks.push(
          createTask('Light stretching in bed', 10, 'Low', 'Casual', '07:00'),
          createTask('Hydrate with lemon water', 5, 'Low', 'Casual', '07:15'),
          createTask('Easy breakfast', 15, 'Low', 'Casual', '07:25'),
          createTask('Set one simple goal for today', 5, 'Medium', 'Focus', '07:45')
        );
      } else {
        tasks.push(
          createTask('Drink a glass of water', 5, 'Low', 'Casual', '07:00'),
          createTask('Light stretching or yoga', 15, 'Medium', 'High Energy', '07:10'),
          createTask('Shower and get ready', 30, 'Medium', 'Casual', '07:30'),
          createTask('Healthy breakfast', 20, 'Low', 'Casual', '08:05'),
          createTask('Plan top 3 priorities', 10, 'High', 'Focus', '08:30')
        );
      }
      break;
    }

    case 'study_session': {
      reply += `${energyContext[effectiveEnergy]}I've blocked out a focused study session with breaks built in.`;
      if (effectiveEnergy === 'High') {
        tasks.push(
          createTask('Deep study block - hardest topic', 60, 'High', 'High Energy', '13:00'),
          createTask('Quick walk break', 10, 'Low', 'Casual', '14:05'),
          createTask('Practice problems - challenging set', 45, 'High', 'High Energy', '14:20'),
          createTask('Review and summarize', 30, 'Medium', 'Focus', '15:10')
        );
      } else if (effectiveEnergy === 'Low') {
        tasks.push(
          createTask('Light review of notes', 20, 'Low', 'Casual', '13:00'),
          createTask('Flashcard review - easy cards', 15, 'Low', 'Casual', '13:25'),
          createTask('Short break with snack', 15, 'Low', 'Casual', '13:45'),
          createTask('Watch summary video', 20, 'Low', 'Casual', '14:05')
        );
      } else {
        tasks.push(
          createTask('Review lecture notes', 30, 'Medium', 'Focus', '13:00'),
          createTask('Practice problems', 45, 'High', 'Focus', '13:35'),
          createTask('Short walk break', 10, 'Low', 'Casual', '14:25'),
          createTask('Flashcard review', 20, 'Medium', 'Focus', '14:40')
        );
      }
      break;
    }

    case 'optimize_day': {
      const highEnergy = existingTasks.filter((t) => t.energyLevel === 'High Energy' && !t.completed);
      const focus = existingTasks.filter((t) => t.energyLevel === 'Focus' && !t.completed);
      const casual = existingTasks.filter((t) => t.energyLevel === 'Casual' && !t.completed);

      let advice = '';
      if (effectiveEnergy === 'High') {
        advice = "Since you're feeling energized, I recommend front-loading your challenging work. Tackle high-energy tasks before 11am when your natural cortisol is highest.";
        if (highEnergy.length === 0) {
          advice += " You currently have no high-energy tasks scheduled. Want me to suggest some?";
        }
      } else if (effectiveEnergy === 'Low') {
        advice = "With your lower energy today, I recommend focusing on casual tasks and avoiding intensive blocks. Consider rescheduling any high-energy tasks for another day.";
        if (highEnergy.length > 0) {
          advice += ` You have ${highEnergy.length} high-energy task(s) that might be better moved.`;
        }
      } else {
        advice = 'A balanced approach: mix focus work with breaks. Start with a high-energy task, then a break, then focus work in the early afternoon.';
      }

      reply += `You have ${highEnergy.length} high-energy, ${focus.length} focus, and ${casual.length} casual tasks. ${advice}`;
      break;
    }

    case 'group_by_energy': {
      const grouped = groupTasksByEnergy(existingTasks);
      reply += `${energyContext[effectiveEnergy]}\n\n${grouped}`;
      break;
    }

    case 'add_break': {
      reply += effectiveEnergy === 'Low'
        ? 'Perfect! I added a gentle break to help you recharge.'
        : effectiveEnergy === 'High'
        ? 'Great idea! A quick break will help maintain your high energy.'
        : 'Added a mindful break to recharge your cognitive batteries.';
      tasks.push(createTask('Mindful coffee break', 15, 'Low', 'Casual', undefined));
      break;
    }

    case 'add_task': {
      // Use SANITATED text to extract task details
      const details = extractTaskDetails(sanitizedText);
      if (details.title) {
        const energyLevel: EnergyLevel = effectiveEnergy === 'High' ? 'High Energy' : effectiveEnergy === 'Low' ? 'Casual' : 'Focus';
        tasks.push(createTask(
          details.title,
          details.duration || 30,
          'Medium',
          energyLevel,
          details.time ? formatTime24ToStr(details.time) : undefined
        ));
        reply += `Added "${details.title}" to your schedule${details.time ? ` at ${formatTimeFriendly(details.time)}` : ''}.`;

        // Set structured output for add_task case
        structured.taskTitle = details.title;
        structured.time = details.time ? formatTime24ToStr(details.time) : null;
        structured.dateOffset = 0; // Default to today
      } else {
        reply += "I couldn't quite understand what task you'd like to add. Try: 'Add meeting at 2pm' or 'Call mom tomorrow at 10am'.";
      }
      break;
    }

    case 'clear_tasks': {
      reply += effectiveEnergy === 'Low'
        ? "I understand you need a lighter day. Would you like me to clear high-energy tasks, or move them to another day? Say 'swap intensive tasks' to reschedule challenging items."
        : "I can help clear or reschedule tasks. Try 'swap intensive tasks' to move challenging items to another day, or manually delete tasks from your schedule.";
      break;
    }

    case 'swap_energy': {
      const highEnergyTasks = existingTasks.filter((t) => t.energyLevel === 'High Energy' && !t.completed);
      if (highEnergyTasks.length > 0) {
        reply += `I see ${highEnergyTasks.length} high-energy task(s). Since your energy is ${effectiveEnergy.toLowerCase()}, I recommend moving these to another day or swapping them for lighter tasks:\n\n${highEnergyTasks.map(t => `• ${t.title}`).join('\n')}\n\nWould you like me to reschedule these for tomorrow?`;
      } else {
        reply += "Good news — you don't have any high-energy tasks scheduled! Your current tasks are manageable for a lower-energy day.";
      }
      break;
    }

    case 'unknown':
    default: {
      reply = `I'm Jerald, your AI Planning Coach. I can help you:\n\n• Build a morning routine\n• Optimize your day\n• Group tasks by energy level\n• Add a break\n• Study for an exam\n• Swap intensive tasks when your energy drops\n\nWhat would you like to do?`;
      break;
    }
  }

  structured.coachingMessage = reply.trim();

  return {
    reply: reply.trim(),
    tasks,
    energyStateChange: detectedEnergy,
    structured,
  };
}

/**
 * Local regex fallback for extracting structured task data when API is unavailable.
 * Uses pure pattern matching without any network calls.
 */
export function extractStructuredLocally(userText: string): GeminiStructuredOutput {
  const detectedEnergy = detectEnergyState(userText);
  const sanitizedText = sanitizeUserInput(userText);

  // Extract task title
  const details = extractTaskDetails(sanitizedText);

  // Extract date offset
  let dateOffset: number | null = null;
  const lowerText = userText.toLowerCase();
  if (lowerText.includes('today')) {
    dateOffset = 0;
  } else if (lowerText.includes('tomorrow')) {
    dateOffset = 1;
  } else if (/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lowerText)) {
    // Calculate days until next weekday
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const match = lowerText.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (match) {
      const target = days.indexOf(match[1].toLowerCase());
      const today = new Date().getDay();
      let diff = target - today;
      if (diff <= 0) diff += 7;
      dateOffset = diff;
    }
  }

  // Build coaching message
  let coachingMessage = '';
  if (details.title) {
    coachingMessage = `Added "${details.title}" to your schedule${details.time ? ` at ${formatTimeFriendly(details.time)}` : ''}${dateOffset === 1 ? ' for tomorrow' : ''}.`;
    if (detectedEnergy) {
      coachingMessage = `I've noted you're feeling ${detectedEnergy.toLowerCase()} energy. ${coachingMessage}`;
    }
  } else {
    coachingMessage = "I'm Jerald, your AI Planning Coach. How can I help you today?";
  }

  return {
    taskTitle: details.title || null,
    time: details.time ? formatTime24ToStr(details.time) : null,
    dateOffset,
    detectedEnergy: detectedEnergy ? detectedEnergy.toLowerCase() as 'low' | 'medium' | 'high' : null,
    coachingMessage,
  };
}

// ------------------------------------------------------------------
// INTERNAL HELPERS
// ------------------------------------------------------------------

function createTask(title: string, duration: number, priority: Priority, energyLevel: EnergyLevel, timeStr?: string): Task {
  let startTime: number | undefined;
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    startTime = h * 60 + m;
  }
  return {
    id: generateId(),
    title,
    duration,
    priority,
    energyLevel,
    startTime,
    completed: false,
    createdAt: Date.now(),
    date: todayStr(),
  };
}

function groupTasksByEnergy(tasks: Task[]): string {
  const groups: Record<string, string[]> = {
    'High Energy': [],
    'Focus': [],
    'Casual': [],
  };
  tasks.forEach((t) => {
    groups[t.energyLevel].push(t.title);
  });
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([level, items]) => `**${level}:** ${items.join(', ')}`)
    .join('\n');
}

function formatTime24ToStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatTimeFriendly(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
}
