import { redirect } from 'next/navigation';

/**
 * الصفحة القديمة «صور المدربين» — المراجعة بقت كلها (ملف + صور) في
 * «مراجعة ملفات المدربين». التحويل عشان أي رابط أو إشعار قديم يوصل.
 */
export default function Page() {
  redirect('/dashboard/admin/instructors/review');
}
