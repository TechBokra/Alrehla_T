import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import {
  getInstructorById,
  getProfileUpdateRequestsByInstructor,
} from '@/data/domains/writing';
import { getMyInstructorId } from '@/data/domains/services';
import { LogoutButton } from '@/components/LogoutButton';
import { InstructorProfileClient } from './InstructorProfileClient';

export const dynamic = 'force-dynamic';

export default async function InstructorProfilePage() {
  const user = await getCurrentUser();

  // This page used to load a hard-coded instructor ('inst-1') and its save
  // button was wired to nothing at all, so no instructor could ever fill in
  // their own bio or specialties.
  const instructorId = await getMyInstructorId();
  const instructor = instructorId ? await getInstructorById(instructorId) : null;

  if (!instructor) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        <DashboardPageHeader title="الملف الشخصي" backHref="/dashboard/instructor" />
        <p className="rounded-2xl border border-slate-200 bg-white py-12 text-center font-medium text-slate-500">
          لم يتم العثور على ملف مدرب مرتبط بحسابك.
        </p>
      </div>
    );
  }

  const requests = await getProfileUpdateRequestsByInstructor(instructor.id);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الملف الشخصي" backHref="/dashboard/instructor" />

      <InstructorProfileClient
        instructor={instructor}
        email={user.email}
        avatarUrl={user.avatarUrl}
        hasPendingRequest={requests.some((r) => r.status === 'pending')}
      />

      <div className="mt-8 flex justify-end border-t border-slate-200 pt-8">
        <LogoutButton />
      </div>
    </div>
  );
}
