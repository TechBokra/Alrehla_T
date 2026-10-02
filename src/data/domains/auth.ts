import {
  UserProfile, UserRole, AdminPermission
} from '@/types';
import { createClient } from '@/lib/supabase/server';
import { User } from '@supabase/supabase-js';
import { needsPasswordSetup } from '@/lib/first-login';


// Safe profile synchronization helper
export async function syncUserProfile(user: User) {
  const supabase = await createClient();
  
  const { data: existingProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (existingProfile) {
    return existingProfile;
  }

  // Profile does not exist: create the missing user_profiles row safely
  const fullName = user.user_metadata?.full_name || 'مستخدم';
  
  const { data: newProfile, error: insertError } = await supabase
    .from('user_profiles')
    .insert({
      id: user.id,
      full_name: fullName,
      role: 'customer',
      is_guardian: false
    })
    .select('*')
    .single();

  if (insertError || !newProfile) {
    console.error('Profile synchronization failed:', insertError);
    throw new Error('Authentication error: Failed to synchronize user profile.');
  }

  return newProfile;
}

/**
 * الصلاحيات على مستوى **الدور الإداري**، مش الشخص.
 *
 * • مدير النظام: الكل دايمًا — مالوش صف في الجدول عن قصد، عشان ماينفعش
 *   يقفل الباب على نفسه.
 * • أي إداري تاني (دوره في القاعدة `general_supervisor`): صلاحيات دوره
 *   الإداري من جدول `admin_roles` (ملف schema/05) — «محاسب»، «مسؤول
 *   محتوى»… — وعمود `admin_role_id` فاضي = الدور الافتراضي («مشرف عام»).
 *
 * `defaultPermissionsForRole` دي **احتياطي بس**: لو الجدول مش موجود (ملف
 * 05 لسه ماتشغّلش) أو القراءة فشلت، الموقع بيشتغل بالقديم بدل ما يقفل
 * القايمة على الإداريين.
 */
export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'canManageUsers', 'canManageInstructors', 'canManagePublishers',
  'canManageCatalog', 'canManageSubscriptions', 'canManageOrders',
  'canManageBookings', 'canManageSupport', 'canManageContent',
  'canManageFinance', 'canViewAuditLogs',
];

export function defaultPermissionsForRole(role: UserRole): AdminPermission[] {
  if (role === 'super_admin') return [...ALL_ADMIN_PERMISSIONS];
  if (role === 'general_supervisor') {
    // المشرف العام: كل حاجة ما عدا الفلوس والسجل.
    return ALL_ADMIN_PERMISSIONS.filter(
      (p) => p !== 'canManageFinance' && p !== 'canViewAuditLogs'
    );
  }
  return [];
}

/** أسماء غريبة بتتشال — القاعدة بترفضها أصلًا، بس مفيش ضرر من التأكيد. */
export function knownPermissions(list: readonly string[] | null | undefined): AdminPermission[] {
  return (list ?? []).filter((p): p is AdminPermission =>
    (ALL_ADMIN_PERMISSIONS as string[]).includes(p)
  );
}

export type AdminRoleRow = {
  id: string;
  name: string;
  permissions: AdminPermission[];
  isDefault: boolean;
};

/** كل الأدوار الإدارية — الافتراضي الأول. `null` = الجدول مش موجود (05 ماتشغّلش). */
export async function getAdminRoles(): Promise<AdminRoleRow[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('admin_roles')
    .select('id, name, permissions, is_default')
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('admin_roles read failed', error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    permissions: knownPermissions(r.permissions),
    isDefault: r.is_default,
  }));
}

/**
 * صلاحيات حساب إداري واسم دوره.
 *
 * دوره المحدَّد لو موجود، وإلا الافتراضي. ولو الجدول مش موجود أو القراءة
 * فشلت: الصلاحيات القديمة (نفس سلوك ما قبل الملف).
 */
