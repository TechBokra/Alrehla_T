import { BookedSlot, DayOfWeek } from '@/types';
import { createClient } from '@/lib/supabase/server';
import { cairoParts } from '@/lib/timezone';


export async function getBookedSlotsByInstructor(
  instructorIds: string[],
): Promise<Record<string, BookedSlot[]>> {
  const result: Record<string, BookedSlot[]> = {};
  if (instructorIds.length === 0) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('instructor_id, scheduled_at, status')
    .in('instructor_id', instructorIds)
    .gte('scheduled_at', new Date().toISOString())
    .neq('status', 'cancelled');

  if (error || !data) return result;

  const DAYS: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];

  // (المدرب، اليوم، الساعة) ← أبعد جلسة
  const latest = new Map<string, { instructorId: string; slot: BookedSlot }>();

  for (const row of data) {
    if (!row.instructor_id) continue;
    const at = new Date(row.scheduled_at);
    if (Number.isNaN(at.getTime())) continue;

    const p = cairoParts(at);
    const day = DAYS[p.weekday];
    const time = `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
    const key = `${row.instructor_id}|${day}|${time}`;

    const current = latest.get(key);
    if (!current || new Date(current.slot.bookedUntil) < at) {
      latest.set(key, {
        instructorId: row.instructor_id,
        slot: { day, time, bookedUntil: at.toISOString() },
      });
    }
  }

  for (const { instructorId, slot } of latest.values()) {
    (result[instructorId] ??= []).push(slot);
  }

  return result;
}
