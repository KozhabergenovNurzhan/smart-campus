import type { AvailabilityResult } from '@/types';

// The deterministic checker in src/bookingLogic.ts is the ONLY source of
// availability decisions. This module explains an existing result; it never
// re-decides availability and never modifies bookings.

export interface ExplanationRequest {
  roomLabel: string;
  startTime: string;
  endTime: string;
  result: AvailabilityResult;
}

export interface ExplanationResponse {
  explanation: string;
}

export type ExplainAdapter = (request: ExplanationRequest) => Promise<ExplanationResponse>;

export interface ExplanationOutcome {
  explanation: string;
  usedFallback: boolean;
  failureReason?: string;
}

export const DEFAULT_TIMEOUT_MS = 3000;
export const MAX_ROOM_LABEL_LENGTH = 100;
export const MAX_REASONS = 10;
export const MAX_REASON_LENGTH = 200;
export const MAX_EXPLANATION_LENGTH = 500;
export const MAX_SENTENCES = 2;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function cleanText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!?]+$/, '');
}

export function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

// Rejects malformed requests before the adapter is invoked.
// Returns null when the request is valid, or a failure message.
export function validateExplanationRequest(request: unknown): string | null {
  if (typeof request !== 'object' || request === null) {
    return 'Request must be an object.';
  }
  const req = request as ExplanationRequest;
  if (typeof req.roomLabel !== 'string' || cleanText(req.roomLabel).length === 0) {
    return 'Room label must be a non-empty string.';
  }
  if (req.roomLabel.length > MAX_ROOM_LABEL_LENGTH) {
    return `Room label must be at most ${MAX_ROOM_LABEL_LENGTH} characters.`;
  }
  if (typeof req.startTime !== 'string' || !TIME_PATTERN.test(req.startTime)) {
    return 'Start time must be a valid HH:MM time.';
  }
  if (typeof req.endTime !== 'string' || !TIME_PATTERN.test(req.endTime)) {
    return 'End time must be a valid HH:MM time.';
  }
  const result: unknown = req.result;
  if (typeof result !== 'object' || result === null) {
    return 'Result must be an object.';
  }
  const { available, reasons } = result as AvailabilityResult;
  if (typeof available !== 'boolean') {
    return 'Result status must be a boolean.';
  }
  if (!Array.isArray(reasons)) {
    return 'Result reasons must be an array.';
  }
  if (reasons.length > MAX_REASONS) {
    return `Result must contain at most ${MAX_REASONS} reasons.`;
  }
  for (const reason of reasons) {
    if (typeof reason !== 'string' || cleanText(reason).length === 0) {
      return 'Each reason must be a non-empty string.';
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return `Each reason must be at most ${MAX_REASON_LENGTH} characters.`;
    }
  }
  return null;
}

// Heuristic status-agreement check for controlled wording (the mock adapter).
// This is NOT a general validator for arbitrary real LLM output — documented
// in README.md; a real adapter needs server-side validation instead.
function isStatusConsistent(text: string, available: boolean): boolean {
  if (!/\bavailable\b/i.test(text)) return true;
  if (available) {
    return !/\bunavailable\b|\bnot available\b/i.test(text);
  }
  return /\bnot\b|\bnever\b|\bunavailable\b|\bcannot\b|\bcan't\b|\bisn't\b/i.test(text);
}

// Returns null when the response is usable, or a failure message.
export function validateAdapterResponse(response: unknown, request: ExplanationRequest): string | null {
  if (typeof response !== 'object' || response === null) {
    return 'Response must be an object.';
  }
  const text: unknown = (response as ExplanationResponse).explanation;
  if (typeof text !== 'string') {
    return 'Explanation must be a string.';
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 'Explanation must not be empty.';
  }
  if (trimmed.length > MAX_EXPLANATION_LENGTH) {
    return `Explanation must be at most ${MAX_EXPLANATION_LENGTH} characters.`;
  }
  if (countSentences(trimmed) > MAX_SENTENCES) {
    return `Explanation must contain at most ${MAX_SENTENCES} sentences.`;
  }
  if (!isStatusConsistent(trimmed, request.result.available)) {
    return 'Explanation contradicts the availability status.';
  }
  return null;
}

// Deterministic fallback using only the facts already supplied in the request.
const SUMMARY_SUFFIX = 'See the confirmed reasons above for all restrictions.';

function joinReasons(reasons: string[]): string {
  return reasons.map((r) => stripTrailingPunctuation(cleanText(r))).join('; ');
}

// When the joined reasons would push the output over the documented limit,
// fall back to a concise summary. The UI result banner always displays the
// complete original reasons, so the summary never hides information the
// user cannot see elsewhere.
function unavailableExplanation(
  label: string,
  startTime: string,
  endTime: string,
  reasons: string[],
  leadIn: string,
): string {
  const full = `${label} is not available from ${startTime} to ${endTime}. ${leadIn}${joinReasons(reasons)}.`;
  if (full.length <= MAX_EXPLANATION_LENGTH) {
    return full;
  }
  return `${label} is not available for the selected interval. ${SUMMARY_SUFFIX}`;
}

export function buildFallbackExplanation(request: ExplanationRequest): string {
  const label = cleanText(request.roomLabel);
  const { startTime, endTime, result } = request;
  if (result.available) {
    return `${label} is available from ${startTime} to ${endTime} according to the booking rules.`;
  }
  return unavailableExplanation(label, startTime, endTime, result.reasons, 'Reasons: ');
}

// Deep copy of an explanation request. Strings are immutable, so copying the
// nested result object and reasons array fully isolates the copy.
export function cloneExplanationRequest(request: ExplanationRequest): ExplanationRequest {
  return {
    roomLabel: request.roomLabel,
    startTime: request.startTime,
    endTime: request.endTime,
    result: {
      available: request.result.available,
      reasons: [...request.result.reasons],
    },
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Explanation timed out.')), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

// Never throws: every failure mode resolves to a deterministic fallback.
export async function requestExplanation(
  request: ExplanationRequest,
  adapter: ExplainAdapter,
  options: { timeoutMs?: number } = {},
): Promise<ExplanationOutcome> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const requestError = validateExplanationRequest(request);
  if (requestError) {
    return { explanation: '', usedFallback: true, failureReason: requestError };
  }

  // Private snapshot for validation and fallback, plus a separate copy for
  // the adapter, so a mutating adapter can never corrupt either.
  const snapshot = cloneExplanationRequest(request);
  const adapterRequest = cloneExplanationRequest(snapshot);

  try {
    const response = await withTimeout(Promise.resolve(adapter(adapterRequest)), timeoutMs);
    const responseError = validateAdapterResponse(response, snapshot);
    if (responseError) {
      return {
        explanation: buildFallbackExplanation(snapshot),
        usedFallback: true,
        failureReason: responseError,
      };
    }
    return { explanation: (response as ExplanationResponse).explanation.trim(), usedFallback: false };
  } catch (error) {
    return {
      explanation: buildFallbackExplanation(snapshot),
      usedFallback: true,
      failureReason: error instanceof Error ? error.message : 'Adapter failed.',
    };
  }
}

// Mock mode: controlled wording derived only from the supplied facts.
// No external model, no network requests, no API keys, no cost.
export const mockExplainAdapter: ExplainAdapter = async (request) => {
  const label = cleanText(request.roomLabel);
  const { startTime, endTime, result } = request;
  if (result.available) {
    return {
      explanation: `${label} is available from ${startTime} to ${endTime}. All booking rules were satisfied.`,
    };
  }
  return {
    explanation: unavailableExplanation(label, startTime, endTime, result.reasons, 'Rule check failed: '),
  };
};
