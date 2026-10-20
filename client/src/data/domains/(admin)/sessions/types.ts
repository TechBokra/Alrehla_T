import { SessionStatus } from '@/types';

export interface AdminSessionRow {
  id: string;
  sessionNumber: number;
  scheduledAt: string;
  status: SessionStatus;
  participantName: string;
  packageName: string;
  instructorName: string | null;
  /** الرقم المرجعي للحجز — هو اللي الإدارة بتدوّر بيه، لا معرّف الجلسة. */
  paymentReference: string | null;
  attendance: 'present' | 'absent' | null;
  reportText: string;
  reportedAt: string | null;
  /** معادها فات ولا اتقفلت ولا اتلغت — بند البلاغ بالحرف. */
  isOverdue: boolean;
  /** اسم الغرفة عند Daily — فاضي = الجلسة مالهاش مكان لقاء. */
  roomName: string | null;
}
