/**
 * سعر النسخة الإلكترونية — **لمنتجات «أنت البطل هنا» وحدها** (قرار تامر:
 * «دي فقط في إنها لك مش في المكتبة»).
 *
 * ⚠️ الخانة بتختفي لغير «مخصص» — ولما تختفي **مابتتبعتش**، فالخادم
 *    مابيلمسش العمود (`onlySentFields`). والقاعدة نفسها بترفض الطلب
 *    الإلكتروني لأي تصنيف غير «مخصص» (ملف 138)، فالإخفاء هنا راحة
 *    مش حماية.
 * ⚠️ فاضية = **مفيش نسخة إلكترونية** للمنتج ده، والعميل مابيشوفش
 *    الاختيار أصلًا.
 */
export function ElectronicPriceField({
  category,
  defaultValue,
}: {
  category: string;
  defaultValue?: number;
}) {
  if (category !== 'custom') return null;
  return (
    <div>
      <label htmlFor="electronicPrice" className="mb-2 block text-sm font-bold text-slate-700">
        سعر النسخة الإلكترونية (اختياري)
      </label>
      <div className="relative">
        <input
          id="electronicPrice"
          type="number"
          name="electronicPrice"
          min="1"
          defaultValue={defaultValue || ''}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-12 text-slate-800 focus:border-amber-500 focus:outline-none"
        />
        <span className="absolute left-4 top-3 font-bold text-slate-500">ج.م</span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        فاضية = النسخة الإلكترونية مش متاحة. بتتبعت للعميل بالإيميل، ومن غير شحن.
      </p>
    </div>
  );
}
