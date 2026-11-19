// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from '@/App';
import {
  requestExplanation,
  validateExplanationRequest,
  validateAdapterResponse,
  buildFallbackExplanation,
  mockExplainAdapter,
  countSentences,
  DEFAULT_TIMEOUT_MS,
  type ExplainAdapter,
  type ExplanationRequest,
} from '@/explanationService';
import type { AvailabilityResult } from '@/types';

afterEach(() => cleanup());

const AVAILABLE: AvailabilityResult = { available: true, reasons: [] };
const OVERLAP: AvailabilityResult = {
  available: false,
  reasons: ['Overlaps with "Robotics Workshop" (10:00 – 12:00).'],
};
const BLOCKED: AvailabilityResult = {
  available: false,
  reasons: ['This room is blocked: Under maintenance.'],
};
const REVERSED: AvailabilityResult = {
  available: false,
  reasons: ['End time must be after start time.'],
};
const PAST: AvailabilityResult = {
  available: false,
  reasons: ['Start time must be strictly after the current time (09:00).'],
};

function makeRequest(overrides: Partial<ExplanationRequest> = {}): ExplanationRequest {
  return {
    roomLabel: 'Engineering Lab',
    startTime: '13:00',
    endTime: '14:00',
    result: AVAILABLE,
    ...overrides,
  };
}

// ─── Service: request validation ─────────────────────────────────────────────

describe('validateExplanationRequest', () => {
  it('accepts a valid request', () => {
    expect(validateExplanationRequest(makeRequest())).toBeNull();
  });
  it('rejects a blank room label', () => {
    expect(validateExplanationRequest(makeRequest({ roomLabel: '   ' }))).toMatch(/non-empty/i);
  });
  it('rejects a missing room label', () => {
    expect(validateExplanationRequest(makeRequest({ roomLabel: undefined as unknown as string }))).toMatch(/non-empty/i);
  });
  it('rejects a room label over 100 characters', () => {
    expect(validateExplanationRequest(makeRequest({ roomLabel: 'R'.repeat(101) }))).toMatch(/at most 100/i);
  });
  it('accepts a room label of exactly 100 characters', () => {
    expect(validateExplanationRequest(makeRequest({ roomLabel: 'R'.repeat(100) }))).toBeNull();
  });
  it('rejects malformed start time', () => {
    expect(validateExplanationRequest(makeRequest({ startTime: '25:00' }))).toMatch(/HH:MM/i);
    expect(validateExplanationRequest(makeRequest({ startTime: '' }))).toMatch(/HH:MM/i);
  });
  it('rejects malformed end time', () => {
    expect(validateExplanationRequest(makeRequest({ endTime: 'ab:cd' }))).toMatch(/HH:MM/i);
  });
  it('rejects a result without a boolean status', () => {
    const bad = { available: 'yes', reasons: [] } as unknown as AvailabilityResult;
    expect(validateExplanationRequest(makeRequest({ result: bad }))).toMatch(/boolean/i);
  });
  it('rejects a result with non-array reasons', () => {
    const bad = { available: true, reasons: 'none' } as unknown as AvailabilityResult;
    expect(validateExplanationRequest(makeRequest({ result: bad }))).toMatch(/array/i);
  });
  it('rejects a result with non-string reasons', () => {
    const bad = { available: true, reasons: [42] } as unknown as AvailabilityResult;
    expect(validateExplanationRequest(makeRequest({ result: bad }))).toMatch(/non-empty string/i);
  });
  it('rejects a result with too many reasons', () => {
    const bad = { available: false, reasons: Array(11).fill('x') };
    expect(validateExplanationRequest(makeRequest({ result: bad }))).toMatch(/at most 10/i);
  });
  it('rejects a reason over 200 characters', () => {
    const bad = { available: false, reasons: ['r'.repeat(201)] };
    expect(validateExplanationRequest(makeRequest({ result: bad }))).toMatch(/at most 200/i);
  });
});

