'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth-guard';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, isAdminApiConfigured } from '@/lib/supabase/admin';
import { getAttachmentStorageProvider } from '@/lib/attachments/provider';
import type { StorageLocator, UploadTicket } from '@/lib/attachments/types';
import {
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
  resourceTypeFor,
  type FileRules,
} from '@/lib/private-files';
import { notifyUser, getInstructorUserId, getProviderUserId } from '@/lib/notifications';
import type { Database, Json } from '@/types/supabase';

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

export type FileTicketResult = { ok: true; ticket: UploadTicket } | Fail;
export type FileResult = { ok: true; fileId: string } | Fail;
export type FileDeletionResult =
  | { ok: true; deletionState: 'completed' | 'pending' }
  | Fail;

type Owner = { orderId: string } | { documentId: string };
type OwnerKind = 'order' | 'document';
type IntentRow = Database['public']['Tables']['private_file_upload_intents']['Row'];

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function ownerDetails(owner: Owner): { kind: OwnerKind; id: string } {
  return 'orderId' in owner
    ? { kind: 'order', id: owner.orderId }
    : { kind: 'document', id: owner.documentId };
}

function toLocator(value: Json): StorageLocator | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const locator = value as Record<string, Json | undefined>;
  const publicId = locator.public_id;
  const resourceType = locator.resource_type;
  const deliveryType = locator.type;
  if (
    typeof publicId !== 'string' ||
    (resourceType !== 'image' && resourceType !== 'raw') ||
    deliveryType !== 'authenticated'
  ) return null;
  return {
    public_id: publicId,
    resource_type: resourceType,
    type: 'authenticated',
    ...(typeof locator.folder === 'string' ? { folder: locator.folder } : {}),
    ...(typeof locator.tag === 'string' ? { tag: locator.tag } : {}),
  };
}

function requireAdminRpc() {
  return createAdminClient();
}

async function loadOrderContext(orderId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from('service_orders')
    .select('id, status, buyer_profile_id, instructor_id, provider_id, standalone_service_id')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return fail('الطلب غير موجود أو تعذّر تحميله');
  return { ok: true as const, user, order };
}

async function loadDocumentContext(documentId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from('portfolio_documents')
    .select('id, student_id, status')
    .eq('id', documentId)
    .maybeSingle();
  if (error || !doc) return fail('المستند غير موجود أو تعذّر تحميله');
  return { ok: true as const, user, doc };
}

function uploadFileProblem(input: { fileName: string; bytes: number }, rules: FileRules): string | null {
  if (!Number.isInteger(input.bytes) || input.bytes <= 0) return 'الملف فاضي أو حجمه غير صالح';
  return fileProblem({ name: input.fileName, size: input.bytes }, rules);
}