export async function getAdminAccess(
  role: UserRole,
  adminRoleId: string | null | undefined,
): Promise<{ permissions: AdminPermission[]; roleName?: string }> {
  if (role === 'super_admin') {
    return { permissions: [...ALL_ADMIN_PERMISSIONS], roleName: 'مدير النظام' };
  }
  if (role !== 'general_supervisor') return { permissions: [] };

  const supabase = await createClient();

  if (adminRoleId) {
    const { data } = await supabase
      .from('admin_roles')
      .select('name, permissions')
      .eq('id', adminRoleId)
      .maybeSingle();
    if (data) return { permissions: knownPermissions(data.permissions), roleName: data.name };
  }

  const { data, error } = await supabase
    .from('admin_roles')
    .select('name, permissions')
    .eq('is_default', true)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('admin_roles read failed — using defaults', error.message);
    return { permissions: defaultPermissionsForRole(role), roleName: 'مشرف عام' };
  }
  return { permissions: knownPermissions(data.permissions), roleName: data.name };
}

// Database Access Functions
export const getCurrentUser = async (): Promise<UserProfile> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // مفيش مستخدم مسجّل = زائر.
  //
  // كان هنا باب تاني: في بيئة التطوير الكود كان بيقرا كوكي `mockRole`
  // ويركّب مستخدم وهمي **بصلاحيات مدير نظام كاملة** من غير أي تسجيل
  // دخول. اتشال هو وشريط تبديل الأدوار اللي كان بيكتب الكوكي.
  if (!user) {
    return {
      id: 'visitor-user',
      fullName: 'زائر',
      email: '',
      role: 'visitor',
      createdAt: new Date().toISOString(),
    };
  }

  // Fetch or synchronize actual profile from Supabase
  const profile = await syncUserProfile(user);

  const role: UserRole = (profile.role as UserRole) || 'customer';

  // الصلاحيات من دوره الإداري — كل اللي في الدور بياخدوا نفس الحاجة.
  const { permissions, roleName } = await getAdminAccess(
    role,
    (profile as { admin_role_id?: string | null }).admin_role_id,
  );

  return {
    id: user.id,
    fullName: profile.full_name || user.user_metadata?.full_name || 'مستخدم',
    email: user.email || '',
    role: role,
    isGuardian: profile.is_guardian || false,
    avatarUrl: profile.avatar_url || undefined,
    createdAt: profile.created_at || user.created_at,
    mustSetPassword: needsPasswordSetup(user),
    suspendedAt: (profile as { suspended_at?: string | null }).suspended_at ?? null,
    suspensionReason:
      (profile as { suspension_reason?: string | null }).suspension_reason ?? null,
    ...(roleName ? { adminRoleName: roleName } : {}),
    ...(permissions.length > 0 ? { permissions } : {})
  };
};


export const getAllUsers = async (): Promise<UserProfile[]> => {
  const supabase = await createClient();
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !profiles || profiles.length === 0) {
    if (error) console.error('Error fetching users', error);
    return [];
  }

  // البريد مش في جدول المستخدمين: قاعدة القراءة عليه مفتوحة للجميع، فلو
  // البريد كان هناك كان أي زائر يقدر يسحب بريد كل العملاء. الجدول ده
  // الإدارة وحدها اللي تقراه — ولو اللي بيقرأ مش إدارة بترجع فاضية،
  // والشاشة بتعرض شرطة بدل البريد.
  const { data: emails } = await supabase
    .from('user_emails')
    .select('user_id, email');

  const emailById = new Map((emails ?? []).map(e => [e.user_id, e.email]));

  return profiles.map(profile => ({
    id: profile.id,
    fullName: profile.full_name,
    email: emailById.get(profile.id) ?? '',
    role: profile.role as UserRole,
    isGuardian: profile.is_guardian || false,
    avatarUrl: profile.avatar_url || undefined,
    createdAt: profile.created_at || new Date().toISOString(),
    suspendedAt: profile.suspended_at ?? null,
    suspensionReason: profile.suspension_reason ?? null,
  }));
};
