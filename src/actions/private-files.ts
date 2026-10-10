'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { privateFileTicket, privateFileUrl, type PrivateFileTicket } from '@/lib/cloudinary-private';
import { deletePrivateAssets, getPrivateAsset } from '@/lib/cloudinary-admin';
import {
  CLOSED_ORDER_STATUSES,
  FILES_PER_DOCUMENT_MAX,
  FILES_PER_ORDER_MAX,
  WORKSPACE_FILE_MAX_MB,
  cleanFileName,
  extensionOf,
  extensionsFor,
  fileProblem,
  kindOfExtension,
  normalizeKinds,
  normalizeMaxMb,
  privateFilesFolder,
  resourceTypeFor,
  type FileRules,
} from '@/lib/private-files';
import { notifyUser, getInstructorUserId, getProviderUserId } from '@/lib/notifications';
import { canManageWriterContent } from '@/lib/document-control';

/**
 * رفع وتحميل الملفات الخاصة (ملف 20).
 *
 * ── الطريق ──────────────────────────────────────────────────
 *
 *   ① المتصفح يطلب **تذكرة** للطلب/المستند ← الخادم يتأكد إنه من
 *      أطرافه، وإن الرفع مسموح، وبيوقّع على مجلّد الطلب ونوع الملف.
 *   ② المتصفح يرفع على Cloudinary مباشرة (مخفي — `authenticated`).
 *   ③ المتصفح يقول «خلّصت» ← الخادم **بيسأل Cloudinary نفسه** عن الحجم
 *      والنوع الحقيقيين. لو أكبر من المسموح بيمسحه ويرفض. لو تمام
 *      بيسجّله في `private_files` بمفتاح الخدمة.
 *
 * ⚠️ مفيش سياسة كتابة للمستخدم على الجدول عن قصد: لو المتصفح يقدر
 *    يسجّل صف، يقدر يسجّل رقم ملف حد تاني ويطلب رابطه.
 *
 * ⚠️ بترجّع ولا بترمي — Next بيمسح نصّ الاستثناء في الإنتاج.
 */

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

export type FileTicketResult = { ok: true; ticket: PrivateFileTicket } | Fail;
export type FileResult = { ok: true } | Fail;

type Owner = { orderId: string } | { documentId: string };

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/* ── الطلب ─────────────────────────────────────────────────── */

async function loadOrderContext(orderId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS: بيرجع الطلب لأطرافه بس (العميل، المكلّف، الإدارة).
  const { data: order } = await supabase
    .from('service_orders')
    .select('id, status, buyer_profile_id, instructor_id, provider_id, standalone_service_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return fail('الطلب غير موجود');
  if (!order.standalone_service_id) return fail('الطلب ده مابيقبلش ملفات');

  const { data: service } = await supabase
    .from('standalone_services')
    .select('*')
    .eq('id', order.standalone_service_id)
    .maybeSingle();
  if (!service?.allows_files) return fail('الخدمة دي مابتقبلش ملفات');

  const rules: FileRules = {
    kinds: normalizeKinds(service.file_kinds),
    maxMb: normalizeMaxMb(service.file_max_mb),
  };
  const closed = (CLOSED_ORDER_STATUSES as readonly string[]).includes(order.status);
  return { ok: true as const, user, supabase, order, rules, closed };
}

export async function getOrderFileTicket(orderId: string, fileName: string): Promise<FileTicketResult> {
  try {
    const ctx = await loadOrderContext(orderId);
    if (!ctx.ok) return ctx;
    if (ctx.closed) return fail('الطلب اتقفل — مفيش رفع ملفات تاني عليه');

    const kind = kindOfExtension(extensionOf(fileName));
    if (!kind || !ctx.rules.kinds.includes(kind)) {
      return fail(fileProblem({ name: fileName, size: 1 }, ctx.rules) ?? 'نوع الملف مش مسموح');
    }

    const { count } = await ctx.supabase
      .from('private_files')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', orderId);
    if ((count ?? 0) >= FILES_PER_ORDER_MAX) {
      return fail(`وصلت لأقصى عدد ملفات على الطلب (${FILES_PER_ORDER_MAX})`);
    }

    return ticketFor({ orderId }, kind === 'image' ? 'image' : 'raw', extensionsFor([kind]));
  } catch (err) {
    return fail(errorText(err, 'تعذّر تجهيز الرفع'));
  }
}

export async function registerOrderFile(
  orderId: string,
  uploaded: { publicId: string; resourceType: 'image' | 'raw'; fileName: string },
): Promise<FileResult> {
  try {
    const ctx = await loadOrderContext(orderId);
    if (!ctx.ok) return ctx;
    if (ctx.closed) return fail('الطلب اتقفل — مفيش رفع ملفات تاني عليه');

    const saved = await verifyAndSave({ orderId }, uploaded, ctx.rules, ctx.user.id, {
      is_delivery: ctx.user.id !== ctx.order.buyer_profile_id,
    });
    if (!saved.ok) return saved;

    // الطرف التاني يعرف — زي الرسايل.
    const fromBuyer = ctx.user.id === ctx.order.buyer_profile_id;
    const recipient = fromBuyer
      ? ctx.order.provider_id
        ? await getProviderUserId(ctx.order.provider_id)
        : ctx.order.instructor_id
          ? await getInstructorUserId(ctx.order.instructor_id)
          : null
      : ctx.order.buyer_profile_id;
    await notifyUser({
      event: 'service_message',
      recipientProfileId: recipient,
      title: 'ملف جديد على طلب خدمة',
      message: saved.fileName,
      link: fromBuyer ? `/dashboard/provider/orders/${orderId}` : `/account/orders/creative-writing/${orderId}`,
    });

    revalidatePath(`/account/orders/creative-writing/${orderId}`);
    revalidatePath(`/dashboard/provider/orders/${orderId}`);
    revalidatePath(`/dashboard/instructor/services/orders/${orderId}`);
    revalidatePath(`/dashboard/admin/orders/services/${orderId}`);
    return { ok: true };
  } catch (err) {
    return fail(errorText(err, 'تعذّر حفظ الملف'));
  }
}

/* ── مساحة الكتابة ─────────────────────────────────────────── */

const WORKSPACE_RULES: FileRules = { kinds: ['pdf', 'word', 'image'], maxMb: WORKSPACE_FILE_MAX_MB };

async function loadDocumentContext(documentId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  // RLS: صاحبه، وولي أمره، ومدربه، والإدارة.
  const { data: doc } = await supabase
    .from('portfolio_documents')
    .select('id, student_id, status')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc) return fail('المستند غير موجود');
  // الرفع لصاحب المستند ومدربه — ولي الأمر بيقرا بس.
  const isOwner = doc.student_id === user.id;
  const isInstructor = user.role === 'instructor';
  if (!isOwner && !isInstructor) return fail('مش مسموح لك ترفع ملفات على المستند ده');
  return { ok: true as const, user, supabase, doc, isOwner };
}

