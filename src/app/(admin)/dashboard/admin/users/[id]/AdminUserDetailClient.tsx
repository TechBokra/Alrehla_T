'use client';

import React, { useState, useMemo } from 'react';
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
import { ROLE_LABELS } from '@/app/dashboard/admin/users/UsersClient';
import { resetUserPassword, updateUserRole } from '@/actions/admin-users';
import { formatDate, formatPrice } from '@/lib/utils';
import { formatCairo, PLATFORM_TIMEZONE } from '@/lib/timezone';
import { Pagination } from '@/components/dashboard/Pagination';
import { FormError, FormSuccess } from '@/components/ui/FormError';

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
}: AdminUserDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Role change state
  const [currentRole, setCurrentRole] = useState<UserRole>(user.role);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>(user.role);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleFeedback, setRoleFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Password reset state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [customPasswordInput, setCustomPasswordInput] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordResult, setPasswordResult] = useState<{
    email: string;
    tempCode: string;
    isCustom: boolean;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<'id' | 'code' | 'whatsapp' | null>(null);

  // Orders tab sub-view
  const [orderSubTab, setOrderSubTab] = useState<'products' | 'services'>('products');
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
    setPasswordResult(null);
    if (passwordMode === 'custom' && customPasswordInput.trim().length < 8) {
      setPasswordError('كلمة المرور يجب أن تكون 8 خانات على الأقل.');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await resetUserPassword({
        userId: user.id,
        customPassword: passwordMode === 'custom' ? customPasswordInput.trim() : undefined,
      });
      if (res.ok) {
        setPasswordResult(res);
        setCustomPasswordInput('');
      } else {
        setPasswordError(res.error);
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'تعذّر إعادة تعيين كلمة المرور');
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
    const emailToUse = passwordResult.email || accountEmail || user.email || 'بريدك الإلكتروني المسجل';
    const msg = `مرحباً أستاذ/ة ${user.fullName}،\n\nإليك بيانات تسجيل الدخول الخاصة بحسابك في منصة الرحلات:\n• البريد الإلكتروني: ${emailToUse}\n• كلمة المرور المؤقتة: ${passwordResult.tempCode}\n• رابط الدخول: https://alrehlat.vercel.app/login\n\n⚠️ ملاحظة هامة: فور تسجيل الدخول، سيطلب منك الموقع تعيين كلمة مرور شخصية خاصة بك لحماية بيانات حسابك.\n\nنتمنى لك تجربة ممتعة وموفقة في المنصة!`;
    handleCopy(msg, 'whatsapp');
  };

  // Role Change Handler
  const handleRoleChange = async () => {
    setRoleSaving(true);
    setRoleFeedback(null);
    try {
      const res = await updateUserRole(user.id, selectedNewRole);
      if (res.ok) {
        setCurrentRole(selectedNewRole);
        setRoleFeedback({ ok: true, msg: 'تم تغيير دور المستخدم بنجاح.' });
        setTimeout(() => setShowRoleModal(false), 1500);
        router.refresh();
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
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        if (!o.id.toLowerCase().includes(q) && !(o.trackingReference || '').toLowerCase().includes(q)) {
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
      if (orderStatusFilter !== 'all' && so.status !== orderStatusFilter) return false;
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
      if (sessionStatusFilter !== 'all' && s.status !== sessionStatusFilter) return false;
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
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white font-black text-xl shadow-xs">
              {user.fullName ? user.fullName[0] : 'م'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">{user.fullName}</h2>
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  {ROLE_LABELS[currentRole] || currentRole}
                </span>
                {user.isGuardian && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-bold text-violet-800 border border-violet-200">
                    <Users className="h-3 w-3" />
                    ولي أمر ({childrenList.length} أبناء)
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono text-slate-700">{accountEmail || user.email || 'لا يوجد بريد مسجل'}</span>
                </div>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>انضم في: {formatDate(user.createdAt)}</span>
                </div>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-mono text-[11px]">ID: {user.id.slice(0, 8)}…</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(user.id, 'id')}
                    className="text-slate-400 hover:text-slate-700 p-0.5"
                    title="نسخ المعرف الكامل"
                  >
                    {copiedKey === 'id' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة (تغيير كلمة المرور وتعديل الدور) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordError('');
                setPasswordResult(null);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 px-3.5 py-2 text-xs font-bold text-indigo-900 transition-colors shadow-2xs"
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
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors shadow-2xs"
            >
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              <span>تعديل الدور</span>
            </button>

            {user.isGuardian && (
              <Link
                href={`/dashboard/admin/users/${user.id}/children`}
                className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/80 hover:bg-violet-100 px-3.5 py-2 text-xs font-bold text-violet-900 transition-colors shadow-2xs"
              >
                <Users className="h-3.5 w-3.5 text-violet-700" />
                <span>إدارة الأبناء</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. شريط التبويبات الرئيسي (Tabs Navigation) ─── */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1 bg-white p-1.5 rounded-2xl shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all shrink-0 ${
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
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all shrink-0 ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Package className="h-4 w-4" />
          <span>الطلبات والمشتريات</span>
          <span className="rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[10px]">
            {totalOrdersCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all shrink-0 ${
            activeTab === 'sessions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>المواعيد والجلسات</span>
          <span className="rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[10px]">
            {sessions.length}
          </span>
        </button>

        {user.isGuardian && (
          <button
            type="button"
            onClick={() => setActiveTab('children')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all shrink-0 ${
              activeTab === 'children'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>الأبناء والتابعون</span>
            <span className="rounded-md bg-violet-100 text-violet-800 px-1.5 py-0.2 text-[10px]">
              {childrenList.length}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all shrink-0 ${
            activeTab === 'tickets'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>تذاكر الدعم</span>
          <span className="rounded-md bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[10px]">
            {tickets.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: نظرة عامة والملف الشخصي ─── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* كارت 1: بيانات الحساب والاتصال */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <User className="h-4 w-4 text-slate-600" />
                <h3 className="font-black text-slate-800 text-sm">بيانات الملف الشخصي</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">الاسم بالكامل:</span>
                  <span className="font-bold text-slate-900">{user.fullName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">الدور الحالي:</span>
                  <span className="font-bold text-indigo-700">{ROLE_LABELS[currentRole] || currentRole}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">تاريخ التسجيل:</span>
                  <span className="font-bold text-slate-800">{formatDate(user.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedNewRole(currentRole);
                  setShowRoleModal(true);
                }}
                className="w-full text-center text-xs font-bold text-indigo-600 hover:text-indigo-800 py-1"
              >
                تغيير الدور والصلاحيات &larr;
              </button>
            </div>
          </div>

          {/* كارت 2: بيانات الدخول وكلمة المرور للدعم الفني */}
          <div className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-indigo-100 pb-3 mb-4">
                <KeyRound className="h-4 w-4 text-indigo-600" />
                <h3 className="font-black text-slate-800 text-sm">بيانات الدخول والأمان</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">البريد الإلكتروني للدخول:</span>
                  <span className="font-bold text-slate-900 font-mono text-xs break-all block p-2 rounded-xl bg-slate-50 border border-slate-100">
                    {accountEmail || user.email || 'مرتبط بحساب المنصة'}
                  </span>
                </div>
                <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-2.5 text-indigo-900 text-[11px] leading-relaxed font-medium">
                  لو المستخدم متعثر في الدخول أو نسي كلمة المرور، يمكنك تزويده بكلمة مرور أو رمز مؤقت فوراً من هنا.
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordError('');
                  setPasswordResult(null);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 text-xs shadow-2xs transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>إعادة تعيين / منح كلمة مرور</span>
              </button>
            </div>
          </div>

          {/* كارت 3: حالة العائلة والأبناء */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Users className="h-4 w-4 text-violet-600" />
                <h3 className="font-black text-slate-800 text-sm">العائلة والأبناء</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">حساب ولي أمر:</span>
                  <span className="font-bold text-slate-800">{user.isGuardian ? 'نعم (حساب ولي أمر معتمد)' : 'لا (حساب فردي)'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">عدد الأبناء المسجلين:</span>
                  <span className="font-black text-violet-900 text-base">{childrenList.length}</span>
                </div>
                {childrenList.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {childrenList.slice(0, 3).map((ch) => (
                      <span key={ch.id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {ch.fullName}
                      </span>
                    ))}
                    {childrenList.length > 3 && (
                      <span className="text-[11px] text-slate-400 font-bold">+{childrenList.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {user.isGuardian && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('children')}
                  className="w-full text-center text-xs font-bold text-violet-600 hover:text-violet-800 py-1"
                >
                  استعراض الأبناء وحساباتهم &larr;
                </button>
              </div>
            )}
          </div>

          {/* كارت 4: ملخص الأنشطة والمعاملات */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <h3 className="font-black text-slate-800 text-sm">ملخص المعاملات</h3>
              </div>
              <div className="space-y-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    setOrderSubTab('products');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">طلبات المتجر (إنها لك):</span>
                  <span className="font-black text-slate-900">{orders.length} طلبات</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('orders');
                    setOrderSubTab('services');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">طلبات الخدمات الإبداعية:</span>
                  <span className="font-black text-slate-900">{serviceOrders.length} طلبات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('sessions')}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">الجلسات التدريبية:</span>
                  <span className="font-black text-slate-900">{sessions.length} جلسة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('tickets')}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">تذاكر الدعم الفني:</span>
                  <span className="font-black text-slate-900">{tickets.length} تذكرة</span>
                </button>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
              اضغط على أي بند للانتقال لتفاصيله مباشرة.
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: الطلبات والمشتريات ─── */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
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
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث في الطلبات…"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setOrderPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white pr-9 pl-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
                />
              </div>

              <select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setOrderPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
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

          {orderSubTab === 'products' ? (
            paginatedOrders.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3.5">رقم الطلب</th>
                        <th className="p-3.5">التاريخ</th>
                        <th className="p-3.5">عدد المنتجات</th>
                        <th className="p-3.5">الإجمالي</th>
                        <th className="p-3.5">الحالة</th>
                        <th className="p-3.5">رقم التتبع</th>
                        <th className="p-3.5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-bold font-mono text-slate-900">{o.id}</td>
                          <td className="p-3.5 text-slate-600">{formatDate(o.createdAt)}</td>
                          <td className="p-3.5 text-slate-800">{o.itemsCount} منتج</td>
                          <td className="p-3.5 font-bold text-slate-900">{formatPrice(o.totalAmount)}</td>
                          <td className="p-3.5">
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700">
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-600">{o.trackingReference || '—'}</td>
                          <td className="p-3.5 text-center">
                            <Link
                              href={`/dashboard/admin/orders/${o.id}`}
                              className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1"
                            >
                              <span>عرض</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {Math.ceil(filteredOrders.length / PAGE_SIZE) > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 px-2">
                    <span className="text-xs text-slate-500 font-medium">
                      عرض {paginatedOrders.length} من {filteredOrders.length} طلب
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
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-400 text-xs">
                لا توجد طلبات منتجات تطابق الفلاتر المحددة.
              </div>
            )
          ) : (
            paginatedServiceOrders.length > 0 ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-3.5">رقم الطلب</th>
                        <th className="p-3.5">اسم الخدمة</th>
                        <th className="p-3.5">المدرب</th>
                        <th className="p-3.5">المبلغ</th>
                        <th className="p-3.5">الحالة</th>
                        <th className="p-3.5">التاريخ</th>
                        <th className="p-3.5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedServiceOrders.map((so) => (
                        <tr key={so.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="p-3.5 font-bold font-mono text-slate-900">{so.id}</td>
                          <td className="p-3.5 font-bold text-slate-800">{so.serviceName}</td>
                          <td className="p-3.5 text-slate-600">{so.instructorName || '—'}</td>
                          <td className="p-3.5 font-bold text-slate-900">{formatPrice(so.amount)}</td>
                          <td className="p-3.5">
                            <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700">
                              {so.status}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">{formatDate(so.createdAt)}</td>
                          <td className="p-3.5 text-center">
                            <Link
                              href={`/account/orders/creative-writing/${so.id}`}
                              className="text-indigo-600 hover:text-indigo-800 font-bold inline-flex items-center gap-1"
                            >
                              <span>عرض</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {Math.ceil(filteredServiceOrders.length / PAGE_SIZE) > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 px-2">
                    <span className="text-xs text-slate-500 font-medium">
                      عرض {paginatedServiceOrders.length} من {filteredServiceOrders.length} طلب
                    </span>
                    <Pagination
                      page={orderPage}
                      totalPages={Math.ceil(filteredServiceOrders.length / PAGE_SIZE)}
                      onPageChange={(p) => setOrderPage(p)}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-400 text-xs">
                لا توجد طلبات خدمات إبداعية تطابق الفلاتر.
              </div>
            )
          )}
        </div>
      )}

      {/* ─── TAB 3: المواعيد والجلسات ─── */}
      {activeTab === 'sessions' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <h3 className="text-sm font-black text-slate-900">سجل الجلسات التدريبية ({sessions.length})</h3>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث بالباقة أو المدرب…"
                  value={sessionSearch}
                  onChange={(e) => {
                    setSessionSearch(e.target.value);
                    setSessionPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white pr-9 pl-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
                />
              </div>

              <select
                value={sessionStatusFilter}
                onChange={(e) => {
                  setSessionStatusFilter(e.target.value);
                  setSessionPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-slate-800"
              >
                <option value="all">كل الحالات</option>
                <option value="scheduled">مجدولة</option>
                <option value="confirmed">مؤكدة</option>
                <option value="completed">مكتملة</option>
                <option value="cancelled">ملغاة</option>
              </select>
            </div>
          </div>

          {paginatedSessions.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3.5">الجلسة</th>
                      <th className="p-3.5">الباقة</th>
                      <th className="p-3.5">المدرب</th>
                      <th className="p-3.5">الموعد</th>
                      <th className="p-3.5">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">جلسة #{s.sessionNumber}</td>
                        <td className="p-3.5 font-medium text-slate-800">{s.packageName || '—'}</td>
                        <td className="p-3.5 text-slate-600">{s.instructorName || '—'}</td>
                        <td className="p-3.5 text-slate-700 font-mono">
                          {formatCairo(s.scheduledAt, { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 font-bold text-xs ${
                              s.status === 'confirmed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : s.status === 'completed'
                                ? 'bg-slate-100 text-slate-700'
                                : s.status === 'cancelled'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {Math.ceil(filteredSessions.length / PAGE_SIZE) > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 pt-4 px-2">
                  <span className="text-xs text-slate-500 font-medium">
                    عرض {paginatedSessions.length} من أصل {filteredSessions.length} جلسة
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
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-400 text-xs">
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
              <h3 className="text-sm font-black text-slate-900">الأبناء المضافون تحت هذا الحساب ({childrenList.length})</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                يمكن لولي الأمر تسجيل أبنائه في باقات الكتابة والقصص المخصصة.
              </p>
            </div>
            <Link
              href={`/dashboard/admin/users/${user.id}/children`}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 text-xs transition-colors shadow-2xs"
            >
              صفحة إدارة الأبناء التفصيلية
            </Link>
          </div>

          {childrenList.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {childrenList.map((ch) => (
                <div key={ch.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-black text-sm">
                      {ch.fullName ? ch.fullName[0] : 'ط'}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{ch.fullName}</h4>
                      <p className="text-xs text-slate-500">
                        {ch.age !== null && ch.age !== undefined ? `${ch.age} سنوات` : 'العمر غير محدد'}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-slate-400">تاريخ الميلاد: </span>
                      <span>{ch.birthDate ? formatDate(ch.birthDate) : 'غير مسجل'}</span>
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
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-400 text-xs">
              لم يقم ولي الأمر بإضافة أي أبناء حتى الآن.
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: تذاكر الدعم ─── */}
      {activeTab === 'tickets' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="text-sm font-black text-slate-900">تذاكر الدعم الفني ({tickets.length})</h3>
          </div>

          {tickets.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3.5">الموضوع</th>
                    <th className="p-3.5">القسم</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">{t.subject}</td>
                      <td className="p-3.5 text-slate-600">{t.category}</td>
                      <td className="p-3.5">
                        <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700">
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-400 text-xs">
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
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  إدارة دخول المستخدم: {user.fullName}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {accountEmail || user.email ? `البريد: ${accountEmail || user.email}` : 'حساب معتمد في المنصة'}
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700">
                {passwordError}
              </div>
            )}

            {passwordResult ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>تم إنشاء وتفعيل كلمة المرور بنجاح!</span>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                    تم تحديث كلمة المرور في النظام، وسيُطلب من المستخدم تلقائياً تعيين كلمة مروره الخاصة فور أول تسجيل دخول لحماية حسابه.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">البريد الإلكتروني للدخول:</span>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {passwordResult.email || accountEmail || user.email}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(passwordResult.email || accountEmail || user.email || '', 'code')}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>نسخ</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">كلمة المرور المؤقتة / الرمز:</span>
                    <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 px-3.5 py-2.5">
                      <span className="font-mono text-base font-black tracking-wider text-indigo-900" dir="ltr">
                        {passwordResult.tempCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(passwordResult.tempCode, 'code')}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                      >
                        {copiedKey === 'code' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedKey === 'code' ? 'تم النسخ' : 'نسخ الكلمة'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsapp}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-xs shadow-xs transition-colors"
                  >
                    {copiedKey === 'whatsapp' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedKey === 'whatsapp' ? 'تم نسخ رسالة الواتساب!' : 'نسخ رسالة واتساب جاهزة للمستخدم'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordResult(null);
                      setShowPasswordModal(false);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    تم وإغلاق
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  اختر طريقة منح كلمة المرور للمستخدم لمساعدته على تسجيل الدخول فوراً:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPasswordMode('auto')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-right transition-all ${
                      passwordMode === 'auto'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-xs font-black text-slate-900">رمز مؤقت تلقائي</span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                      رمز آمن من 12 خانة سهل القراءة على واتساب
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPasswordMode('custom')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-right transition-all ${
                      passwordMode === 'custom'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-xs font-black text-slate-900">كلمة مرور مخصصة</span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                      كتابة كلمة مرور تحددها الإدارة يدوياً
                    </span>
                  </button>
                </div>

                {passwordMode === 'custom' && (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-bold text-slate-700">كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل)</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="اكتب كلمة المرور هنا…"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                      value={customPasswordInput}
                      onChange={(e) => setCustomPasswordInput(e.target.value)}
                    />
                  </div>
                )}

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 font-medium leading-relaxed">
                  💡 <strong>ملاحظة أمنية:</strong> في كلتا الحالتين، بمجرد أن يدخل المستخدم بهذه الكلمة سيطلب منه النظام فوراً تعيين كلمة مروره الدائمة والسرية قبل الدخول إلى حسابه.
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={resettingPassword}
                    onClick={handleResetPassword}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>{resettingPassword ? 'جارٍ التعيين…' : 'حفظ وتوليد كلمة المرور'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── نافذة تعديل دور المستخدم ─── */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">تعديل دور المستخدم</h3>
                <p className="text-xs text-slate-500 font-medium">{user.fullName}</p>
              </div>
            </div>

            {roleFeedback && (
              <div
                className={`p-3 rounded-xl text-xs font-bold ${
                  roleFeedback.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {roleFeedback.msg}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">اختر الدور الجديد:</label>
              <select
                value={selectedNewRole}
                onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-slate-800"
              >
                <option value="student">عميل / طالب</option>
                <option value="service_provider">مقدّم خدمة</option>
                <option value="publisher">ناشر</option>
                {isSuperAdmin && (
                  <>
                    <option value="general_supervisor">مشرف عام</option>
                    <option value="super_admin">مدير نظام</option>
                  </>
                )}
              </select>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                * ملاحظة: دور المدرب يتم تعيينه عبر شاشة «المدربين» لضمان إنشاء ملف تدريبي متكامل.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={roleSaving || selectedNewRole === currentRole}
                onClick={handleRoleChange}
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-xs"
              >
                {roleSaving ? 'جارٍ الحفظ…' : 'تأكيد تغيير الدور'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
