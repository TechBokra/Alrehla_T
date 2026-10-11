import { notFound } from 'next/navigation';
import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getAllUsers, getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission } from '@/lib/utils';
import { getChildrenAgeData } from '@/data/domains/dashboard-time';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { createClient } from '@/lib/supabase/server';
import { ChildProfile } from '@/types';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageUsers')) {
    return <Unauthorized />;
  }
  
  const { id } = await params;
  const allUsers = await getAllUsers();
  const targetUser = allUsers.find(u => u.id === id);
  // مفيش سجل بالرقم ده: بنعرض صفحة «غير موجود».
  // كان مكتوب هنا «ولا هات أول واحد في القايمة» — يعني اللي بيفتح
  // رقم مش موجود كان بيشوف سجل حد تاني وهو فاكر إنه بتاعه.
  if (!targetUser) notFound();

  const supabase = await createClient();
  const { data: childrenData } = await supabase.from('child_profiles')
    .select('*')
    .eq('user_profile_id', id)
    .order('created_at', { ascending: true });

  const childrenWithAge = await getChildrenAgeData(childrenData || []);
  const formattedChildren = childrenWithAge.map((child) => {
    const age = child.age;
    return {
      name: child.full_name,
      ageDisplay: age !== null ? `${age} سنوات` : '-'
    };
  });

  const columns = [
    { header: 'الاسم', accessorKey: 'name' },
    { header: 'العمر', accessorKey: 'ageDisplay' },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`إدارة أبناء: ${targetUser.fullName}`} backHref={`/dashboard/admin/users/${id}`} />
      
      <div className="mb-6">
        <SimpleDataTable columns={columns} data={formattedChildren} />
      </div>
    </div>
  );
}
