'use client';

/** زرار الطباعة — «حفظ كـPDF» من نافذة الطباعة نفسها. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-[44px] rounded-xl bg-slate-900 px-6 py-3 font-bold text-white hover:bg-slate-800"
    >
      طباعة / حفظ PDF
    </button>
  );
}