// ─── Service: adapter response validation ────────────────────────────────────

describe('validateAdapterResponse', () => {
  it('accepts a well-formed consistent response', () => {
    const resp = { explanation: 'The room is free at this time.' };
    expect(validateAdapterResponse(resp, makeRequest())).toBeNull();
  });
  it('rejects non-object responses', () => {
    expect(validateAdapterResponse('ok', makeRequest())).toMatch(/object/i);
  });
  it('rejects an empty explanation', () => {
    expect(validateAdapterResponse({ explanation: '  ' }, makeRequest())).toMatch(/not be empty/i);
  });
  it('rejects explanations over 500 characters', () => {
    expect(validateAdapterResponse({ explanation: 'x'.repeat(501) }, makeRequest())).toMatch(/at most 500/i);
  });
  it('rejects more than two sentences', () => {
    expect(
      validateAdapterResponse({ explanation: 'One. Two. Three.' }, makeRequest()),
    ).toMatch(/at most 2 sentences/i);
  });
  it('rejects a response contradicting the unavailable status', () => {
    const resp = { explanation: 'The room is available at this time.' };
    expect(validateAdapterResponse(resp, makeRequest({ result: OVERLAP }))).toMatch(/contradicts/i);
  });
});

// ─── Service: end-to-end behaviour ────────────────────────────────────────────

describe('requestExplanation', () => {
  it('returns the adapter explanation for an available slot', async () => {
    const outcome = await requestExplanation(makeRequest(), mockExplainAdapter);
    expect(outcome.usedFallback).toBe(false);
    expect(outcome.explanation).toMatch(/is available from 13:00 to 14:00/i);
  });

  it('preserves all reasons for an overlap result', async () => {
    const multi: AvailabilityResult = {
      available: false,
      reasons: ['Overlaps with "A" (10:00 – 11:00).', 'Booking duration is 150 minutes — maximum allowed is 120 minutes.'],
    };
    const outcome = await requestExplanation(makeRequest({ result: multi }), mockExplainAdapter);
    expect(outcome.usedFallback).toBe(false);
    expect(outcome.explanation).toContain('Overlaps with "A"');
    expect(outcome.explanation).toContain('maximum allowed is 120 minutes');
  });

  it('explains a reversed interval without rejecting the request', async () => {
    const outcome = await requestExplanation(
      makeRequest({ startTime: '14:00', endTime: '13:00', result: REVERSED }),
      mockExplainAdapter,
    );
    expect(outcome.usedFallback).toBe(false);
    expect(outcome.explanation).toContain('End time must be after start time');
  });

  it('explains a past-time rejection', async () => {
    const outcome = await requestExplanation(makeRequest({ result: PAST }), mockExplainAdapter);
    expect(outcome.usedFallback).toBe(false);
    expect(outcome.explanation).toContain('strictly after the current time');
  });

  it('explains a blocked-room result from a test-only fixture', async () => {
    const outcome = await requestExplanation(makeRequest({ result: BLOCKED }), mockExplainAdapter);
    expect(outcome.usedFallback).toBe(false);
    expect(outcome.explanation).toContain('blocked');
  });

  it('rejects malformed input before invoking the adapter', async () => {
    const adapter = vi.fn(mockExplainAdapter);
    const outcome = await requestExplanation(makeRequest({ roomLabel: '' }), adapter);
    expect(adapter).not.toHaveBeenCalled();
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.failureReason).toMatch(/non-empty/i);
  });

  it('returns the fallback on adapter failure', async () => {
    const failing: ExplainAdapter = async () => { throw new Error('network down'); };
    const outcome = await requestExplanation(makeRequest({ result: OVERLAP }), failing);
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.failureReason).toBe('network down');
    expect(outcome.explanation).toContain('not available');
    expect(outcome.explanation).toContain('Robotics Workshop');
  });

  it('returns the fallback on a malformed adapter response', async () => {
    const malformed: ExplainAdapter = async () => ({ explanation: 42 } as unknown as { explanation: string });
    const outcome = await requestExplanation(makeRequest(), malformed);
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.explanation).toContain('is available');
  });

  it('returns the fallback when the response contradicts the status', async () => {
    const contradictory: ExplainAdapter = async () => ({ explanation: 'The room is available.' });
    const outcome = await requestExplanation(makeRequest({ result: OVERLAP }), contradictory);
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.failureReason).toMatch(/contradicts/i);
    expect(outcome.explanation).toContain('not available');
  });

  it('times out and returns the fallback (fake timers)', async () => {
    vi.useFakeTimers();
    const never: ExplainAdapter = () => new Promise(() => { /* never settles */ });
    const pending = requestExplanation(makeRequest(), never, { timeoutMs: 50 });
    vi.advanceTimersByTime(51);
    const outcome = await pending;
    vi.useRealTimers();
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.failureReason).toMatch(/timed out/i);
    expect(outcome.explanation).toContain('according to the booking rules');
  });

  it('uses the documented default timeout when none is given', async () => {
    vi.useFakeTimers();
    let settled = false;
    const slow: ExplainAdapter = async () => {
      await new Promise((r) => setTimeout(r, DEFAULT_TIMEOUT_MS - 10));
      settled = true;
      return { explanation: 'Fine.' };
    };
    const pending = requestExplanation(makeRequest(), slow);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 10);
    const outcome = await pending;
    vi.useRealTimers();
    expect(settled).toBe(true);
    expect(outcome.usedFallback).toBe(false);
  });

  it('builds a deterministic fallback mentioning the room and reasons', () => {
    const text = buildFallbackExplanation(makeRequest({ result: OVERLAP }));
    expect(text).toContain('Engineering Lab');
    expect(text).toContain('13:00');
    expect(text).toContain('Robotics Workshop');
  });
});

