// @vitest-environment jsdom
// Assignment 05 — regression tests written BEFORE the fixes (step 3).
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import App from '@/App';
import { checkAvailability } from '@/bookingLogic';
import { rooms } from '@/sampleData';

// ─── Bug A: stale availability result after quick-duration change ────────────

describe('Bug A — stale result after +120m quick duration', () => {
  it('clears the old Available result when +120m changes the end time', async () => {
    render(<App />);

    // Select Engineering Lab
    fireEvent.click(screen.getByText('Engineering Lab'));

    const getByLabel = (text: RegExp) => screen.getByLabelText(text) as HTMLInputElement;

    // Set Current Time 07:00, Start 09:00, End 10:00
    const currentInput = getByLabel(/current time/i);
    const startInput = getByLabel(/^start$/i);
    const endInput = getByLabel(/^end$/i);
    fireEvent.change(currentInput, { target: { value: '07:00' } });
    fireEvent.change(startInput, { target: { value: '09:00' } });
    fireEvent.change(endInput, { target: { value: '10:00' } });

    // Check availability -> Available (09:00–10:00, after 07:00, before the 10:00 booking)
    fireEvent.click(screen.getByRole('button', { name: /check availability/i }));
    expect(await screen.findByText('Available')).toBeInTheDocument();

    // Click +120m — End becomes 11:00, which overlaps 10:00–12:00.
    fireEvent.click(screen.getByRole('button', { name: /^\+120m$/ }));

    // The old Available result must disappear (bug A: it currently stays).
    expect(screen.queryByText('Available')).not.toBeInTheDocument();

    // Check again -> Unavailable because of the 10:00–12:00 booking
    fireEvent.click(screen.getByRole('button', { name: /check availability/i }));
    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Overlaps with "Robotics Workshop"/i)).toBeInTheDocument();
  });
});

// ─── Bug B: out-of-range currentTime is accepted ─────────────────────────────

describe('Bug B — invalid current time must be rejected', () => {
  const room = rooms[0];

  it('rejects currentTime = -1 with the documented reason', () => {
    const result = checkAvailability(room, 780, 840, -1, []);
    expect(result.available).toBe(false);
    expect(result.reasons).toContain('Current time must be between 00:00 and 24:00.');
  });

  it('rejects currentTime = 1441 with the documented reason', () => {
    const result = checkAvailability(room, 780, 840, 1441, []);
    expect(result.available).toBe(false);
    expect(result.reasons).toContain('Current time must be between 00:00 and 24:00.');
  });
});