async function createTicket(
  owner: Owner,
  file: { fileName: string; bytes: number },
  rules: FileRules,
  actorId: string,
): Promise<FileTicketResult> {
  const cleanedName = cleanFileName(file.fileName);
  const ext = extensionOf(cleanedName);
  const kind = kindOfExtension(ext);
  const problem = uploadFileProblem(file, rules);
  if (!kind || !problem && !extensionsFor([kind]).includes(ext)) return fail('نوع الملف غير مسموح');
  if (problem) return fail(problem);
  if (!isAdminApiConfigured()) return fail('رفع الملفات متوقف مؤقتًا — كلّمنا من صفحة الدعم');

  const { kind: ownerKind, id: ownerId } = ownerDetails(owner);
  const resourceType = resourceTypeFor(kind);
  const admin = await requireAdminRpc();
  const { data, error } = await admin.rpc('create_private_file_upload_intent', {
    p_actor_id: actorId,
    p_owner_kind: ownerKind,
    p_owner_id: ownerId,
    p_file_name: cleanedName,
    p_file_ext: ext,
    p_expected_bytes: file.bytes,
    p_max_bytes: rules.maxMb * 1024 * 1024,
    p_resource_type: resourceType,
    p_now: new Date().toISOString(),
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return fail(error?.message.includes('capacity')
      ? `وصلت لأقصى عدد ملفات على ${ownerKind === 'order' ? 'الطلب' : 'المستند'} (${ownerKind === 'order' ? FILES_PER_ORDER_MAX : FILES_PER_DOCUMENT_MAX})`
      : 'تعذّر حجز مساحة للملف — راجع صلاحية الطلب وحاول تاني');
  }
  const reservation = data as {
    intent_id?: string;
    upload_public_id?: string;
    folder?: string;
    tag?: string;
    expires_at?: string;
  };
  if (!reservation.intent_id || !reservation.upload_public_id || !reservation.folder || !reservation.tag || !reservation.expires_at) {
    return fail('تعذّر تجهيز تذكرة الرفع');
  }

  const provider = getAttachmentStorageProvider();
  const target = {
    intentId: reservation.intent_id,
    publicId: reservation.upload_public_id,
    folder: reservation.folder,
    tag: reservation.tag,
    resourceType,
    extensions: extensionsFor([kind]),
  };
  const fields = provider.createUploadTicket(target);
  const uploadUrl = provider.uploadUrl(resourceType);
  if (!fields || !uploadUrl) {
    await admin.rpc('cancel_private_file_upload_intent', {
      p_actor_id: actorId,
      p_intent_id: reservation.intent_id,
    });
    return fail('رفع الملفات متوقف مؤقتًا — كلّمنا من صفحة الدعم');
  }
  return {
    ok: true,
    ticket: {
      intentId: reservation.intent_id,
      expiresAt: reservation.expires_at,
      uploadUrl,
      fields,
    },
  };
}

export async function getOrderFileTicket(
  orderId: string,
  file: { fileName: string; bytes: number },
): Promise<FileTicketResult> {
  try {
    const ctx = await loadOrderContext(orderId);
    if (!ctx.ok) return ctx;
    if (!['paid', 'in_progress', 'delivered'].includes(ctx.order.status)) {
      return fail('رفع الملفات متاح بعد تأكيد الدفع وأثناء تنفيذ الطلب أو بعد تسليمه');
    }
    if (!ctx.order.standalone_service_id) return fail('الطلب ده مابيقبلش ملفات');
    const supabase = await createClient();
    const { data: service, error } = await supabase.from('standalone_services')
      .select('allows_files, file_kinds, file_max_mb')
      .eq('id', ctx.order.standalone_service_id).maybeSingle();
    if (error || !service?.allows_files) return fail('الخدمة دي مابتقبلش ملفات');
    return await createTicket({ orderId }, file, {
      kinds: normalizeKinds(service.file_kinds),
      maxMb: normalizeMaxMb(service.file_max_mb),
    }, ctx.user.id);
  } catch (err) {
    return fail(errorText(err, 'تعذّر تجهيز الرفع'));
  }
}

export async function getDocumentFileTicket(
  documentId: string,
  file: { fileName: string; bytes: number },
): Promise<FileTicketResult> {
  try {
    const ctx = await loadDocumentContext(documentId);
    if (!ctx.ok) return ctx;
    if (!['draft', 'submitted'].includes(ctx.doc.status)) return fail('المستند تمت مراجعته ولا يقبل ملفات جديدة');
    const rules: FileRules = { kinds: ['pdf', 'word', 'image'], maxMb: WORKSPACE_FILE_MAX_MB };
    return await createTicket({ documentId }, file, rules, ctx.user.id);
  } catch (err) {
    return fail(errorText(err, 'تعذّر تجهيز الرفع'));
  }
}

async function finalizeUpload(owner: Owner, intentId: string, isDelivery: boolean): Promise<
  | { ok: true; fileId: string; alreadyFinalized: boolean; fileName: string }
  | Fail
> {
  const user = await requireUser();
  const admin = await requireAdminRpc();
  const { kind, id } = ownerDetails(owner);
  const { data: rawIntent, error: intentError } = await admin
    .from('private_file_upload_intents')
    .select('*')
    .eq('id', intentId)
    .maybeSingle();
  if (intentError || !rawIntent) return fail('تذكرة الرفع غير موجودة');
  const intent = rawIntent as IntentRow;
  if (intent.owner_kind !== kind || intent.owner_id !== id || intent.uploader_profile_id !== user.id) {
    return fail('تذكرة الرفع لا تخص هذا الحساب أو الملف');
  }
  if (intent.lifecycle_state === 'finalized') {
    const { data: existing, error } = await admin
      .from('private_files')
      .select('id')
      .eq('upload_intent_id', intent.id)
      .maybeSingle();
    if (!error && existing) {
      return { ok: true, fileId: existing.id, alreadyFinalized: true, fileName: intent.file_name };
    }
  }
  const locator = toLocator(intent.provider_locator);
  if (!locator) return fail('بيانات تذكرة الرفع غير صالحة');

  let asset;
  try {
    asset = await getAttachmentStorageProvider().getAsset(locator);
  } catch (err) {
    console.error('Private attachment metadata lookup failed', err);
    return fail('تعذّر التحقق من الملف على مساحة التخزين — جرّب تاني');
  }
  if (!asset) return fail('الملف لسه موصلش لمساحة التخزين — جرّب ترفعه تاني');

  const { data, error } = await admin.rpc('finalize_private_file_upload', {
    p_actor_id: user.id,
    p_intent_id: intent.id,
    p_metadata: {
      public_id: asset.publicId,
      resource_type: asset.resourceType,
      type: asset.deliveryType,
      folder: asset.folder,
      format: asset.format,
      bytes: asset.bytes,
      tags: asset.tags,
    } as Json,
    p_is_delivery: isDelivery,
    p_now: new Date().toISOString(),
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    console.error('Private attachment finalize RPC failed', error);
    return fail('تعذّر تسجيل الملف — تقدر تعيد المحاولة بنفس التذكرة');
  }
  const result = data as { ok?: boolean; error?: string; file_id?: string; already_finalized?: boolean };
  if (!result.ok || !result.file_id) return fail(result.error ?? 'الملف لم يعد صالحًا لهذا الطلب');
  return {
    ok: true,
    fileId: result.file_id,
    alreadyFinalized: result.already_finalized === true,
    fileName: intent.file_name,
  };
}

function revalidateOrder(orderId: string) {
  try {
    revalidatePath(`/account/orders/creative-writing/${orderId}`);
    revalidatePath(`/dashboard/provider/orders/${orderId}`);
    revalidatePath(`/dashboard/instructor/services/orders/${orderId}`);
    revalidatePath(`/dashboard/admin/orders/services/${orderId}`);
  } catch (error) {
    console.error('Private attachment page revalidation failed', error);
  }
}

export async function registerOrderFile(orderId: string, intentId: string): Promise<FileResult> {
  try {
    const ctx = await loadOrderContext(orderId);
    if (!ctx.ok) return ctx;
    const saved = await finalizeUpload(
      { orderId },
      intentId,
      ctx.user.id !== ctx.order.buyer_profile_id,
    );
    if (!saved.ok) return saved;
    if (!saved.alreadyFinalized) {
      try {
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
          link: fromBuyer
            ? ctx.order.provider_id
              ? `/dashboard/provider/orders/${orderId}`
              : `/dashboard/instructor/services/orders/${orderId}`
            : `/account/orders/creative-writing/${orderId}`,
        });
      } catch (err) {
        console.error('Private attachment notification failed', err);
      }
    }
    revalidateOrder(orderId);
    return { ok: true, fileId: saved.fileId };
  } catch (err) {
    return fail(errorText(err, 'تعذّر حفظ الملف'));
  }
}