export async function getDocumentFileTicket(documentId: string, fileName: string): Promise<FileTicketResult> {
  try {
    const ctx = await loadDocumentContext(documentId);
    if (!ctx.ok) return ctx;
    const kind = kindOfExtension(extensionOf(fileName));
    if (!kind) return fail(fileProblem({ name: fileName, size: 1 }, WORKSPACE_RULES) ?? 'نوع الملف مش مسموح');

    const { count } = await ctx.supabase
      .from('private_files')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', documentId);
    if ((count ?? 0) >= FILES_PER_DOCUMENT_MAX) {
      return fail(`وصلت لأقصى عدد ملفات على المستند (${FILES_PER_DOCUMENT_MAX})`);
    }
    return ticketFor({ documentId }, resourceTypeFor(kind), extensionsFor([kind]));
  } catch (err) {
    return fail(errorText(err, 'تعذّر تجهيز الرفع'));
  }
}

export async function registerDocumentFile(
  documentId: string,
  uploaded: { publicId: string; resourceType: 'image' | 'raw'; fileName: string },
): Promise<FileResult> {
  try {
    const ctx = await loadDocumentContext(documentId);
    if (!ctx.ok) return ctx;
    const saved = await verifyAndSave({ documentId }, uploaded, WORKSPACE_RULES, ctx.user.id, {
      // ملف المدرب = «تصحيح» راجع للطالب.
      is_delivery: !ctx.isOwner,
    });
    if (!saved.ok) return saved;

    revalidatePath(`/dashboard/student/portfolio/${documentId}`);
    revalidatePath(`/account/writing/${documentId}`);
    return { ok: true };
  } catch (err) {
    return fail(errorText(err, 'تعذّر حفظ الملف'));
  }
}

/* ── التحميل ───────────────────────────────────────────────── */

/** رابط تحميل بيخلص بعد ١٠ دقايق — لأي حد يقدر يقرا صف الملف. */
export async function getPrivateFileLink(fileId: string): Promise<{ ok: true; url: string } | Fail> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: file } = await supabase
      .from('private_files')
      .select('public_id, resource_type, format, deleted_at')
      .eq('id', fileId)
      .maybeSingle();
    if (!file) return fail('الملف غير موجود');
    if (file.deleted_at) return fail('الملف اتمسح من السيرفر بعد انتهاء مدة الحفظ');
    const url = privateFileUrl({
      publicId: file.public_id,
      resourceType: file.resource_type === 'image' ? 'image' : 'raw',
      format: file.format,
    });
    if (!url) return fail('تحميل الملفات متوقف مؤقتًا — كلّمنا من صفحة الدعم');
    return { ok: true, url };
  } catch (err) {
    return fail(errorText(err, 'تعذّر تجهيز التحميل'));
  }
}

/* ── الحذف ─────────────────────────────────────────────────── */

/**
 * مسح ملف (طلب تامر، 10 أكتوبر) — من Cloudinary فورًا، والصف كمان.
 *
 *   • اللي رفعه بس يمسحه — مش ملفات الطرف التاني.
 *   • ولي الأمر يمسح ملفات مستندات ابنه الأصغر من ١٢.
 *
 * ⚠️ مالوش رجوع. والمحادثة والطلب نفسه بيفضلوا (سجل).
 */