// ─── Regression: F2 (adapter mutation) ───────────────────────────────────────

describe('requestExplanation — adapter mutation isolation (F2)', () => {
  const baseResult: AvailabilityResult = {
    available: false,
    reasons: ['Overlaps with "Robotics Workshop" (10:00 – 12:00).'],
  };

  it('does not let a mutating adapter corrupt the caller request or result', async () => {
    const request = makeRequest({ result: baseResult });
    const mutating: ExplainAdapter = async (req) => {
      req.result.available = true;
      req.result.reasons.length = 0;
      return { explanation: 'Fine.' };
    };
    const outcome = await requestExplanation(request, mutating);
    // Caller's objects unchanged
    expect(request.result.available).toBe(false);
    expect(request.result.reasons).toHaveLength(1);
    expect(outcome.usedFallback).toBe(false);
    expect(outcome.explanation).toBe('Fine.');
  });

  it('validates against the original status after mutation, then throws', async () => {
    const request = makeRequest({ result: baseResult });
    const mutatingThrow: ExplainAdapter = async (req) => {
      req.result.available = true;
      req.result.reasons = [];
      throw new Error('boom after mutation');
    };
    const outcome = await requestExplanation(request, mutatingThrow);
    expect(request.result.available).toBe(false);
    expect(request.result.reasons).toHaveLength(1);
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.failureReason).toBe('boom after mutation');
    // Fallback built from ORIGINAL facts, not the mutated ones
    expect(outcome.explanation).toContain('Overlaps with "Robotics Workshop"');
    expect(outcome.explanation).not.toContain('is available');
  });

  it('uses original reasons for the fallback after mutation and timeout', async () => {
    vi.useFakeTimers();
    const request = makeRequest({ result: baseResult });
    const mutatingSlow: ExplainAdapter = (req) => {
      req.result.available = true;
      req.result.reasons = ['invented'];
      return new Promise(() => { /* never settles */ });
    };
    const pending = requestExplanation(request, mutatingSlow, { timeoutMs: 50 });
    vi.advanceTimersByTime(51);
    const outcome = await pending;
    vi.useRealTimers();
    expect(request.result.available).toBe(false);
    expect(request.result.reasons).toEqual(['Overlaps with "Robotics Workshop" (10:00 – 12:00).']);
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.failureReason).toMatch(/timed out/i);
    expect(outcome.explanation).toContain('Overlaps with "Robotics Workshop"');
    expect(outcome.explanation).not.toContain('invented');
  });

  it('never passes the caller result object or snapshot to the adapter', async () => {
    const request = makeRequest({ result: baseResult });
    let received: ExplanationRequest | null = null;
    const spy: ExplainAdapter = async (req) => {
      received = req;
      return { explanation: 'Fine.' };
    };
    await requestExplanation(request, spy);
    expect(received).not.toBe(request);
    expect(received!.result).not.toBe(request.result);
    expect(received!.result.reasons).not.toBe(request.result.reasons);
    // Mutating the received copy does not affect the caller
    received!.result.available = true;
    received!.result.reasons.push('junk');
    expect(request.result.available).toBe(false);
    expect(request.result.reasons).toHaveLength(1);
  });
});

