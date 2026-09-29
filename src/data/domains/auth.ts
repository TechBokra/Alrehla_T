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
 * الصلاحيات الافتراضية لكل دور.
 *
 * دي بتشتغل لما عمود `permissions` في القاعدة يكون فاضي — وده وضع كل
 * الحسابات لحد ما الإدارة تخصّص صلاحيات لحساب بعينه من شاشة الصلاحيات.
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

  // الصلاحيات: العمود في القاعدة لو متملّي، وإلا الافتراضي بتاع الدور.
  // العمود الفاضي مقصود — معناه «زي أي واحد في دوره»، فالحسابات القديمة
  // ما بتتأثرش، ومفيش حاجة محتاجة تتملّى بالإيد.
  const stored = (profile as { permissions?: string[] | null }).permissions;
  const permissions: AdminPermission[] =
    Array.isArray(stored) && stored.length > 0
      ? (stored as AdminPermission[])
      : defaultPermissionsForRole(role);

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
