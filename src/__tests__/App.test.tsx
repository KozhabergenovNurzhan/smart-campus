// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import App from '@/App';

afterEach(() => cleanup());

describe('App — room selection', () => {
  it('renders the single room from sampleData', () => {
    render(<App />);
    expect(screen.getByText('Engineering Lab')).toBeInTheDocument();
  });

  it('does not render rooms that are not in the fixture', () => {
    render(<App />);
    expect(screen.queryByText('Computer Lab')).not.toBeInTheDocument();
    expect(screen.queryByText('Seminar Room')).not.toBeInTheDocument();
    expect(screen.queryByText('Lecture Hall')).not.toBeInTheDocument();
  });

  it('shows room capacity', () => {
    render(<App />);
    expect(screen.getByText('40 seats')).toBeInTheDocument();
  });
});

describe('App — label accessibility', () => {
  it('associates the Current Time label with its input via htmlFor/id', () => {
    render(<App />);
    const label = screen.getByText('Current Time');
    expect(label).toHaveAttribute('for', 'input-current-time');
    expect(document.getElementById('input-current-time')).not.toBeNull();
  });

  it('associates the Start label with its input via htmlFor/id', () => {
    render(<App />);
    const label = screen.getByText('Start');
    expect(label).toHaveAttribute('for', 'input-start-time');
    expect(document.getElementById('input-start-time')).not.toBeNull();
  });

  it('associates the End label with its input via htmlFor/id', () => {
    render(<App />);
    const label = screen.getByText('End');
    expect(label).toHaveAttribute('for', 'input-end-time');
    expect(document.getElementById('input-end-time')).not.toBeNull();
  });
});

describe('App — availability check flow', () => {
  it('disables Check Availability until a room and both times are set', () => {
    render(<App />);
    const checkBtn = screen.getByRole('button', { name: /check availability/i });
    expect(checkBtn).toBeDisabled();
  });

  it('enables Check Availability after selecting room and setting times', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Engineering Lab'));

    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;
    await user.type(startInput, '13:00');
    await user.type(endInput, '14:00');

    const checkBtn = screen.getByRole('button', { name: /check availability/i });
    expect(checkBtn).toBeEnabled();
  });

  it('shows Available result for a non-overlapping slot', async () => {
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

    expect(await screen.findByText('Available')).toBeInTheDocument();
  });

  it('shows Unavailable result for an overlapping slot', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Engineering Lab'));

    const currentInput = document.getElementById('input-current-time') as HTMLInputElement;
    const startInput = document.getElementById('input-start-time') as HTMLInputElement;
    const endInput = document.getElementById('input-end-time') as HTMLInputElement;

    await user.clear(currentInput);
    await user.type(currentInput, '07:00');
    // 10:00–11:00 overlaps with existing "Thermodynamics 101" (08:00–09:00)? No.
    // Robotics Workshop is 10:00–12:00 (600–720). 10:30–11:30 overlaps.
    await user.type(startInput, '10:30');
    await user.type(endInput, '11:30');

    await user.click(screen.getByRole('button', { name: /check availability/i }));

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Overlaps/)).toBeInTheDocument();
  });
});

describe('App — existing bookings list', () => {
  it('shows all 3 existing bookings after selecting a room', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Engineering Lab'));

    const bookingsSection = screen.getByText(/Existing Bookings/).closest('section')!;
    expect(within(bookingsSection).getByText('Thermodynamics 101')).toBeInTheDocument();
    expect(within(bookingsSection).getByText('Robotics Workshop')).toBeInTheDocument();
    expect(within(bookingsSection).getByText('Office Hours')).toBeInTheDocument();
  });

  it('shows the booking count as 3', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('Engineering Lab'));
    expect(screen.getByText('Existing Bookings (3)')).toBeInTheDocument();
  });
});

describe('App — reset', () => {
  it('clears the result banner when Reset is clicked', async () => {
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
    expect(await screen.findByText('Available')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });
});
