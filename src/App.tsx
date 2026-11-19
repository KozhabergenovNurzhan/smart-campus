import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Building2, Clock, Users, CheckCircle2, XCircle,
  Search, Ban, AlertTriangle, MapPin, RotateCcw, CalendarClock, Sparkles,
} from 'lucide-react';
import type { AvailabilityResult } from '@/types';
import { rooms, bookings } from '@/sampleData';
import {
  checkAvailability, timeToMinutes, minutesToTime,
  formatTimeRange, MAX_BOOKING_DURATION,
} from '@/bookingLogic';
import { Timeline } from '@/components/Timeline';
import {
  mockExplainAdapter,
  requestExplanation,
  type ExplainAdapter,
  type ExplanationOutcome,
} from '@/explanationService';

function App({ explainAdapter = mockExplainAdapter }: { explainAdapter?: ExplainAdapter } = {}) {
  const now = new Date();
  const initialTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentTimeStr, setCurrentTimeStr] = useState(initialTimeStr);
  const [startTimeStr, setStartTimeStr] = useState('');
  const [endTimeStr, setEndTimeStr] = useState('');
  const [result, setResult] = useState<AvailabilityResult | null>(null);
  const [explanation, setExplanation] = useState<ExplanationOutcome | null>(null);
  const [explaining, setExplaining] = useState(false);
  const explainSeqRef = useRef(0);

  // Invalidate the explanation whenever inputs or the checked result change.
  useEffect(() => {
    explainSeqRef.current += 1;
    setExplanation(null);
    setExplaining(false);
  }, [selectedRoomId, currentTimeStr, startTimeStr, endTimeStr, result]);

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [selectedRoomId]
  );
  const currentTime = timeToMinutes(currentTimeStr);
  const proposedStart = startTimeStr ? timeToMinutes(startTimeStr) : null;
  const proposedEnd = endTimeStr ? timeToMinutes(endTimeStr) : null;
  const roomBookings = useMemo(
    () => (selectedRoom ? bookings.filter((b) => b.roomId === selectedRoom.id) : []),
    [selectedRoom]
  );

  const canCheck = selectedRoom !== null && startTimeStr !== '' && endTimeStr !== '' && currentTimeStr !== '';

  const handleCheck = () => {
    if (!selectedRoom || proposedStart === null || proposedEnd === null) return;
    setResult(checkAvailability(selectedRoom, proposedStart, proposedEnd, currentTime, bookings));
  };

  const handleReset = () => {
    setSelectedRoomId(null);
    setStartTimeStr('');
    setEndTimeStr('');
    setResult(null);
    setExplanation(null);
  };

  const handleExplain = async () => {
    if (!selectedRoom || !result || explaining) return;
    const seq = ++explainSeqRef.current;
    setExplaining(true);
    const outcome = await requestExplanation(
      {
        roomLabel: selectedRoom.name,
        startTime: startTimeStr,
        endTime: endTimeStr,
        result,
      },
      explainAdapter,
    );
    // Ignore late responses from superseded requests.
    if (seq === explainSeqRef.current) {
      setExplanation(outcome);
      setExplaining(false);
    }
  };

  const setQuickDuration = (minutes: number) => {
    if (!startTimeStr) return;
    const start = timeToMinutes(startTimeStr);
    const end = Math.min(start + minutes, 1440);
    setEndTimeStr(minutesToTime(end));
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Smart Campus</h1>
            <p className="text-xs sm:text-sm text-slate-500">Room Availability Checker</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left column: controls */}
          <div className="lg:col-span-5 space-y-6 min-w-0">
            {/* Room selection */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                Select a Room
              </h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {rooms.map((room) => {
                  const isSelected = selectedRoomId === room.id;
                  return (
                    <button
                      key={room.id}
                      onClick={() => { setSelectedRoomId(room.id); setResult(null); }}
                      className={`text-left rounded-xl border p-3 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 leading-tight break-words">{room.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5 break-words">{room.building}</p>
                        </div>
                        {room.blocked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            <Ban className="w-3 h-3" />
                            Blocked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                        <Users className="w-3.5 h-3.5" />
                        <span>{room.capacity} seats</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Time configuration */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
              <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Booking Time
              </h2>

              {/* Current time */}
              <div className="mb-4">
                <label htmlFor="input-current-time" className="text-xs font-medium text-slate-600 mb-1.5 block">Current Time</label>
                <input
                  id="input-current-time"
                  type="time"
                  value={currentTimeStr}
                  onChange={(e) => { setCurrentTimeStr(e.target.value); setResult(null); }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Start & End time */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="input-start-time" className="text-xs font-medium text-slate-600 mb-1.5 block">Start</label>
                  <input
                    id="input-start-time"
                    type="time"
                    value={startTimeStr}
                    onChange={(e) => { setStartTimeStr(e.target.value); setResult(null); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="input-end-time" className="text-xs font-medium text-slate-600 mb-1.5 block">End</label>
                  <input
                    id="input-end-time"
                    type="time"
                    value={endTimeStr}
                    onChange={(e) => { setEndTimeStr(e.target.value); setResult(null); }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Quick duration buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[30, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setQuickDuration(mins)}
                    disabled={!startTimeStr}
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    +{mins}m
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-400 mb-4">
                Maximum booking duration is {MAX_BOOKING_DURATION} minutes. Touching endpoints are allowed.
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleCheck}
                  disabled={!canCheck}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Search className="w-4 h-4" />
                  Check Availability
                </button>
                <button
                  onClick={handleReset}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </section>

            {/* Result banner */}
            {result && (
              <section
                className={`rounded-2xl border p-5 ${
                  result.available ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.available ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <h3 className={`font-bold text-base ${result.available ? 'text-emerald-900' : 'text-red-900'}`}>
                      {result.available ? 'Available' : 'Unavailable'}
                    </h3>
                    {result.available ? (
                      <p className="text-sm text-emerald-700 mt-1">
                        {selectedRoom?.name} is available from {minutesToTime(proposedStart!)} to {minutesToTime(proposedEnd!)}.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {result.reasons.map((reason, i) => (
                          <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                            <span className="break-words">{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Explain availability */}
                <div className="mt-4 pt-4 border-t border-slate-200/60">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleExplain}
                      disabled={explaining}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      {explaining ? 'Explaining…' : 'Explain availability'}
                    </button>
                  </div>
                  {explanation && (
                    <div className="mt-3 rounded-lg bg-white/80 border border-slate-200 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                        {explanation.usedFallback ? 'Explanation — mock AI · Fallback explanation' : 'Explanation — mock AI'}
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed break-words">{explanation.explanation}</p>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          {/* Right column: visualization */}
          <div className="lg:col-span-7 space-y-6 min-w-0">
            {/* Timeline */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-blue-600" />
                  Daily Schedule
                </h2>
                {selectedRoom && (
                  <span className="text-xs font-medium text-slate-500">{selectedRoom.name}</span>
                )}
              </div>

              {!selectedRoom ? (
                <div className="h-32 flex items-center justify-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  Select a room to view its schedule
                </div>
              ) : (
                <>
                  {selectedRoom.blocked && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <Ban className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-red-700 font-medium">{selectedRoom.blockedReason}</span>
                    </div>
                  )}
                  <Timeline
                    room={selectedRoom}
                    bookings={bookings}
                    proposedStart={proposedStart}
                    proposedEnd={proposedEnd}
                    currentTime={currentTime}
                    isAvailable={result?.available ?? null}
                  />
                  <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-blue-500/85" />
                      Existing booking
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded border-2 border-dashed border-slate-400" />
                      Proposed slot
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-500" />
                      Current time
                    </span>
                  </div>
                </>
              )}
            </section>

            {/* Existing bookings list */}
            {selectedRoom && (
              <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-4">
                  Existing Bookings ({roomBookings.length})
                </h2>
                {roomBookings.length === 0 ? (
                  <p className="text-sm text-slate-400">No existing bookings for this room.</p>
                ) : (
                  <div className="space-y-2">
                    {[...roomBookings]
                      .sort((a, b) => a.start - b.start)
                      .map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{booking.title}</p>
                            <p className="text-xs text-slate-500 tabular-nums">
                              {formatTimeRange(booking.start, booking.end)}
                            </p>
                          </div>
                          <span className="text-xs text-slate-400 whitespace-nowrap tabular-nums">
                            {booking.end - booking.start} min
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
