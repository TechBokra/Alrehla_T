'use client';

import { SITE_URL } from '@/lib/site-url';
import { accountMessage, greetByName, SIGN_IN_PATH } from '@/lib/account-message';
import React, { useState, useMemo } from 'react';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { ticketStatus } from '@/lib/ticket-status';
import { productOrderStatus, serviceOrderStatus } from '@/lib/order-status';
import { sessionStatusView } from '@/lib/session-status';
import { StatusBadge } from '@/components/StatusBadge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Calendar,
  KeyRound,
  Shield,
  Copy,
  Check,
  X,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  MessageSquare,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Lock,
} from 'lucide-react';
import type { UserProfile, UserRole } from '@/types';
import { resetUserPassword, updateUserRole } from '@/actions/admin-users';
import {
  roleChoices,
  roleToChoice,
  choiceToRole,
  roleDisplayName,
  type AdminRoleOption,
} from '@/lib/role-choice';
import { formatDate, formatPrice } from '@/lib/utils';
import { formatCairo, PLATFORM_TIMEZONE } from '@/lib/timezone';
import { Pagination } from '@/components/dashboard/Pagination';
import { FormError } from '@/components/ui/FormError';
import {
  Field,
  TextInput,
  Select,
  BusyButton,
  fieldClass,
} from '@/components/forms/Form';
import { ROLE_LABELS } from '../UsersClient';

export interface UserOrderRow {
  id: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  paymentMethod?: string;
  trackingReference?: string;
  itemsCount: number;
}

export interface UserServiceOrderRow {
  id: string;
  serviceName: string;
  instructorName?: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface UserSessionRow {
  id: string;
  sessionNumber: number;
  scheduledAt: string;
  status: string;
  packageName?: string;
  instructorName?: string;
}

export interface UserChildRow {
  id: string;
  fullName: string;
  birthDate?: string;
  age?: number | null;
  createdAt: string;
}

export interface UserTicketRow {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
}

interface AdminUserDetailClientProps {
  user: UserProfile;
  accountEmail?: string;
  orders: UserOrderRow[];
  serviceOrders: UserServiceOrderRow[];
  sessions: UserSessionRow[];
  childrenList: UserChildRow[];
  tickets: UserTicketRow[];
  isSuperAdmin: boolean;
  /** الأدوار الإدارية بأسمائها (schema/05). */
  adminRoles?: AdminRoleOption[];
}

type ActiveTab = 'overview' | 'orders' | 'sessions' | 'children' | 'tickets';

const PAGE_SIZE = 10;

export function AdminUserDetailClient({
  user,
  accountEmail,
  orders,
  serviceOrders,
  sessions,
  childrenList,
  tickets,
  isSuperAdmin,
  adminRoles = [],
}: AdminUserDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Role change state
  // «اختيار» مش دور خام: الإداري بيتعرض ويتحدد باسم دوره الإداري
  // (`@/lib/role-choice`).
  const [currentRole, setCurrentRole] = useState<string>(
    roleToChoice(user.role, user.adminRoleId, adminRoles)
  );
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState<string>(currentRole);
  const currentRoleLabel = (() => {
    const decoded = choiceToRole(currentRole, adminRoles);
    return decoded
      ? roleDisplayName(
          decoded.role,
          decoded.adminRoleId,
          adminRoles,
          ROLE_LABELS
        )
      : currentRole;
  })();
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleFeedback, setRoleFeedback] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  // خطأ الخادم على خانة الدور نفسها (`field: 'role'`) — بيظهر تحتها.
  const [roleFieldError, setRoleFieldError] = useState('');

  // Password reset state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [customPasswordInput, setCustomPasswordInput] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  // خطأ على خانة كلمة المرور نفسها — بيظهر تحتها مش فوق النافذة.
  const [passwordFieldError, setPasswordFieldError] = useState('');
  const [passwordResult, setPasswordResult] = useState<{
    email: string;
    tempCode: string;
    isCustom: boolean;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<'id' | 'code' | 'whatsapp' | null>(
    null
  );

  // Orders tab sub-view
  const [orderSubTab, setOrderSubTab] = useState<'products' | 'services'>(
    'products'
  );
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderPage, setOrderPage] = useState(1);