export async function registerDocumentFile(documentId: string, intentId: string): Promise<FileResult> {
  try {
    const ctx = await loadDocumentContext(documentId);
    if (!ctx.ok) return ctx;
    const saved = await finalizeUpload(
      { documentId },
      intentId,
      ctx.user.id !== ctx.doc.student_id,
    );
    if (!saved.ok) return saved;
    try {
      revalidatePath(`/dashboard/student/portfolio/${documentId}`);
      revalidatePath(`/account/writing/${documentId}`);
      revalidatePath(`/dashboard/instructor/students`, 'layout');
    } catch (error) {
      console.error('Private attachment page revalidation failed', error);
    }
    return { ok: true, fileId: saved.fileId };
  } catch (err) {
    return fail(errorText(err, 'تعذّر حفظ الملف'));
  }
}

/** Only readers granted by private_files RLS can obtain a short-lived URL. */
export async function getPrivateFileLink(fileId: string): Promise<{ ok: true; url: string } | Fail> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { data: file, error } = await supabase
      .from('private_files')
      .select('public_id, resource_type, format, lifecycle_state')
      .eq('id', fileId)
      .maybeSingle();
    if (error || !file) return fail('الملف غير موجود أو لا تملك صلاحية الوصول إليه');
    if (file.lifecycle_state !== 'active') return fail('الملف غير متاح للتحميل');
    const provider = getAttachmentStorageProvider();
    const url = provider.createDownloadUrl({
      public_id: file.public_id,
      resource_type: file.resource_type === 'image' ? 'image' : 'raw',
      type: 'authenticated',
    }, file.format);
    if (!url) return fail('تحميل الملفات متوقف مؤقتًا — كلّمنا من صفحة الدعم');
    return { ok: true, url };
  } catch (err) {
    return fail(errorText(err, 'تعذّر تجهيز التحميل'));
  }
}

