'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PortfolioDocument } from '@/types';
import {
  createPortfolioDocument,
  saveDocumentDraft,
  submitDocumentForReview,
} from '@/actions/portfolio';
import { Save, Send, MessageSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  initialDocument: PortfolioDocument | null;
  /**
   * الطالب مرتبط بمدرب دلوقتي؟
   *
   * معرض الأعمال **مساحة الطالب الخاصة**: يكتب فيها في أي وقت، حتى قبل
   * ما يشترك في أي باقة. لكن زرار «إرسال للمدرب» كان ظاهر دايمًا —
   * والطالب اللي لسه مالوش مدرب كان بيدوس عليه، النص يتحوّل لـ«مُرسل»،
   * **ومحدش يشوفه**. طريق مسدود بلا أي رسالة.
   */
  hasInstructor: boolean;
}

export function DocumentEditorClient({ initialDocument, hasInstructor }: Props) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState(initialDocument?.id ?? null);
  const [title, setTitle] = useState(initialDocument?.title || '');
  const [content, setContent] = useState(initialDocument?.content || '');
  const [status, setStatus] = useState(initialDocument?.status || 'draft');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * النص الجديد.
   *
   * قبل كده كان فيه سطر `if (!initialDocument) return;` جوّه دالة الحفظ:
   * يعني في النص الجديد الزرار كان بيخرج من غير ما يعمل أي حاجة — لا حفظ
   * ولا رسالة. الطالب يكتب صفحة كاملة ويدوس حفظ ومفيش حاجة بتحصل.
   *
   * والعنوان كمان مكانش بيتبعت للسيرفر أصلًا، فتعديله كان بيضيع.
   */
  const handleSave = async (newStatus: 'draft' | 'submitted') => {
    setIsSaving(true);
    setSaveMessage('');
    setErrorMessage('');

    const result = documentId
      ? newStatus === 'draft'
        ? await saveDocumentDraft(documentId, title, content)
        : await submitDocumentForReview(documentId, title, content)
      : await createPortfolioDocument({ title, content, status: newStatus });

    setIsSaving(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setStatus(newStatus);
    setSaveMessage(
      newStatus === 'draft' ? 'تم حفظ المسودة بنجاح' : 'تم الإرسال للمدرب للمراجعة'
    );
    setTimeout(() => setSaveMessage(''), 3000);

    // أول حفظ لنص جديد بيولّد رقمه — بننتقل لعنوانه عشان الحفظ اللي
    // بعده يعدّل نفس النص بدل ما يعمل نسخة جديدة.
    if (!documentId) {
      setDocumentId(result.id);
      router.replace(`/dashboard/student/portfolio/${result.id}`);
    }
  };

  const isReviewed = status === 'reviewed';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      
      {/* Main Editor */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <input 
            type="text" 
            placeholder="عنوان النص..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isReviewed}
            className="w-full text-2xl font-black text-slate-800 outline-none placeholder:text-slate-300 bg-transparent mb-6 pb-4 border-b border-slate-100 disabled:bg-transparent"
          />
          <textarea
            placeholder="ابدأ الكتابة هنا..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isReviewed}
            className="w-full min-h-[500px] resize-none text-lg text-slate-700 leading-relaxed outline-none placeholder:text-slate-300 bg-transparent disabled:bg-transparent"
          ></textarea>
        </div>
      </div>

      {/* Sidebar: Status & Feedback */}
      <div className="space-y-6">
        
        {/* Actions & Status */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-black text-slate-800 mb-4 text-lg">الحالة والإجراءات</h3>
          
          <div className="flex items-center gap-2 mb-6">
            {status === 'draft' && <span className="flex items-center gap-1 text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg"><Clock className="h-4 w-4"/> مسودة (غير مرسلة)</span>}
            {status === 'submitted' && <span className="flex items-center gap-1 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg"><Clock className="h-4 w-4"/> بانتظار مراجعة المدرب</span>}
            {status === 'reviewed' && <span className="flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg"><CheckCircle2 className="h-4 w-4"/> تمت المراجعة</span>}
          </div>

          {!isReviewed && (
            <div className="space-y-3">
              <button 
                onClick={() => handleSave('draft')}
                disabled={isSaving || !title.trim() || !content.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                <Save className="h-5 w-5" /> حفظ كمسودة
              </button>
              {hasInstructor ? (
                <button
                  onClick={() => handleSave('submitted')}
                  disabled={isSaving || !title.trim() || !content.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
                >
                  <Send className="h-5 w-5" /> إرسال للمدرب
                </button>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs font-bold leading-relaxed text-slate-500">
                  اكتب براحتك هنا — دي مساحتك أنت.
                  <br />
                  لما تشترك في باقة ويبقى معاك مدرب، هيظهرلك زرار «إرسال
                  للمدرب» عشان يقرا نصوصك ويكتبلك ملاحظاته.
                </p>
              )}
            </div>
          )}

          {saveMessage && (
            <div className="mt-4 text-sm font-bold text-emerald-600 flex items-center justify-center gap-1 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" /> {saveMessage}
            </div>
          )}

          {/* الخطأ كان بيطلع في `alert` برسالة عامة «حدث خطأ أثناء الحفظ»
              مش بيقول السبب. دلوقتي السبب الحقيقي بيبان في الشاشة. */}
          {errorMessage && (
            <div className="mt-4 flex items-center justify-center gap-1 text-sm font-bold text-red-600">
              <AlertCircle className="h-4 w-4" /> {errorMessage}
            </div>
          )}
        </div>

        {/* Instructor Feedback */}
        <div className={`rounded-3xl border ${isReviewed ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} p-6 shadow-sm`}>
          <div className="flex items-center gap-3 mb-4">
            <MessageSquare className={`h-6 w-6 ${isReviewed ? 'text-amber-600' : 'text-slate-400'}`} />
            <h3 className="font-black text-slate-800 text-lg">ملاحظات المدرب</h3>
          </div>
          
          {isReviewed ? (
            <div className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
              {initialDocument?.instructorFeedback}
            </div>
          ) : (
            <div className="text-slate-500 text-sm flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>لم يقم المدرب بإضافة ملاحظات بعد. ستظهر الملاحظات هنا بعد مراجعة النص.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
