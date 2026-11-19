import type { Booking, Room } from '@/types';
import { minutesToTime, formatTimeRange } from '@/bookingLogic';

interface TimelineProps {
  room: Room | null;
  bookings: Booking[];
  proposedStart: number | null;
  proposedEnd: number | null;
  currentTime: number;
  isAvailable: boolean | null;
}

const HOUR_MARKS = Array.from({ length: 25 }, (_, i) => i);

export function Timeline({ room, bookings, proposedStart, proposedEnd, currentTime, isAvailable }: TimelineProps) {
  const roomBookings = room ? bookings.filter((b) => b.roomId === room.id) : [];
  const showProposed = proposedStart !== null && proposedEnd !== null && proposedStart < proposedEnd;
  const pct = (mins: number) => `${(mins / 1440) * 100}%`;

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="min-w-[280px]">
        {/* Hour labels */}
        <div className="relative h-5 mb-1.5">
          {HOUR_MARKS.filter((h) => h % 2 === 0).map((h) => (
            <span
              key={h}
              className="absolute text-[10px] text-slate-400 tabular-nums -translate-x-1/2 select-none"
              style={{ left: pct(h * 60) }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {/* Timeline bar */}
        <div className="relative h-20 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden">
          {/* Hour gridlines */}
          {HOUR_MARKS.map((h) => (
            <div
              key={h}
              className="absolute top-0 bottom-0 w-px bg-slate-200/70"
              style={{ left: pct(h * 60) }}
            />
          ))}

          {/* Blocked room overlay */}
          {room?.blocked && (
            <div
              className="absolute inset-0 pointer-events-none rounded-xl"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(239,68,68,0.07) 8px, rgba(239,68,68,0.07) 16px)',
              }}
            />
          )}

          {/* Existing bookings */}
          {roomBookings.map((booking) => (
            <div
              key={booking.id}
              className="absolute top-2 bottom-2 rounded-lg bg-blue-500/85 px-2 flex items-center overflow-hidden text-white text-[11px] font-medium shadow-sm"
              style={{ left: pct(booking.start), width: pct(booking.end - booking.start) }}
              title={`${booking.title} — ${formatTimeRange(booking.start, booking.end)}`}
            >
              <span className="truncate">{booking.title}</span>
            </div>
          ))}

          {/* Proposed interval */}
          {showProposed && (
            <div
              className={`absolute top-0 bottom-0 rounded-lg border-2 flex items-center justify-center transition-colors ${
                isAvailable === false
                  ? 'border-red-400 bg-red-400/20'
                  : isAvailable === true
                  ? 'border-emerald-500 bg-emerald-500/20'
                  : 'border-slate-400 bg-slate-300/15 border-dashed'
              }`}
              style={{ left: pct(proposedStart!), width: pct(proposedEnd! - proposedStart!) }}
            >
              {isAvailable === null && (
                <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wide">Proposed</span>
              )}
            </div>
          )}

          {/* Current time marker */}
          {currentTime >= 0 && currentTime <= 1440 && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-amber-500 z-10" style={{ left: pct(currentTime) }}>
              <div className="absolute -top-1 -left-[3px] w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
            </div>
          )}
        </div>

        {/* Current time label */}
        {currentTime > 0 && currentTime < 1440 && (
          <div className="relative h-5 mt-1.5">
            <span
              className="absolute text-[10px] text-amber-600 font-semibold tabular-nums -translate-x-1/2 select-none whitespace-nowrap"
              style={{ left: pct(currentTime) }}
            >
              Now {minutesToTime(currentTime)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
