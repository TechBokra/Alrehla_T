type RecordWithId = { id?: string | number; [key: string]: unknown };

interface BooleanUpdateRequest<TRecord extends RecordWithId> {
  id: string;
  field: string;
  value: boolean;
  record: TRecord;
  allowedFields: readonly string[];
  canEditRecord: (record: TRecord) => boolean;
}

interface BooleanUpdateServices<TRecord extends RecordWithId> {
  authorize: (record: TRecord) => Promise<void>;
  read: () => Promise<TRecord>;
  update: (values: Record<string, boolean>) => Promise<TRecord>;
  invalidate: () => Promise<void>;
}

/** A single-field CRUD update, with a fresh read and no automatic retry. */
export async function updateResourceBooleanField<TRecord extends RecordWithId>(
  request: BooleanUpdateRequest<TRecord>,
  services: BooleanUpdateServices<TRecord>,
  guard: { pending: boolean },
): Promise<{ changed: boolean; refreshFailed: boolean } | false> {
  if (guard.pending) return false;
  guard.pending = true;
  try {
    const { id, field, value, record, allowedFields, canEditRecord } = request;
    if (!allowedFields.includes(field) || ["id", "__proto__", "constructor", "prototype"].includes(field) ||
      !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field) || typeof value !== "boolean")
      throw new Error("هذا الحقل غير متاح للتعديل المباشر.");
    const check = (row: TRecord) => {
      if (!row || typeof row !== "object" || String(row.id) !== id || typeof row[field] !== "boolean" || !canEditRecord(row))
        throw new Error("هذا السجل غير متاح للتعديل.");
    };
    check(record);
    if (record[field] === value) return { changed: false, refreshFailed: false };
    await services.authorize(record);
    const fresh = await services.read();
    check(fresh);
    await services.authorize(fresh);
    if (fresh[field] !== record[field]) {
      await services.invalidate().catch(() => {});
      throw new Error("تغيّرت قيمة الحقل. راجع الحالة الحالية ثم حاول مرة أخرى.");
    }
    try {
      const saved = await services.update({ [field]: value });
      if (!saved || String(saved.id) !== id || saved[field] !== value)
        throw new Error("تعذّر تأكيد حفظ الحالة. حدّث الجدول وراجعها.");
    } catch (error) {
      await services.invalidate().catch(() => {});
      throw error;
    }
    let refreshFailed = false;
    try { await services.invalidate(); } catch { refreshFailed = true; }
    return { changed: true, refreshFailed };
  } finally {
    guard.pending = false;
  }
}