export async function deletePrivateFile(fileId: string): Promise<FileResult> {
  try {
    const user = await requireUser();
    const supabase = await createClient();
    // RLS: لو مش من أطراف الطلب/المستند الصف مابيرجعش أصلًا.
    const { data: file } = await supabase
      .from('private_files')
      .select('id, order_id, document_id, uploader_profile_id, public_id, resource_type, deleted_at')
      .eq('id', fileId)
      .maybeSingle();
    if (!file) return fail('الملف غير موجود');

    let allowed = file.uploader_profile_id === user.id;
    if (!allowed && file.document_id) {
      const { data: doc } = await supabase
        .from('portfolio_documents')
        .select('student_id')
        .eq('id', file.document_id)
        .maybeSingle();
      // ولي الأمر (للأصغر من ١٢) — مش المدرب.
      allowed = Boolean(doc) && doc!.student_id !== user.id && user.role !== 'instructor'
        && (await canManageWriterContent(user.id, doc!.student_id));
    }
    if (!allowed) return fail('تقدر تمسح الملفات اللي إنت رفعتها بس');

    if (!file.deleted_at) {
      const gone = await deletePrivateAssets(file.resource_type === 'image' ? 'image' : 'raw', [file.public_id]);
      if (!gone.ok) return fail('تعذّر مسح الملف — جرّب تاني');
    }
    const { error } = await createAdminClient().from('private_files').delete().eq('id', file.id);
    if (error) {
      console.error('Private file row delete failed', error);
      return fail('الملف اتمسح بس فضل في القايمة — حدّث الصفحة');
    }

    if (file.order_id) {
      revalidatePath(`/account/orders/creative-writing/${file.order_id}`);
      revalidatePath(`/dashboard/provider/orders/${file.order_id}`);
      revalidatePath(`/dashboard/instructor/services/orders/${file.order_id}`);
      revalidatePath(`/dashboard/admin/orders/services/${file.order_id}`);
    }
    if (file.document_id) {
      revalidatePath(`/dashboard/student/portfolio/${file.document_id}`);
      revalidatePath(`/account/writing/${file.document_id}`);
    }
    return { ok: true };
  } catch (err) {
    return fail(errorText(err, 'تعذّر مسح الملف'));
  }
}

/* ── مشترك ─────────────────────────────────────────────────── */

function ticketFor(owner: Owner, resourceType: 'image' | 'raw', extensions: string[]): FileTicketResult {
  if (!isAdminApiConfigured()) return fail('رفع الملفات متوقف مؤقتًا — كلّمنا من صفحة الدعم');
  const ticket = privateFileTicket(privateFilesFolder(owner), resourceType, extensions);
  if (!ticket) {
    console.error('Private files: Cloudinary credentials missing');
    return fail('رفع الملفات متوقف مؤقتًا — كلّمنا من صفحة الدعم');
  }
  return { ok: true, ticket };
}

async function verifyAndSave(
  owner: Owner,
  uploaded: { publicId: string; resourceType: 'image' | 'raw'; fileName: string },
  rules: FileRules,
  uploaderId: string,
  extra: { is_delivery: boolean },
): Promise<({ ok: true; fileName: string }) | Fail> {
  const folder = privateFilesFolder(owner);
  const publicId = String(uploaded.publicId ?? '');
  const resourceType = uploaded.resourceType === 'image' ? 'image' : 'raw';
  if (!publicId.startsWith(`${folder}/`) || publicId.includes('..')) return fail('ملف غير صالح');

  // الحجم والنوع من Cloudinary نفسه — مش من المتصفح.
  const asset = await getPrivateAsset(resourceType, publicId);
  if (!asset.ok) return fail('مالقيناش الملف المرفوع — جرّب ترفعه تاني');

  const fileName = cleanFileName(uploaded.fileName);
  // الخام رقمه فيه الامتداد؛ الصورة امتدادها في `format`.
  const ext = resourceType === 'image' ? (asset.data.format ?? '') : extensionOf(publicId);
  const problem = fileProblem({ name: `x.${ext}`, size: asset.data.bytes }, rules);
  if (problem) {
    await deletePrivateAssets(resourceType, [publicId]);
    return fail(problem);
  }

  const admin = createAdminClient();
  const { error } = await admin.from('private_files').insert({
    order_id: 'orderId' in owner ? owner.orderId : null,
    document_id: 'documentId' in owner ? owner.documentId : null,
    uploader_profile_id: uploaderId,
    file_name: fileName,
    public_id: publicId,
    resource_type: resourceType,
    format: asset.data.format ?? ext ?? null,
    bytes: asset.data.bytes,
    is_delivery: extra.is_delivery,
  });
  if (error) {
    console.error('Private file insert failed', error);
    await deletePrivateAssets(resourceType, [publicId]);
    return fail('تعذّر حفظ الملف — جرّب تاني');
  }
  return { ok: true, fileName };
}
