import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { InstructorSettingsClient } from './InstructorSettingsClient';
import {
  getInstructorById,
  getPricingFormulaSettings,
  getWritingPackages,
  getPublicInstructorById,
} from '@/data/domains/writing';
import { getSiteSettings } from '@/data/domains/content';
import { getMyInstructorId } from '@/data/domains/services';

export const dynamic = 'force-dynamic';

export default async function InstructorSettingsPage() {
  // This page used to load a hard-coded instructor ('inst-1') and fake pricing
  // data, so every instructor saw the same sample profile.
  const instructorId = await getMyInstructorId();
  if (!instructorId) return null;

  const [instructor, formulaSettings, settings, allPackages, publicRow] = await Promise.all([
    getInstructorById(instructorId),
    getPricingFormulaSettings(),
    getSiteSettings(),
    getWritingPackages(),
    // ⚠️ نفس المصدر اللي معالج الحجز بيقرا منه — مصدرين لنفس الرقم
    //    بيفترقوا يوم ما.
    getPublicInstructorById(instructorId),
  ]);

  const packages = allPackages.filter((p) => p.isActive !== false);

  if (!instructor) return null;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader
        title="إعدادات العمل والجدول"
        backHref="/dashboard/instructor"
      />

      <InstructorSettingsClient
        instructor={instructor}
        formulaSettings={formulaSettings}
        priceAlert={settings.instructorPriceAlert}
        packages={packages.map((p) => ({
          id: p.id,
          name: p.name,
          track: p.track ?? null,
          ageGroup: p.ageGroup,
          sessionsCount: p.sessionsCount ?? null,
        }))}
        selectedPackageIds={publicRow?.packageIds ?? []}
      />
    </div>
  );
}
