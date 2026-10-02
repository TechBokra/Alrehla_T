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
 * الصلاحيات على مستوى **الدور**، مش الشخص.
 *
 * • مدير النظام: الكل دايمًا — مالوش صف في الجدول عن قصد، عشان ماينفعش
 *   يقفل الباب على نفسه.
 * • المشرف العام: اللي في صفّه في جدول `role_permissions` (بيتعدّل من
 *   شاشة الصلاحيات)، وكل مشرف بياخده — الموجود والجديد.
 *
 * `defaultPermissionsForRole` دي **احتياطي بس**: لو الجدول مش موجود (ملف
 * 04 لسه ماتشغّلش) أو القراءة فشلت، الموقع بيشتغل بالقديم بدل ما يقفل
 * القايمة على المشرفين.
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

/** الأدوار اللي صلاحياتها بتتظبط من الشاشة. */
export const EDITABLE_ADMIN_ROLES = ['general_supervisor'] as const;
export type EditableAdminRole = (typeof EDITABLE_ADMIN_ROLES)[number];

/**
 * صلاحيات دور من الجدول — مع الاحتياطي لو مش موجود.
 *
 * ⚠️ أسماء غريبة في الصف بتتشال هنا كمان (القاعدة بترفضها أصلًا، بس
 *    مفيش ضرر من التأكيد).
 */
export async function getRolePermissions(role: UserRole): Promise<AdminPermission[]> {
  if (role === 'super_admin') return [...ALL_ADMIN_PERMISSIONS];
  if (!(EDITABLE_ADMIN_ROLES as readonly string[]).includes(role)) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permissions')
    .eq('role', role)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('role_permissions read failed — using defaults', error.message);
    return defaultPermissionsForRole(role);
  }

  return (data.permissions ?? []).filter((p): p is AdminPermission =>
    (ALL_ADMIN_PERMISSIONS as string[]).includes(p)
  );
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

  // الصلاحيات من دوره — كل اللي في الدور بياخدوا نفس الحاجة.
  const permissions = await getRolePermissions(role);

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
