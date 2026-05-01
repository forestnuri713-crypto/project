import { RecurrenceFrequency, RecurrenceInputDto } from './dto/admin-create-program.dto';

const MAX_OCCURRENCES = 200;

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`잘못된 시간 형식: ${hhmm}`);
  }
  return { hour: h, minute: m };
}

function combine(date: Date, hhmm: string): Date {
  const { hour, minute } = parseTime(hhmm);
  const d = new Date(date);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

export function expandRecurrence(
  rec: RecurrenceInputDto,
): { startAt: Date; endAt: Date | null }[] {
  const start = new Date(`${rec.startDate}T00:00:00.000Z`);
  const limit = rec.endDate ? new Date(`${rec.endDate}T23:59:59.999Z`) : null;
  const maxCount = rec.count ?? MAX_OCCURRENCES;

  const occurrences: Date[] = [];

  if (rec.frequency === RecurrenceFrequency.WEEKLY) {
    const days = (rec.daysOfWeek ?? [start.getUTCDay()]).slice().sort();
    if (days.length === 0) {
      throw new Error('주간 반복은 최소 1개 요일 필요');
    }
    let cursor = new Date(start);
    while (occurrences.length < maxCount) {
      for (const dow of days) {
        const dayDiff = (dow - cursor.getUTCDay() + 7) % 7;
        const candidate = addDays(cursor, dayDiff);
        if (limit && candidate > limit) break;
        if (candidate >= start) {
          occurrences.push(candidate);
          if (occurrences.length >= maxCount) break;
        }
      }
      cursor = addDays(cursor, 7);
      if (limit && cursor > limit) break;
      if (occurrences.length === 0 && cursor.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
        break;
      }
    }
  } else {
    const day = rec.dayOfMonth ?? start.getUTCDate();
    if (day < 1 || day > 28) {
      throw new Error('월간 반복은 1~28일 사이 일자만 지원됩니다');
    }
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
    if (cursor < start) cursor = addMonths(cursor, 1);
    while (occurrences.length < maxCount) {
      if (limit && cursor > limit) break;
      occurrences.push(new Date(cursor));
      cursor = addMonths(cursor, 1);
    }
  }

  return occurrences.map((dateOnly) => ({
    startAt: combine(dateOnly, rec.startTime),
    endAt: rec.endTime ? combine(dateOnly, rec.endTime) : null,
  }));
}
