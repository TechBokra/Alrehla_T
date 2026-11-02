type OrderedRecord = { id: string | number; [key: string]: unknown };

/** Fresh operation snapshot, including providers with a server-side page cap. */
export async function readResourceOrder<TRecord>(
  readPage: (currentPage: number, pageSize: number) => Promise<{ data: TRecord[]; total: number }>,
) {
  const rows: TRecord[] = [];
  let total: number | undefined;
  let pageSize = 500;
  for (let currentPage = 1; total === undefined || rows.length < total; currentPage++) {
    const page = await readPage(currentPage, pageSize);
    if (!Number.isSafeInteger(page.total) || page.total < 0 || (total !== undefined && total !== page.total))
      throw new Error("تغيّرت قائمة الصفوف. حدّث الجدول ثم حاول مرة أخرى.");
    total = page.total;
    if (!page.data.length && rows.length < total)
      throw new Error("تعذّر قراءة الترتيب الكامل. حدّث الجدول وحاول مرة أخرى.");
    rows.push(...page.data);
    if (currentPage === 1 && page.data.length > 0 && page.data.length < pageSize && total > rows.length)
      pageSize = page.data.length;
  }
  if (rows.length !== total) throw new Error("تغيّرت قائمة الصفوف. حدّث الجدول ثم حاول مرة أخرى.");
  return rows;
}

/** Only drop events schedule work; a new drop replaces the pending callback. */
export function createDropDebouncer(delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  return {
    cancel,
    schedule(run: () => void) {
      cancel();
      timer = setTimeout(() => { timer = undefined; run(); }, delay);
    },
  };
}

/** Reassign selected rows to their existing slots in the complete scoped order. */
export function planResourceReorder<TRecord extends OrderedRecord>(
  rows: TRecord[],
  source: TRecord[],
  orderedIds: string[],
  field: string,
) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field) || ["id", "__proto__", "constructor", "prototype"].includes(field))
    throw new Error("حقل الترتيب غير صالح.");
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const sourceIds = new Set(source.map((row) => String(row.id)));
  if (byId.size !== rows.length || sourceIds.size !== source.length ||
    orderedIds.length !== source.length || new Set(orderedIds).size !== source.length ||
    orderedIds.some((id) => !sourceIds.has(id))) throw new Error("قائمة الصفوف غير صالحة للترتيب.");
  for (const row of source) {
    const fresh = byId.get(String(row.id));
    if (!fresh || fresh[field] !== row[field]) throw new Error("تغيّر ترتيب البيانات. حدّث الجدول ثم حاول مرة أخرى.");
  }
  if (orderedIds.every((id, index) => id === String(source[index].id))) return [];
  const positions = rows.map((row) => row[field]);
  if (positions.some((value) => value != null && (typeof value !== "number" || !Number.isSafeInteger(value))))
    throw new Error("حقل الترتيب يجب أن يحتوي على أرقام صحيحة.");
  const uniqueSlots = positions.every((value, index) => typeof value === "number" &&
    (index === 0 || (positions[index - 1] as number) < value));
  let selectedIndex = 0;
  const ordered = rows.map((row) => sourceIds.has(String(row.id)) ? byId.get(orderedIds[selectedIndex++])! : row);
  return ordered.flatMap((row, index) => {
    const position = uniqueSlots ? positions[index] as number : index;
    return row[field] === position ? [] : [{ record: row, position }];
  });
}

interface ReorderServices<TRecord extends OrderedRecord> {
  authorize: (record?: TRecord) => Promise<void>;
  read: () => Promise<TRecord[]>;
  update: (record: TRecord, position: number) => Promise<void>;
  invalidate: () => Promise<void>;
}

/** Per-row useUpdate writes are not transactional; never retry a partial batch. */
export async function persistResourceReorder<TRecord extends OrderedRecord>(
  source: TRecord[], ids: string[], field: string, services: ReorderServices<TRecord>,
) {
  await services.authorize();
  const changes = planResourceReorder(await services.read(), source, ids, field);
  let attempted = false;
  let updated = 0;
  try {
    for (const { record, position } of changes) {
      await services.authorize(record);
      attempted = true;
      await services.update(record, position);
      updated++;
    }
  } catch (error) {
    if (attempted) await services.invalidate().catch(() => {});
    throw new Error(updated > 0
      ? "تم حفظ جزء من الترتيب فقط. حدّث الجدول وراجع البيانات قبل المحاولة مجددًا."
      : error instanceof Error ? error.message : "تعذّر حفظ الترتيب. حاول مرة أخرى.");
  }
  let refreshFailed = false;
  if (attempted) {
    try { await services.invalidate(); } catch { refreshFailed = true; }
  }
  return { updated, refreshFailed };
}