  // Sessions tab filters
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('all');
  const [sessionPage, setSessionPage] = useState(1);

  // Password Reset Handler
  const handleResetPassword = async () => {
    setPasswordError('');
    setPasswordFieldError('');
    setPasswordResult(null);
    if (passwordMode === 'custom' && customPasswordInput.trim().length < 8) {
      setPasswordFieldError('كلمة المرور يجب أن تكون 8 خانات على الأقل.');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await resetUserPassword({
        userId: user.id,
        customPassword:
          passwordMode === 'custom' ? customPasswordInput.trim() : undefined,
      });
      if (res.ok) {
        setPasswordResult(res);
        setCustomPasswordInput('');
      } else if (res.field === 'customPassword') {
        setPasswordFieldError(res.error);
      } else {
        setPasswordError(res.error);
      }
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'تعذّر إعادة تعيين كلمة المرور'
      );
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopy = async (text: string, key: 'id' | 'code' | 'whatsapp') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  const handleCopyWhatsapp = async () => {
    if (!passwordResult) return;
    const emailToUse =
      passwordResult.email ||
      accountEmail ||
      user.email ||
      'بريدك الإلكتروني المسجل';
    const msg = accountMessage({
      code: passwordResult.tempCode,
      email: emailToUse,
      loginUrl: `${SITE_URL}${SIGN_IN_PATH}`,
      greeting: greetByName(user.fullName),
    });
    handleCopy(msg, 'whatsapp');
  };

  // Role Change Handler
  const handleRoleChange = async () => {
    setRoleSaving(true);
    setRoleFeedback(null);
    setRoleFieldError('');
    try {
      const decoded = choiceToRole(selectedNewRole, adminRoles);
      if (!decoded) {
        setRoleFeedback({
          ok: false,
          msg: 'الدور المختار غير صالح — حدّث الصفحة.',
        });
        return;
      }
      const res = await updateUserRole(
        user.id,
        decoded.role,
        decoded.adminRoleId
      );
      if (res.ok) {
        setCurrentRole(selectedNewRole);
        setRoleFeedback({ ok: true, msg: 'تم تغيير دور المستخدم بنجاح.' });
        setTimeout(() => setShowRoleModal(false), 1500);
        router.refresh();
      } else if (res.field === 'role') {
        setRoleFieldError(res.error);
      } else {
        setRoleFeedback({ ok: false, msg: res.error });
      }
    } catch (err) {
      setRoleFeedback({ ok: false, msg: 'حدث خطأ أثناء حفظ الدور.' });
    } finally {
      setRoleSaving(false);
    }
  };

  // Filtered Product Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter)
        return false;
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        if (
          !o.id.toLowerCase().includes(q) &&
          !(o.trackingReference || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  const paginatedOrders = useMemo(() => {
    const start = (orderPage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, orderPage]);

  // Filtered Service Orders
  const filteredServiceOrders = useMemo(() => {
    return serviceOrders.filter((so) => {
      if (orderStatusFilter !== 'all' && so.status !== orderStatusFilter)
        return false;
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        if (
          !so.serviceName.toLowerCase().includes(q) &&
          !(so.instructorName || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [serviceOrders, orderStatusFilter, orderSearch]);

  const paginatedServiceOrders = useMemo(() => {
    const start = (orderPage - 1) * PAGE_SIZE;
    return filteredServiceOrders.slice(start, start + PAGE_SIZE);
  }, [filteredServiceOrders, orderPage]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (sessionStatusFilter !== 'all' && s.status !== sessionStatusFilter)
        return false;
      if (sessionSearch.trim()) {
        const q = sessionSearch.toLowerCase();
        if (
          !(s.packageName || '').toLowerCase().includes(q) &&
          !(s.instructorName || '').toLowerCase().includes(q) &&
          !String(s.sessionNumber).includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, sessionStatusFilter, sessionSearch]);

  const paginatedSessions = useMemo(() => {
    const start = (sessionPage - 1) * PAGE_SIZE;
    return filteredSessions.slice(start, start + PAGE_SIZE);
  }, [filteredSessions, sessionPage]);

  const totalOrdersCount = orders.length + serviceOrders.length;

  return (
    <div className="space-y-6">
      {/* ─── 1. ترويسة المستخدم المدمجة وإدارة الدخول السريعة ─── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-xl font-black text-white shadow-xs">
              {user.fullName ? user.fullName[0] : 'م'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">
                  {user.fullName}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-800">
                  {currentRoleLabel}
                </span>
                {user.isGuardian && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-800">
                    <Users className="h-3 w-3" />
                    ولي أمر ({childrenList.length} أبناء)
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono text-slate-700">
                    {accountEmail || user.email || 'لا يوجد بريد مسجل'}
                  </span>
                </div>
                <span className="hidden text-slate-300 sm:inline">•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>انضم في: {formatDate(user.createdAt)}</span>
                </div>
                <span className="hidden text-slate-300 sm:inline">•</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[11px] text-slate-400">
                    ID: {user.id.slice(0, 8)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(user.id, 'id')}
                    className="p-0.5 text-slate-400 hover:text-slate-700"
                    title="نسخ المعرف الكامل"
                  >
                    {copiedKey === 'id' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة (تغيير كلمة المرور وتعديل الدور) */}
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 lg:border-t-0 lg:pt-0">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordError('');
                setPasswordResult(null);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 px-3.5 py-2 text-xs font-bold text-indigo-900 shadow-2xs transition-colors hover:bg-indigo-100"
            >
              <KeyRound className="h-3.5 w-3.5 text-indigo-700" />
              <span>بيانات الدخول وكلمة المرور</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedNewRole(currentRole);
                setRoleFeedback(null);
                setShowRoleModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-100"
            >
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              <span>تعديل الدور</span>
            </button>

            {user.isGuardian && (
              <Link
                href={`/dashboard/admin/users/${user.id}/children`}
                className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/80 px-3.5 py-2 text-xs font-bold text-violet-900 shadow-2xs transition-colors hover:bg-violet-100"
              >
                <Users className="h-3.5 w-3.5 text-violet-700" />
                <span>إدارة الأبناء</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. شريط التبويبات الرئيسي (Tabs Navigation) ─── */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border-b border-slate-200 bg-white p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>نظرة عامة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>الطلبات والمشتريات</span>
          <span className="py-0.2 rounded-md bg-slate-100 px-1.5 text-[10px] text-slate-700">
            {totalOrdersCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'sessions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>المواعيد والجلسات</span>
          <span className="py-0.2 rounded-md bg-slate-100 px-1.5 text-[10px] text-slate-700">
            {sessions.length}
          </span>
        </button>

        {user.isGuardian && (
          <button
            type="button"
            onClick={() => setActiveTab('children')}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
              activeTab === 'children'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>الأبناء والتابعون</span>
            <span className="py-0.2 rounded-md bg-violet-100 px-1.5 text-[10px] text-violet-800">
              {childrenList.length}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all ${
            activeTab === 'tickets'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>تذاكر الدعم</span>
          <span className="py-0.2 rounded-md bg-slate-100 px-1.5 text-[10px] text-slate-700">
            {tickets.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: نظرة عامة والملف الشخصي ─── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* كارت 1: بيانات الحساب والاتصال */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div>
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <User className="h-4 w-4 text-slate-600" />
                <h3 className="text-sm font-black text-slate-800">
                  بيانات الملف الشخصي
                </h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="mb-0.5 block text-slate-400">
                    الاسم بالكامل:
                  </span>
                  <span className="font-bold text-slate-900">
                    {user.fullName}
                  </span>
                </div>
                <div>
                  <span className="mb-0.5 block text-slate-400">
                    الدور الحالي:
                  </span>
                  <span className="font-bold text-indigo-700">
                    {currentRoleLabel}
                  </span>
                </div>
                <div>
                  <span className="mb-0.5 block text-slate-400">
                    تاريخ التسجيل:
                  </span>
                  <span className="font-bold text-slate-800">
                    {formatDate(user.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedNewRole(currentRole);
                  setShowRoleModal(true);
                }}
                className="w-full py-1 text-center text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                تغيير الدور والصلاحيات &larr;
              </button>
            </div>
          </div>

          {/* كارت 2: بيانات الدخول وكلمة المرور للدعم الفني */}
          <div className="flex flex-col justify-between rounded-3xl border border-indigo-200 bg-white p-5 shadow-xs">
            <div>
              <div className="mb-4 flex items-center gap-2 border-b border-indigo-100 pb-3">
                <KeyRound className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-black text-slate-800">
                  بيانات الدخول والأمان
                </h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="mb-0.5 block text-slate-400">
                    البريد الإلكتروني للدخول:
                  </span>
                  <span className="block rounded-xl border border-slate-100 bg-slate-50 p-2 font-mono text-xs font-bold break-all text-slate-900">
                    {accountEmail || user.email || 'مرتبط بحساب المنصة'}
                  </span>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-2.5 text-[11px] leading-relaxed font-medium text-indigo-900">
                  لو المستخدم متعثر في الدخول أو نسي كلمة المرور، يمكنك تزويده
                  بكلمة مرور أو رمز مؤقت فوراً من هنا.
                </div>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordError('');
                  setPasswordResult(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-indigo-700"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>إعادة تعيين / منح كلمة مرور</span>
              </button>
            </div>
          </div>

          {/* كارت 3: حالة العائلة والأبناء */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div>
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users className="h-4 w-4 text-violet-600" />
                <h3 className="text-sm font-black text-slate-800">
                  العائلة والأبناء
                </h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="mb-0.5 block text-slate-400">
                    حساب ولي أمر:
                  </span>
                  <span className="font-bold text-slate-800">
                    {user.isGuardian
                      ? 'نعم (حساب ولي أمر معتمد)'
                      : 'لا (حساب فردي)'}
                  </span>
                </div>
                <div>
                  <span className="mb-0.5 block text-slate-400">
                    عدد الأبناء المسجلين:
                  </span>
                  <span className="text-base font-black text-violet-900">
                    {childrenList.length}
                  </span>
                </div>
                {childrenList.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {childrenList.slice(0, 3).map((ch) => (
                      <span
                        key={ch.id}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                      >
                        {ch.fullName}
                      </span>
                    ))}
                    {childrenList.length > 3 && (
                      <span className="text-[11px] font-bold text-slate-400">
                        +{childrenList.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {user.isGuardian && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('children')}
                  className="w-full py-1 text-center text-xs font-bold text-violet-600 hover:text-violet-800"
                >
                  استعراض الأبناء وحساباتهم &larr;
                </button>
              </div>
            )}
          </div>

          {/* كارت 4: ملخص الأنشطة والمعاملات */}
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs">
            <div>
              <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <h3 className="text-sm font-black text-slate-800">
                  ملخص المعاملات
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    setOrderSubTab('products');
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-2 text-right transition-colors hover:bg-slate-100"
                >
                  <span className="font-bold text-slate-700">
                    طلبات المتجر (إنها لك):
                  </span>
                  <span className="font-black text-slate-900">
                    {orders.length} طلبات
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    setOrderSubTab('services');
                  }}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-2 text-right transition-colors hover:bg-slate-100"
                >
                  <span className="font-bold text-slate-700">
                    طلبات الخدمات الإبداعية:
                  </span>
                  <span className="font-black text-slate-900">
                    {serviceOrders.length} طلبات
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('sessions')}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-2 text-right transition-colors hover:bg-slate-100"
                >
                  <span className="font-bold text-slate-700">
                    الجلسات التدريبية:
                  </span>
                  <span className="font-black text-slate-900">
                    {sessions.length} جلسة
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tickets')}
                  className="flex w-full items-center justify-between rounded-xl bg-slate-50 p-2 text-right transition-colors hover:bg-slate-100"
                >
                  <span className="font-bold text-slate-700">
                    تذاكر الدعم الفني:
                  </span>
                  <span className="font-black text-slate-900">
                    {tickets.length} تذكرة
                  </span>
                </button>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-400">
              اضغط على أي بند للانتقال لتفاصيله مباشرة.
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: الطلبات والمشتريات ─── */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-col items-stretch justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOrderSubTab('products');
                  setOrderPage(1);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  orderSubTab === 'products'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                منتجات إنها لك ({orders.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrderSubTab('services');
                  setOrderPage(1);
                }}
                className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                  orderSubTab === 'services'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الخدمات الإبداعية ({serviceOrders.length})
              </button>
            </div>

            {/* شريط البحث والفلترة */}
            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="بحث في الطلبات"
                  placeholder="بحث في الطلبات…"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setOrderPage(1);
                  }}
                  className={`${fieldClass} pr-9 text-sm`}
                />
              </div>

              <div className="w-40 shrink-0">
                <select
                  aria-label="حالة الطلب"
                  value={orderStatusFilter}
                  onChange={(e) => {
                    setOrderStatusFilter(e.target.value);
                    setOrderPage(1);
                  }}
                  className={`${fieldClass} text-sm`}
                >
                  <option value="all">كل الحالات</option>
                  <option value="pending">بانتظار الدفع</option>
                  <option value="paid">مدفوع</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
            </div>
          </div>

          {orderSubTab === 'products' ? (
            paginatedOrders.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                  {/* ⚠️ الحالة كانت خامًا (`{o.status}`) — الإداري بيشوف
                      «awaiting_verification» إنجليزي. الأسماء من
                      `productOrderStatus`، نفس المصدر اللي صفحة الطلب
                      بتقرا منه. */}
                  <SimpleDataTable
                    enableSearch={false}
                    enablePagination={false}
                    emptyMessage="لا توجد طلبات."
                    columns={[
                      { header: 'رقم الطلب', accessorKey: 'idDisplay' },
                      { header: 'التاريخ', accessorKey: 'date' },
                      { header: 'عدد المنتجات', accessorKey: 'items' },
                      { header: 'الإجمالي', accessorKey: 'total' },
                      { header: 'الحالة', accessorKey: 'statusDisplay' },
                      { header: 'رقم التتبع', accessorKey: 'tracking' },
                      { header: 'إجراء', accessorKey: 'action' },
                    ]}
                    data={paginatedOrders.map((o) => ({
                      id: o.id,
                      idDisplay: (
                        <span className="font-mono font-bold text-slate-900">
                          {o.id}
                        </span>
                      ),
                      date: formatDate(o.createdAt),
                      items: `${o.itemsCount} منتج`,
                      total: formatPrice(o.totalAmount),
                      statusDisplay: (
                        <StatusBadge {...productOrderStatus(o.status)} />
                      ),
                      tracking: o.trackingReference || '—',
                      action: (
                        <Link
                          href={`/dashboard/admin/orders/${o.id}`}
                          className="text-info inline-flex items-center gap-1 font-bold hover:underline"
                        >
                          <span>عرض</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ),
                    }))}
                  />
                </div>

                {Math.ceil(filteredOrders.length / PAGE_SIZE) > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 px-2 pt-4">
                    <span className="text-xs font-medium text-slate-500">
                      عرض {paginatedOrders.length} من {filteredOrders.length}{' '}
                      طلب
                    </span>
                    <Pagination
                      page={orderPage}
                      totalPages={Math.ceil(filteredOrders.length / PAGE_SIZE)}
                      onPageChange={(p) => setOrderPage(p)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
                لا توجد طلبات منتجات تطابق الفلاتر المحددة.
              </div>
            )
          ) : paginatedServiceOrders.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
                {/* نفس العلاج: الحالة كانت خامًا، والأسماء من
                      `serviceOrderStatus`. */}
                <SimpleDataTable
                  enableSearch={false}
                  enablePagination={false}
                  emptyMessage="لا توجد طلبات خدمات."
                  columns={[
                    { header: 'رقم الطلب', accessorKey: 'idDisplay' },
                    { header: 'اسم الخدمة', accessorKey: 'serviceName' },
                    { header: 'المدرب', accessorKey: 'instructorName' },
                    { header: 'المبلغ', accessorKey: 'amount' },
                    { header: 'الحالة', accessorKey: 'statusDisplay' },
                    { header: 'التاريخ', accessorKey: 'date' },
                    { header: 'إجراء', accessorKey: 'action' },
                  ]}
                  data={paginatedServiceOrders.map((so) => ({
                    id: so.id,
                    idDisplay: (
                      <span className="font-mono font-bold text-slate-900">
                        {so.id}
                      </span>
                    ),
                    serviceName: so.serviceName,
                    instructorName: so.instructorName || '—',
                    amount: formatPrice(so.amount),
                    statusDisplay: (
                      <StatusBadge {...serviceOrderStatus(so.status)} />
                    ),
                    date: formatDate(so.createdAt),
                    action: (
                      <Link
                        href={`/account/orders/creative-writing/${so.id}`}
                        className="text-info inline-flex items-center gap-1 font-bold hover:underline"
                      >
                        <span>عرض</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ),
                  }))}
                />
              </div>

              {Math.ceil(filteredServiceOrders.length / PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-2 pt-4">
                  <span className="text-xs font-medium text-slate-500">
                    عرض {paginatedServiceOrders.length} من{' '}
                    {filteredServiceOrders.length} طلب
                  </span>
                  <Pagination
                    page={orderPage}
                    totalPages={Math.ceil(
                      filteredServiceOrders.length / PAGE_SIZE
                    )}
                    onPageChange={(p) => setOrderPage(p)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
              لا توجد طلبات خدمات إبداعية تطابق الفلاتر.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: المواعيد والجلسات ─── */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="flex flex-col items-stretch justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
            <h3 className="text-sm font-black text-slate-900">
              سجل الجلسات التدريبية ({sessions.length})
            </h3>

            <div className="flex items-center gap-2">
              <div className="relative w-48">
                <Search className="absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  aria-label="بحث بالباقة أو المدرب"
                  placeholder="بحث بالباقة أو المدرب…"
                  value={sessionSearch}
                  onChange={(e) => {
                    setSessionSearch(e.target.value);
                    setSessionPage(1);
                  }}
                  className={`${fieldClass} pr-9 text-sm`}
                />
              </div>

              <div className="w-40 shrink-0">
                <select
                  aria-label="حالة الجلسة"
                  value={sessionStatusFilter}
                  onChange={(e) => {
                    setSessionStatusFilter(e.target.value);
                    setSessionPage(1);
                  }}
                  className={`${fieldClass} text-sm`}
                >
                  <option value="all">كل الحالات</option>
                  <option value="scheduled">مجدولة</option>
                  <option value="confirmed">مؤكدة</option>
                  <option value="completed">مكتملة</option>
                  <option value="cancelled">ملغاة</option>
                </select>
              </div>
            </div>
          </div>

          {paginatedSessions.length > 0 ? (
            <div className="space-y-4">
              {/* ⚠️ **الحالة كانت بتتعرض خامًا** (`{s.status}`) — الإداري
                  بيشوف «confirmed» إنجليزي، والمشروع فيه
                  `sessionStatusView` بأسماء عربية **وبنوع الشارة**
                  مستعملة في شاشات تانية. الشاشة دي كانت بتخترع
                  ألوانها وتتجاهلها.

                  ⚠️ والترقيم بره الجدول عن قصد: الشاشة دي عندها
                     فلاتر وترقيم خاصين بيها، فـ`enablePagination`
                     مقفول عشان مايبقاش فيه ترقيمان فوق بعض. */}
              <SimpleDataTable
                enableSearch={false}
                enablePagination={false}
                emptyMessage="لا توجد جلسات."
                columns={[
                  { header: 'الجلسة', accessorKey: 'sessionLabel' },
                  { header: 'الباقة', accessorKey: 'packageName' },
                  { header: 'المدرب', accessorKey: 'instructorName' },
                  { header: 'الموعد', accessorKey: 'when' },
                  { header: 'الحالة', accessorKey: 'statusDisplay' },
                ]}
                data={paginatedSessions.map((s) => ({
                  sessionLabel: `جلسة #${s.sessionNumber}`,
                  packageName: s.packageName || '—',
                  instructorName: s.instructorName || '—',
                  when: formatCairo(s.scheduledAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                  statusDisplay: (
                    <StatusBadge
                      label={sessionStatusView(s.status).label}
                      type={sessionStatusView(s.status).badge}
                    />
                  ),
                }))}
              />

              {Math.ceil(filteredSessions.length / PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-2 pt-4">
                  <span className="text-xs font-medium text-slate-500">
                    عرض {paginatedSessions.length} من أصل{' '}
                    {filteredSessions.length} جلسة
                  </span>
                  <Pagination
                    page={sessionPage}
                    totalPages={Math.ceil(filteredSessions.length / PAGE_SIZE)}
                    onPageChange={(p) => setSessionPage(p)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
              لا توجد جلسات مسجلة تطابق الفلاتر.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: الأبناء والتابعون ─── */}
      {activeTab === 'children' && user.isGuardian && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                الأبناء المضافون تحت هذا الحساب ({childrenList.length})
              </h3>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                يمكن لولي الأمر تسجيل أبنائه في باقات الكتابة والقصص المخصصة.
              </p>
            </div>
            <Link
              href={`/dashboard/admin/users/${user.id}/children`}
              className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-violet-700"
            >
              صفحة إدارة الأبناء التفصيلية
            </Link>
          </div>

          {childrenList.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {childrenList.map((ch) => (
                <div
                  key={ch.id}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
                      {ch.fullName ? ch.fullName[0] : 'ط'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {ch.fullName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {ch.age !== null && ch.age !== undefined
                          ? `${ch.age} سنوات`
                          : 'العمر غير محدد'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600">
                    <div>
                      <span className="text-slate-400">تاريخ الميلاد: </span>
                      <span>
                        {ch.birthDate ? formatDate(ch.birthDate) : 'غير مسجل'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">تاريخ الإضافة: </span>
                      <span>{formatDate(ch.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
              لم يقم ولي الأمر بإضافة أي أبناء حتى الآن.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: تذاكر الدعم ─── */}
      {activeTab === 'tickets' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="text-sm font-black text-slate-900">
              تذاكر الدعم الفني ({tickets.length})
            </h3>
          </div>

          {tickets.length > 0 ? (
            /* ⚠️ **الحالة كانت بتتعرض خامًا من القاعدة** (`{t.status}`)
                — يعني الإداري بيشوف «answered» إنجليزي في شاشة
                عربية. الأسماء بقت من `ticketStatus`، وهو نفس المصدر
                اللي قايمة التذاكر وصفحة التذكرة بيقروا منه.

                والجدول اتحوّل لـ`SimpleDataTable` عشان يبقى له عرض
                بطاقات على الموبايل. */
            <SimpleDataTable
              enableSearch={false}
              enablePagination={tickets.length > 10}
              emptyMessage="لا توجد تذاكر."
              columns={[
                { header: 'الموضوع', accessorKey: 'subject' },
                { header: 'القسم', accessorKey: 'category' },
                { header: 'الحالة', accessorKey: 'statusDisplay' },
                { header: 'التاريخ', accessorKey: 'date' },
              ]}
              data={tickets.map((t) => ({
                subject: t.subject,
                category: t.category,
                statusDisplay: <StatusBadge {...ticketStatus(t.status)} />,
                date: formatDate(t.createdAt),
              }))}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-xs text-slate-400">
              لا توجد تذاكر دعم فني مقدمة من هذا المستخدم.
            </div>
          )}
        </div>
      )}

      {/* ─── نافذة إدارة كلمة المرور وبيانات الدخول للمستخدم ─── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-5 left-5 rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  إدارة دخول المستخدم: {user.fullName}
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  {accountEmail || user.email
                    ? `البريد: ${accountEmail || user.email}`
                    : 'حساب معتمد في المنصة'}
                </p>
              </div>
            </div>

            <FormError message={passwordError} className="mb-4" />

            {passwordResult ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                    <span>تم إنشاء وتفعيل كلمة المرور بنجاح!</span>
                  </div>
                  <p className="text-xs leading-relaxed font-medium text-emerald-700">
                    تم تحديث كلمة المرور في النظام، وسيُطلب من المستخدم تلقائياً
                    تعيين كلمة مروره الخاصة فور أول تسجيل دخول لحماية حسابه.
                  </p>
                </div>

                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <span className="mb-1 block text-xs font-bold text-slate-500">
                      البريد الإلكتروني للدخول:
                    </span>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {passwordResult.email || accountEmail || user.email}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            passwordResult.email ||
                              accountEmail ||
                              user.email ||
                              '',
                            'code'
                          )
                        }
                        className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>نسخ</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="mb-1 block text-xs font-bold text-slate-500">
                      كلمة المرور المؤقتة / الرمز:
                    </span>
                    <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 px-3.5 py-2.5">
                      <span
                        className="font-mono text-base font-black tracking-wider text-indigo-900"
                        dir="ltr"
                      >
                        {passwordResult.tempCode}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(passwordResult.tempCode, 'code')
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                      >
                        {copiedKey === 'code' ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {copiedKey === 'code' ? 'تم النسخ' : 'نسخ الكلمة'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsapp}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-700"
                  >
                    {copiedKey === 'whatsapp' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span>
                      {copiedKey === 'whatsapp'
                        ? 'تم نسخ رسالة الواتساب!'
                        : 'نسخ رسالة واتساب جاهزة للمستخدم'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordResult(null);
                      setShowPasswordModal(false);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    تم وإغلاق
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed font-medium text-slate-600">
                  اختر طريقة منح كلمة المرور للمستخدم لمساعدته على تسجيل الدخول
                  فوراً:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPasswordMode('auto')}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-right transition-all ${
                      passwordMode === 'auto'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-xs font-black text-slate-900">
                      رمز مؤقت تلقائي
                    </span>
                    <span className="mt-0.5 text-[11px] font-medium text-slate-500">
                      رمز آمن من 12 خانة سهل القراءة على واتساب
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPasswordMode('custom')}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-right transition-all ${
                      passwordMode === 'custom'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-xs font-black text-slate-900">
                      كلمة مرور مخصصة
                    </span>
                    <span className="mt-0.5 text-[11px] font-medium text-slate-500">
                      كتابة كلمة مرور تحددها الإدارة يدوياً
                    </span>
                  </button>
                </div>

                {passwordMode === 'custom' && (
                  <Field
                    label="كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل)"
                    name="customPassword"
                    required
                    error={passwordFieldError || undefined}
                    className="pt-1"
                  >
                    <TextInput
                      dir="ltr"
                      placeholder="اكتب كلمة المرور هنا…"
                      className="font-mono"
                      value={customPasswordInput}
                      onChange={(e) => setCustomPasswordInput(e.target.value)}
                    />
                  </Field>
                )}

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] leading-relaxed font-medium text-amber-900">
                  💡 <strong>ملاحظة أمنية:</strong> في كلتا الحالتين، بمجرد أن
                  يدخل المستخدم بهذه الكلمة سيطلب منه النظام فوراً تعيين كلمة
                  مروره الدائمة والسرية قبل الدخول إلى حسابه.
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    إلغاء
                  </button>
                  <BusyButton
                    busy={resettingPassword}
                    pendingLabel="جارٍ التعيين…"
                    onClick={handleResetPassword}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>حفظ وتوليد كلمة المرور</span>
                  </BusyButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── نافذة تعديل دور المستخدم ─── */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className="absolute top-5 left-5 rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  تعديل دور المستخدم
                </h3>
                <p className="text-xs font-medium text-slate-500">
                  {user.fullName}
                </p>
              </div>
            </div>

            {roleFeedback && (
              <div
                className={`rounded-xl p-3 text-xs font-bold ${
                  roleFeedback.ok
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {roleFeedback.msg}
              </div>
            )}

            <Field
              label="اختر الدور الجديد:"
              name="role"
              required
              error={roleFieldError || undefined}
              hint="* ملاحظة: دور المدرب يتم تعيينه عبر شاشة «المدربين» لضمان إنشاء ملف تدريبي متكامل."
            >
              <Select
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value)}
              >
                {roleChoices(
                  [
                    'customer',
                    'service_provider',
                    'publisher',
                    'general_supervisor',
                    'super_admin',
                  ],
                  adminRoles,
                  ROLE_LABELS,
                  isSuperAdmin
                ).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <BusyButton
                busy={roleSaving}
                disabled={selectedNewRole === currentRole}
                onClick={handleRoleChange}
              >
                تأكيد تغيير الدور
              </BusyButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
