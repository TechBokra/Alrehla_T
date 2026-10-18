/**
 * صور المعالج — بتفضل في المتصفح لحد ما الطلب يتسجّل.
 *
 * ── العطل ───────────────────────────────────────────────────
 *
 * بلاغ تامر (١٨ أكتوبر): «مش بيحفظ الصورة الشخصية ولازم أرجع من
 * الأول تاني».
 *
 * المعالج بيحفظ كل خطواته في `sessionStorage` — **إلا الصور**،
 * مستثناة صراحة بسطرين:
 *
 *     const { facePhotoFile, secondPhotoFile, ...rest } = values;
 *     sessionStorage.setItem(..., JSON.stringify(rest));
 *
 * والتعليق فوقهم بيقول السبب: «الملفات مش بتتحفظ في `sessionStorage`
 * (مفيش طريقة)». وده **صح لـ`sessionStorage`** — هو بيشيل نصوص بس،
 * و`JSON.stringify(File)` بيطلّع `{}`.
 *
 * بس `IndexedDB` بيشيل `File` و`Blob` زي ما هما. فالطريقة موجودة،
 * بس في مخزن تاني.
 *
 * ── وليه مش بنرفعها على Cloudinary بدري؟ ────────────────────
 *
 * ⚠️ ده كان الحل الأسهل: ارفع الصورة أول ما يختارها، واحفظ رقمها
 *    (نص عادي) في `sessionStorage`. **ومرفوض.**
 *
 *    صور الأطفال بتترفع في مجلّد خاص بنوع `authenticated`. ومهمة
 *    تنضيف الوسائط اليومية بتقرا `type: 'upload'` وبس — يعني
 *    **مابتشوفش** الصور الخاصة أصلًا. ومهمة حذف صور الأطفال بتشتغل
 *    على الصور المربوطة بـ`order_items`.
 *
 *    فالصورة اللي اترفعت ومااتطلبتش مابتبقاش في أي خطة حذف: مش في
 *    طلب، ومش في مجلّد المسح. صورة طفل حقيقية تقعد في Cloudinary
 *    للأبد — وإحنا كاتبين في سياسة الخصوصية إنها بتتحذف.
 *
 *    فالصورة بتفضل **في متصفح ولي الأمر وحده** لحد ما يطلب فعلًا.
 *    ساعتها بترتفع، وبتدخل في خطة الحذف مع طلبها.
 *
 * ⚠️ **ومدة الصلاحية مقصودة.** `sessionStorage` بيموت مع التبويب،
 *    و`IndexedDB` بيفضل للأبد. صورة طفل تقعد في المتصفح شهور من
 *    غير ما حد يعرف = حاجة ما حدش طلبها. فأي صورة أقدم من
 *    `PHOTO_TTL_HOURS` بتتشال أول ما المعالج يفتح.
 */

const DB_NAME = 'alrehla-wizard-photos';
const STORE = 'photos';
const DB_VERSION = 1;

/** الصورة بتعيش ٢٤ ساعة في المتصفح — كفاية إن الواحد يكمّل طلبه. */
export const PHOTO_TTL_HOURS = 24;

export type StoredPhoto = { file: File; savedAt: number };

/** هل الصف ده لسه صالح؟ دالة نقية — بتتختبر من غير متصفح. */
export function isFresh(savedAt: unknown, now: number, ttlHours = PHOTO_TTL_HOURS): boolean {
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return false;
  // ⚠️ الوقت من المستقبل = ساعة الجهاز اتغيّرت. بنعتبره قديمًا بدل
  //    ما نسيبه لأجل غير مسمّى.
  if (savedAt > now) return false;
  return now - savedAt <= ttlHours * 60 * 60 * 1000;
}

/** مفتاح الصف: المنتج + اسم الخانة. */
export function photoKey(productId: string, field: string): string {
  return `${productId}::${field}`;
}

/**
 * ⚠️ **كل نداء هنا بيفشل بهدوء عن قصد.**
 *
 *    `IndexedDB` مابيشتغلش في التصفّح الخاص في بعض المتصفحات،
 *    وبيترفض لو المستخدم قافل تخزين المواقع. وفشل حفظ الصورة
 *    **مش سبب يوقّف الطلب** — أسوأ حالة إن العميل يرفعها تاني،
 *    وده اللي بيحصل دلوقتي أصلًا.
 */
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    // المتصفح ممكن يقفل الطلب لو فيه تبويب تاني فاتح نسخة أقدم.
    req.onblocked = () => resolve(null);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore | null {
  try {
    return db.transaction(STORE, mode).objectStore(STORE);
  } catch {
    return null;
  }
}

export async function savePhoto(key: string, file: File, now = Date.now()): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const store = tx(db, 'readwrite');
  if (!store) return;
  await new Promise<void>((resolve) => {
    const req = store.put({ file, savedAt: now } satisfies StoredPhoto, key);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
  db.close();
}

export async function loadPhoto(key: string, now = Date.now()): Promise<File | null> {
  const db = await openDb();
  if (!db) return null;
  const store = tx(db, 'readonly');
  if (!store) {
    db.close();
    return null;
  }
  const row = await new Promise<StoredPhoto | null>((resolve) => {
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as StoredPhoto | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();

  if (!row || !(row.file instanceof File)) return null;
  if (!isFresh(row.savedAt, now)) {
    // القديمة بتتشال فورًا — مش بتتسابا في المخزن.
    void deletePhoto(key);
    return null;
  }
  return row.file;
}

export async function deletePhoto(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const store = tx(db, 'readwrite');
  if (!store) return;
  await new Promise<void>((resolve) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
  db.close();
}

/**
 * بيشيل صور المنتج ده كلها — بعد ما البند يدخل السلة.
 *
 * ⚠️ **لازم تتنادى عند النجاح.** البند بقى في السلة بصورته المرفوعة،
 *    والنسخة اللي في المتصفح بقت نسخة زيادة من صورة طفل مالهاش
 *    لازمة.
 */
export async function clearProductPhotos(productId: string, fields: string[]): Promise<void> {
  await Promise.all(fields.map((f) => deletePhoto(photoKey(productId, f))));
}
