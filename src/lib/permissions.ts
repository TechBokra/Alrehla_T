import { AdminPermission } from '@/types';

/**
 * أسماء الصلاحيات اللي بتظهر في الشاشة.
 *
 * مش في ملف الـ actions لأن ملف 'use server' ما بيصدّرش غير دوال async —
 * أي ثابت فيه بيكسر البناء.
 */
export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  canManageUsers: 'المستخدمون والعائلات',
  canManageInstructors: 'المدربون ومقدّمو الخدمة',
  canManagePublishers: 'الناشرون والمنتجات',
  canManageCatalog: 'الباقات والخدمات والتسعير',
  canManageSubscriptions: 'الاشتراكات وصندوق الرحلة',
  canManageOrders: 'الطلبات والشحن',
  canManageBookings: 'الحجوزات والجلسات',
  canManageSupport: 'الدعم وطلبات الانضمام',
  canManageContent: 'المحتوى وإعدادات الموقع',
  canManageFinance: 'المالية والمستحقات',
  canManagePayments: 'إعدادات الدفع (خطِرة)',
  canAssignWork: 'توزيع المهام والطلبات',
  canViewAuditLogs: 'السجلات والتدقيق',
};
