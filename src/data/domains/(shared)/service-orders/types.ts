

export type ServiceOrderRow = {
  id: string;
  buyerProfileId: string;
  serviceId: string | null;
  serviceName: string;
  instructorId: string | null;
  instructorName: string | null;
  providerId: string | null;
  /** اسم مقدّم الخدمة — المنصة أو المدرب أو المستقل. */
  providerName: string | null;
  providerKind: 'platform' | 'instructor' | 'individual' | null;
  /** موعد التسليم المتفق عليه. بيتحط وقت تأكيد الدفع. */
  dueAt: string | null;
  dueNote: string | null;
  amount: number;
  status: string;
  transactionReference: string | null;
  paymentReference: string | null;
  paymentMethod: string | null;
  paymentReceiptUrl: string | null;
  createdAt: string;
  deliveredAt: string | null;
  completedAt: string | null;
  instructorEarning: number | null;
  /** لمين الخدمة: المشتري نفسه، أو فرد من عائلته. */
  participantType: 'self' | 'child';
  /** اسم المستفيد لما يكون فرد من العائلة. فاضي لما الطلب للمشتري. */
  participantName: string | null;
  /** تاريخ ميلاد المستفيد — مقدّم الخدمة بيظبط الشغل على السن. */
  participantBirthDate: string | null;
};

export type ServiceOrderMessage = {
  id: string;
  orderId: string;
  senderProfileId: string;
  senderName: string;
  body: string;
  isDelivery: boolean;
  createdAt: string;
};