/** Queue deletion durably, then attempt the provider call immediately. */
export async function deletePrivateFile(fileId: string): Promise<FileDeletionResult> {
  let committed = false;
  try {
    const user = await requireUser();
    const admin = await requireAdminRpc();
    const { data: result, error } = await admin.rpc('request_private_file_deletion', {
      p_actor_id: user.id,
      p_file_id: fileId,
      p_now: new Date().toISOString(),
    });
    if (error || !result || typeof result !== 'object' || Array.isArray(result)) {
      return fail('تعذّر تسجيل طلب الحذف — الملف لم يتغير');
    }
    const requested = result as { ok?: boolean; error?: string; state?: string; job_id?: string; claim_token?: string; locator?: Json };
    if (!requested.ok) return fail(requested.error ?? 'لا تملك صلاحية حذف الملف');
    committed = true;
    // Make the committed delete_pending state visible even if Cloudinary is
    // unavailable or another worker already owns the retry lease.
    await revalidatePrivateFile(fileId, admin);
    if (!requested.job_id || !requested.claim_token || !requested.locator) {
      return { ok: true, deletionState: 'pending' };
    }
    const locator = toLocator(requested.locator);
    if (!locator) return { ok: true, deletionState: 'pending' };

    let removed = false;
    let providerError: string | null = null;
    try {
      const provider = getAttachmentStorageProvider();
      await provider.deleteAsset(locator);
      removed = true;
    } catch (err) {
      providerError = errorText(err, 'Cloudinary deletion was not confirmed');
    }
    const { data: completed, error: completionError } = await admin.rpc('complete_private_file_cleanup_job', {
      p_job_id: requested.job_id,
      p_claim_token: requested.claim_token,
      p_success: removed,
      p_error: providerError ?? undefined,
      p_now: new Date().toISOString(),
    });
    if (completionError || completed !== true || !removed) {
      if (completionError) console.error('Private attachment deletion completion failed', completionError);
      return { ok: true, deletionState: 'pending' };
    }

    await revalidatePrivateFile(fileId, admin);
    return { ok: true, deletionState: 'completed' };
  } catch (err) {
    if (committed) {
      console.error('Private attachment deletion remains queued', err);
      return { ok: true, deletionState: 'pending' };
    }
    return fail(errorText(err, 'تعذّر تسجيل حذف الملف'));
  }
}

async function revalidatePrivateFile(fileId: string, admin: ReturnType<typeof createAdminClient>) {
  try {
    const { data: file } = await admin.from('private_files').select('order_id, document_id').eq('id', fileId).maybeSingle();
    if (file?.order_id) revalidateOrder(file.order_id);
    if (file?.document_id) {
      revalidatePath(`/dashboard/student/portfolio/${file.document_id}`);
      revalidatePath(`/account/writing/${file.document_id}`);
      revalidatePath('/dashboard/instructor/students', 'layout');
    }
  } catch (error) {
    console.error('Private attachment page revalidation failed', error);
  }
}
