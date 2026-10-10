import 'server-only';
import { compareAsc, differenceInYears, isBefore, isValid, parseISO } from 'date-fns';
import { cairoParts } from '@/lib/timezone';
import type { ChildProfile, CourseSubscription, PublicInstructor, SessionWithDetails, WritingPackage } from '@/types';
import type { QueryResult } from '@/data/query-result';
import { getFamilyMembers } from './family';
import { getCourseSubscriptions, getSessions, getWritingPackages, getPublicInstructors, getStudentDocuments } from './writing';
import { getMySessionChange, type SessionChangeRow } from './session-change-requests';

type FollowUpSession = SessionWithDetails & { packageName: string; instructorName?: string };
type FollowUpSubscription = CourseSubscription & { packageName: string; sessionCount: number; completedSessions: number };
type FollowUpDocument = { id: string; status: string };

export interface DependentFollowUpData {
  child: ChildProfile;
  subscriptions: FollowUpSubscription[];
  sessions: FollowUpSession[];
  documents: FollowUpDocument[];
  nextSession: FollowUpSession | null;
  nextChange: SessionChangeRow | null;
  age: number | null;
  reviewed: number;
  asOf: string;
}

type FollowUpInput = {
  child: ChildProfile;
  subscriptions: CourseSubscription[];
  sessions: SessionWithDetails[];
  packages: WritingPackage[];
  instructors: PublicInstructor[];
  documents: FollowUpDocument[];
};

/** Pure transformation: the request clock is an explicit input, not read during rendering. */
export function buildDependentFollowUpData(input: FollowUpInput, now: Date): DependentFollowUpData {
  const { child, documents } = input;
  const packageNames = new Map(input.packages.map((item) => [item.id, item.name]));
  const instructorNames = new Map(input.instructors.map((item) => [item.id, item.displayName]));
  const childSubscriptions = input.subscriptions.filter((sub) => sub.childId === child.id);
  const subscriptionIds = new Set(childSubscriptions.map((sub) => sub.id));
  const sessions = input.sessions
    .filter((session) => subscriptionIds.has(session.courseSubscriptionId))
    .map((session) => ({
      ...session,
      packageName: session.packageName ?? packageNames.get(session.packageId) ?? 'باقة غير معروفة',
      instructorName: session.instructorId ? instructorNames.get(session.instructorId) : undefined,
    }))
    .sort((a, b) => compareAsc(parseISO(a.scheduledAt), parseISO(b.scheduledAt)));

  const progress = new Map<string, { sessionCount: number; completedSessions: number }>();
  for (const session of sessions) {
    const counts = progress.get(session.courseSubscriptionId) ?? { sessionCount: 0, completedSessions: 0 };
    counts.sessionCount++;
    if (session.status === 'completed') counts.completedSessions++;
    progress.set(session.courseSubscriptionId, counts);
  }
  const subscriptions = childSubscriptions.map((sub) => ({
    ...sub,
    packageName: packageNames.get(sub.packageId) ?? 'باقة غير معروفة',
    ...(progress.get(sub.id) ?? { sessionCount: 0, completedSessions: 0 }),
  }));
  const nextSession = sessions.find((session) => {
    const scheduledAt = parseISO(session.scheduledAt);
    return session.status !== 'cancelled' && session.status !== 'completed' &&
      isValid(scheduledAt) && !isBefore(scheduledAt, now);
  }) ?? null;

  // Age is a calendar value in Cairo, not the deployment machine's timezone.
  const todayParts = cairoParts(now);
  const today = parseISO(`${todayParts.year}-${String(todayParts.month).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`);
  const birthDate = child.birthDate ? parseISO(child.birthDate) : null;
  const age = birthDate && isValid(birthDate) && !isBefore(today, birthDate)
    ? differenceInYears(today, birthDate)
    : null;

  return { child, subscriptions, sessions, documents, nextSession, nextChange: null, age,
    reviewed: documents.filter((doc) => doc.status === 'reviewed').length,
    asOf: now.toISOString() };
}

export async function getDependentFollowUpData(
  childId: string,
): Promise<QueryResult<DependentFollowUpData, 'NOT_FOUND' | 'LOAD_FAILED'>> {
  try {
    // Authorize before loading the child's portfolio or any related records.
    const family = await getFamilyMembers({ throwOnError: true });
    const child = family.find((member) => member.id === childId);
    if (!child) return { success: false, error: { code: 'NOT_FOUND', message: 'الطفل غير موجود.' } };

    const options = { throwOnError: true };
    const [subscriptions, sessions, packages, instructors, documents] = await Promise.all([
      getCourseSubscriptions(options),
      getSessions(options),
      getWritingPackages(options),
      getPublicInstructors(options),
      child.accountProfileId ? getStudentDocuments(child.accountProfileId, options) : Promise.resolve([]),
    ]);
    const data = buildDependentFollowUpData({ child, subscriptions, sessions, packages, instructors,
      documents: documents.map((doc) => ({ id: doc.id, status: doc.status })) }, new Date());
    if (data.nextSession) data.nextChange = await getMySessionChange(data.nextSession.id, options);
    return { success: true, data };
  } catch {
    console.error('Dependent follow-up query failed');
    return { success: false, error: { code: 'LOAD_FAILED', message: 'تعذّر تحميل بيانات المتابعة. جرّب تاني.' } };
  }
}