// ─── Regression: F1 (output limits on every path) ────────────────────────────

describe('requestExplanation — output limits (F1)', () => {
  // Worst case ACCEPTED input: 10 reasons of 190 chars each
  const worstReasons = Array.from({ length: 10 }, (_, i) => `Reason ${i} ${'x'.repeat(170)}.`);
  const worstResult: AvailabilityResult = { available: false, reasons: worstReasons };
  const worstRequest = (): ExplanationRequest => makeRequest({ result: worstResult });

  it('accepts the worst-case input (limits unchanged)', () => {
    expect(validateExplanationRequest(worstRequest())).toBeNull();
  });

  it('mock explanation stays within limits for the worst case', async () => {
    const mock = await mockExplainAdapter(worstRequest());
    expect(mock.explanation.length).toBeLessThanOrEqual(500);
    expect(mock.explanation.length).toBeGreaterThan(0);
    expect(countSentences(mock.explanation)).toBeLessThanOrEqual(2);
    // Accepted by the response validator (no self-rejection)
    expect(validateAdapterResponse(mock, worstRequest())).toBeNull();
  });

  it('fallback stays within limits for the worst case after adapter error', async () => {
    const failing: ExplainAdapter = async () => { throw new Error('down'); };
    const outcome = await requestExplanation(worstRequest(), failing);
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.explanation.length).toBeLessThanOrEqual(500);
    expect(countSentences(outcome.explanation)).toBeLessThanOrEqual(2);
    expect(outcome.explanation).toContain('See the confirmed reasons above');
    // Original reasons untouched
    expect(worstRequest().result.reasons).toHaveLength(10);
  });

  it('fallback stays within limits for the worst case after timeout', async () => {
    vi.useFakeTimers();
    const never: ExplainAdapter = () => new Promise(() => { /* never settles */ });
    const pending = requestExplanation(worstRequest(), never, { timeoutMs: 50 });
    vi.advanceTimersByTime(51);
    const outcome = await pending;
    vi.useRealTimers();
    expect(outcome.usedFallback).toBe(true);
    expect(outcome.explanation.length).toBeLessThanOrEqual(500);
    expect(countSentences(outcome.explanation)).toBeLessThanOrEqual(2);
  });

  it('fallback agrees with the unavailable status for long inputs', () => {
    const text = buildFallbackExplanation(worstRequest());
    expect(text).toContain('is not available');
    expect(text).not.toMatch(/\bis available\b/i);
  });

  it('handles maximum accepted room label and reason lengths within limits', () => {
    const maxRequest: ExplanationRequest = {
      roomLabel: 'R'.repeat(100),
      startTime: '13:00',
      endTime: '14:00',
      result: { available: false, reasons: ['r'.repeat(200)] },
    };
    expect(validateExplanationRequest(maxRequest)).toBeNull();
    const fallback = buildFallbackExplanation(maxRequest);
    expect(fallback.length).toBeLessThanOrEqual(500);
    const mock = mockExplainAdapter(maxRequest);
    return mock.then((m) => {
      expect(m.explanation.length).toBeLessThanOrEqual(500);
      expect(validateAdapterResponse(m, maxRequest)).toBeNull();
    });
  });

  it('keeps ordinary explanations informative when reasons fit', async () => {
    const outcome = await requestExplanation(makeRequest({ result: OVERLAP }), mockExplainAdapter);
    expect(outcome.usedFallback).toBe(false);
    expect(outcome.explanation).toContain('Overlaps with "Robotics Workshop"');
  });
});

