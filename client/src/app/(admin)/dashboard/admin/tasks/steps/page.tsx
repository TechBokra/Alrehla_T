import { redirect } from 'next/navigation';

/** اتدمجت في «سير العمل والتوزيع» — الرابط القديم بيحوّل للصفحة الجديدة. */
export default function Page() {
  redirect('/dashboard/admin/tasks/workflow');
}
