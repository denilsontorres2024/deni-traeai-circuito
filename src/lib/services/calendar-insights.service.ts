import { startOfDay } from "date-fns";

import { upsertCalendarInsight } from "@/lib/services/data-service";

interface CalendarEventInput {
  title: string;
  start: string;
  end: string;
  recurring?: boolean;
}

export function buildCalendarInsight(events: CalendarEventInput[]) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  let longMeetings = 0;
  let consecutiveMeetings = 0;
  let seatedMinutes = 0;
  let freeMinutes = 0;

  sorted.forEach((event, index) => {
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();
    const durationMinutes = Math.max(0, Math.round((end - start) / 60000));

    if (durationMinutes >= 45) longMeetings += 1;
    seatedMinutes += durationMinutes;

    const next = sorted[index + 1];
    if (next) {
      const gap = Math.round((new Date(next.start).getTime() - end) / 60000);
      if (gap <= 10) consecutiveMeetings += 1;
      if (gap > 10) freeMinutes += gap;
    }
  });

  return {
    longMeetings,
    consecutiveMeetings,
    seatedMinutes,
    freeMinutes,
    summary:
      seatedMinutes > 240
        ? "Dia com carga sedentaria elevada e necessidade de pausas ativas."
        : "Carga de reunioes administravel, com oportunidades para pausas curtas.",
    rawCalendar: {
      totalEvents: sorted.length,
      events: sorted,
    },
  };
}

export async function syncCalendarInsight(events: CalendarEventInput[]) {
  const insight = buildCalendarInsight(events);

  return upsertCalendarInsight({
    insight_date: startOfDay(new Date()).toISOString().slice(0, 10),
    long_meetings: insight.longMeetings,
    consecutive_meetings: insight.consecutiveMeetings,
    seated_minutes: insight.seatedMinutes,
    free_minutes: insight.freeMinutes,
    summary: insight.summary,
    raw_calendar: insight.rawCalendar,
  });
}
