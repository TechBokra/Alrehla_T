import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { isCertificateStatus, type CertificateStatus } from '@/lib/certificates';

export type Certificate = {
  id: string;
  subscriptionId: string;
  ownerId: string;
  participantName: string;
  packageName: string;
  certificateNo: string | null;
  status: CertificateStatus;
  completedAt: string;
  issuedAt: string | null;
  paperRequestedAt: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  addressLine: string | null;
  city: string | null;
  governorate: string | null;
  shippingNotes: string | null;
  trackingReference: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** رسوم الشحن (جنيه) — للنسخة الورقية بس. */
  shippingFee: number | null;
  paymentReference: string | null;
  paidAt: string | null;
};

const COLUMNS =
  'id, subscription_id, owner_id, participant_name, package_name, certificate_no, status, completed_at, issued_at, paper_requested_at, recipient_name, recipient_phone, address_line, city, governorate, shipping_notes, tracking_reference, shipped_at, delivered_at, shipping_fee, payment_reference, paid_at';

type Row = {
  id: string;
  subscription_id: string;
  owner_id: string;
  participant_name: string;
  package_name: string;
  certificate_no: string | null;
  status: string;
  completed_at: string;
  issued_at: string | null;
  paper_requested_at: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  address_line: string | null;
  city: string | null;
  governorate: string | null;
  shipping_notes: string | null;
  tracking_reference: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  shipping_fee: number | null;
  payment_reference: string | null;
  paid_at: string | null;
};

function toCertificate(r: Row): Certificate | null {
  if (!isCertificateStatus(r.status)) return null;
  return {
    id: r.id,
    subscriptionId: r.subscription_id,
    ownerId: r.owner_id,
    participantName: r.participant_name,
    packageName: r.package_name,
    certificateNo: r.certificate_no,
    status: r.status,
    completedAt: r.completed_at,
    issuedAt: r.issued_at,
    paperRequestedAt: r.paper_requested_at,
    recipientName: r.recipient_name,
    recipientPhone: r.recipient_phone,
    addressLine: r.address_line,
    city: r.city,
    governorate: r.governorate,
    shippingNotes: r.shipping_notes,
    trackingReference: r.tracking_reference,
    shippedAt: r.shipped_at,
    deliveredAt: r.delivered_at,
    shippingFee: r.shipping_fee === null ? null : Number(r.shipping_fee),
    paymentReference: r.payment_reference,
    paidAt: r.paid_at,
  };
}

const rows = (data: unknown) => ((data ?? []) as Row[]).map(toCertificate).filter((c): c is Certificate => c !== null);

/**
 * شهادات المستخدم الحالي (صلاحيات القاعدة بترجّع بتاعته بس)، أو كل الشهادات
 * للإدارة (`all`). قبل تشغيل ملف 20261107120000 الجدول مش موجود ← قايمة فاضية.
 */
export async function getCertificates(scope: { all: true } | { ownerId: string }): Promise<Certificate[]> {
  const supabase = await createClient();
  let q = supabase.from('course_certificates').select(COLUMNS).order('created_at', { ascending: false }).limit(500);
  if ('ownerId' in scope) q = q.eq('owner_id', scope.ownerId);
  const { data, error } = await q;
  if (error) {
    if (error.code !== '42P01') console.error('getCertificates', error.message);
    return [];
  }
  return rows(data);
}

export async function getCertificateById(id: string): Promise<Certificate | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from('course_certificates').select(COLUMNS).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toCertificate(data as Row);
}

export async function getCertificateForSubscription(subscriptionId: string): Promise<Certificate | null | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('course_certificates')
    .select(COLUMNS)
    .eq('subscription_id', subscriptionId)
    .maybeSingle();
  // undefined = الميزة لسه مش متفعّلة في القاعدة.
  if (error) return error.code === '42P01' ? undefined : null;
  return data ? toCertificate(data as Row) : null;
}
