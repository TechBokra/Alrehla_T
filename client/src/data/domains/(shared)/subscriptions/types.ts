import type { BoxShipment } from '@/types';

/** طلب اشتراك صندوق لسه ماتأكدش — سطر في صفحة «اشتراكي». */
export type PendingBoxOrder = {
  orderId: string;
  planName: string;
  status: 'pending' | 'awaiting_verification';
  paymentReference?: string;
  createdAt: string;
};

/** صندوق مستحق التجهيز — سطر في شاشة «شحنات الشهر». */
export type DueBoxShipment = {
  shipment: BoxShipment;
  subscriptionId: string;
  planName: string;
  months: number;
  childName?: string;
  freeAddonName?: string;
  dueDate: string;
  overdue: boolean;
  recipient?: { name?: string; phone?: string; address?: string };
};
