// Pure date calculations shared by server data models and client UI.
import { compareAsc, compareDesc, differenceInYears, isBefore, isSameDay, isValid, parseISO } from 'date-fns';
import { cairoParts } from './timezone';

export function calendarDate(date: Date): Date {
  const p = cairoParts(date);
  return parseISO(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`);
}
export function dateKey(timestamp: number): string {
  const p = cairoParts(new Date(timestamp));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
export function isTodayAt(value: string, timestamp: number): boolean {
  const date = parseISO(value);
  return isValid(date) && isSameDay(calendarDate(date), calendarDate(new Date(timestamp)));
}
export function ageAtTime(birthDate: string | null | undefined, timestamp: number): number | null {
  if (!birthDate) return null;
  const date = parseISO(birthDate);
  const today = calendarDate(new Date(timestamp));
  return isValid(date) && !isBefore(today, date) ? differenceInYears(today, date) : null;
}

export function groupSessionsAt<T extends { scheduledAt: string }>(rows: T[], timestamp: number) {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const row of rows) {
    const date = parseISO(row.scheduledAt);
    if (!isValid(date)) continue;
    (date.getTime() < timestamp ? past : upcoming).push(row);
  }
  upcoming.sort((a, b) => compareAsc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));
  past.sort((a, b) => compareDesc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));
  return { upcoming, past };
}