// ─── UI integration ──────────────────────────────────────────────────────────

async function setupResult(user: UserEvent, result: AvailabilityResult) {
  render(<App />);
  await user.click(screen.getByText('Engineering Lab'));
  const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
  const startInput = document.getElementById('input-start-time') as HTMLInputElement;
  const endInput = document.getElementById('input-end-time') as HTMLInputElement;
  await user.clear(currentInput);
  await user.type(currentInput, '07:00');
  await user.type(startInput, start);
  await user.type(endInput, end);
  await user.click(screen.getByRole('button', { name: /check availability/i }));
  await screen.findByText(result.available ? 'Available' : 'Unavailable');
}
const start = '13:00', end = '14:00';

describe('App — Explain availability button', () => {
  it('hides the explain button until a result exists', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: /explain availability/i })).not.toBeInTheDocument();
  });

  it('shows a mock explanation for an available slot', async () => {
    const user = userEvent.setup();
    await setupResult(user, AVAILABLE);
    await user.click(screen.getByRole('button', { name: /explain availability/i }));
    await waitFor(() => expect(screen.getByText('Explanation — mock AI')).toBeInTheDocument());
    const panel = screen.getByText('Explanation — mock AI').closest('div')!;
    expect(within(panel).getByText(/is available from 13:00 to 14:00/i)).toBeInTheDocument();
    expect(screen.queryByText(/fallback explanation/i)).not.toBeInTheDocument();
  });

  it('shows a mock explanation for an overlap and keeps the status', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Engineering Lab'));
    const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;
    await user.clear(currentInput);
    await user.type(currentInput, '07:00');
    await user.type(startInput, '10:30');
    await user.type(endInput, '11:30');
    await user.click(screen.getByRole('button', { name: /check availability/i }));
    await screen.findByText('Unavailable');

    await user.click(screen.getByRole('button', { name: /explain availability/i }));
    await waitFor(() => expect(screen.getByText('Explanation — mock AI')).toBeInTheDocument());
    const panel = screen.getByText('Explanation — mock AI').closest('div')!;
    expect(within(panel).getByText(/Overlaps with "Robotics Workshop"/i)).toBeInTheDocument();
    // Original status unchanged after explaining
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('keeps explaining a reversed interval in the UI', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Engineering Lab'));
    const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;
    await user.clear(currentInput);
    await user.type(currentInput, '07:00');
    await user.type(startInput, '14:00');
    await user.type(endInput, '13:00');
    await user.click(screen.getByRole('button', { name: /check availability/i }));
    await screen.findByText('Unavailable');

    await user.click(screen.getByRole('button', { name: /explain availability/i }));
    await waitFor(() => expect(screen.getByText('Explanation — mock AI')).toBeInTheDocument());
    const panel = screen.getByText('Explanation — mock AI').closest('div')!;
    expect(within(panel).getByText(/End time must be after start time/i)).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('labels the fallback explanation when the adapter fails', async () => {
    const user = userEvent.setup();
    const failing: ExplainAdapter = async () => { throw new Error('boom'); };
    render(<App explainAdapter={failing} />);
    await user.click(screen.getByText('Engineering Lab'));
    const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;
    await user.clear(currentInput);
    await user.type(currentInput, '07:00');
    await user.type(startInput, '13:00');
    await user.type(endInput, '14:00');
    await user.click(screen.getByRole('button', { name: /check availability/i }));
    await screen.findByText('Available');

    await user.click(screen.getByRole('button', { name: /explain availability/i }));
    await waitFor(() => expect(screen.getByText(/fallback explanation/i)).toBeInTheDocument());
    expect(screen.getByText(/Explanation — mock AI/i)).toBeInTheDocument();
    expect(screen.getByText(/according to the booking rules/i)).toBeInTheDocument();
  });

  it('prevents repeated clicks while a request is pending', async () => {
    const user = userEvent.setup();
    let resolveAdapter!: (v: { explanation: string }) => void;
    const slow: ExplainAdapter = () => new Promise((resolve) => { resolveAdapter = resolve; });
    render(<App explainAdapter={slow} />);
    await user.click(screen.getByText('Engineering Lab'));
    const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;
    await user.clear(currentInput);
    await user.type(currentInput, '07:00');
    await user.type(startInput, '13:00');
    await user.type(endInput, '14:00');
    await user.click(screen.getByRole('button', { name: /check availability/i }));
    await screen.findByText('Available');

    const btn = screen.getByRole('button', { name: /explain/i });
    await user.click(btn);
    expect(btn).toBeDisabled();
    expect(screen.getByRole('button', { name: /explaining/i })).toBeInTheDocument();
    resolveAdapter({ explanation: 'Done.' });
    await waitFor(() => expect(screen.getByText('Done.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /explain availability/i })).toBeEnabled();
  });

  it('clears the explanation when the result changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Engineering Lab'));
    const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;
    await user.clear(currentInput);
    await user.type(currentInput, '07:00');
    await user.type(startInput, '13:00');
    await user.type(endInput, '14:00');
    await user.click(screen.getByRole('button', { name: /check availability/i }));
    await screen.findByText('Available');

    await user.click(screen.getByRole('button', { name: /explain availability/i }));
    await waitFor(() => expect(screen.getByText('Explanation — mock AI')).toBeInTheDocument());

    // Change an input — explanation must be invalidated
    await user.clear(startInput);
    await user.type(startInput, '13:30');
    expect(screen.queryByText('Explanation — mock AI')).not.toBeInTheDocument();
  });

  it('ignores a stale response so a newer result is not overwritten', async () => {
    const user = userEvent.setup();
    let resolveFirst!: (v: { explanation: string }) => void;
    let call = 0;
    const adapter: ExplainAdapter = () => {
      call += 1;
      if (call === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve({ explanation: 'Second explanation.' });
    };
    render(<App explainAdapter={adapter} />);
    await user.click(screen.getByText('Engineering Lab'));
    const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;
    await user.clear(currentInput);
    await user.type(currentInput, '07:00');
    await user.type(startInput, '13:00');
    await user.type(endInput, '14:00');
    await user.click(screen.getByRole('button', { name: /check availability/i }));
    await screen.findByText('Available');

    await user.click(screen.getByRole('button', { name: /explain availability/i }));
    // Input changes: invalidates the explanation and bumps the sequence
    await user.clear(startInput);
    await user.type(startInput, '13:15');
    await user.click(screen.getByRole('button', { name: /check availability/i }));
    await screen.findByText('Available');
    await user.click(screen.getByRole('button', { name: /explain availability/i }));
    await waitFor(() => expect(screen.getByText('Second explanation.')).toBeInTheDocument());

    // The stale first request finally resolves — it must not overwrite
    resolveFirst({ explanation: 'STALE EXPLANATION.' });
    await waitFor(() =>
      expect(screen.queryByText('STALE EXPLANATION.')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Second explanation.')).toBeInTheDocument();
  });
});
