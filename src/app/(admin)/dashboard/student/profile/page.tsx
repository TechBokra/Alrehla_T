import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getDependentGuardian } from '@/lib/auth-guard';
import { LogoutButton } from '@/components/LogoutButton';
import { StudentProfileClient } from './StudentProfileClient';
import { PasswordChangeForm } from '@/app/(client)/account/settings/PasswordChangeForm';

export const dynamic = 'force-dynamic';

/**
 * The profile and account security settings.
 */
export default async function StudentProfilePage() {
  const user = await getCurrentUser();
  const dependent = await getDependentGuardian(user.id);
  const isDependent = Boolean(dependent);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 sm:px-6 py-8 md:py-12 space-y-8">
      <DashboardPageHeader
        title={isDependent ? 'حساب الطالب — الملف الشخصي' : 'حساب مستخدم — الملف الشخصي وإعدادات الحساب'}
        backHref="/dashboard/student"
      />

      <StudentProfileClient
        fullName={user.fullName}
        email={user.email}
        avatarUrl={user.avatarUrl ?? ''}
        isDependent={isDependent}
      />

      <PasswordChangeForm />

      <div className="mt-8 flex justify-end border-t border-slate-200 pt-6">
        <LogoutButton />
      </div>
    </div>
  );
}
