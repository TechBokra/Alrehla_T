import React from 'react';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/data/domains/auth';
import { DeleteAccountClient } from './DeleteAccountClient';
import { ProfileForm } from './ProfileForm';
import { PasswordChangeForm } from './PasswordChangeForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'إعدادات الحساب',
    description: 'إدارة حسابك في منصة الرحلة.',
    path: '/account/settings',
    noIndex: true,
  });
}

export default async function Page() {
  const user = await getCurrentUser();

  const supabase = await createClient();
  const { data: openRequest } = await supabase
    .from('account_deletion_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="mb-8 text-2xl font-black text-slate-800">إعدادات الحساب</h1>

      <ProfileForm fullName={user.fullName} email={user.email} />

      <PasswordChangeForm />

      <DeleteAccountClient hasOpenRequest={Boolean(openRequest)} />
    </div>
  );
}
