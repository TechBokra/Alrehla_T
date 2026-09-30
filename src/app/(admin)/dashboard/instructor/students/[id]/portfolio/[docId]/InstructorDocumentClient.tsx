'use client';
import React, { useState } from 'react';
import { PortfolioDocument } from '@/types';
import { submitInstructorFeedback } from '@/actions/portfolio';
import { Send, MessageSquare, User, Clock, CheckCircle2 } from 'lucide-react';

interface Props {
  document: PortfolioDocument;
  studentName: string;
}

export function InstructorDocumentClient({ document, studentName }: Props) {
  const [feedback, setFeedback] = useState(document.instructorFeedback || '');
  const [status, setStatus] = useState(document.status);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    try {
      await submitInstructorFeedback(document.id, feedback);
      setStatus('reviewed');
      setSaveMessage('تم حفظ الملاحظات بنجاح وإرسالها للمتدرب.');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
      
      {/* Read-Only Document */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h2 className="text-2xl font-black text-slate-800">{document.title}</h2>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
              <User className="h-4 w-4" /> {studentName}
            </div>
          </div>
          <div className="w-full min-h-[500px] text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
            {document.content}
          </div>
        </div>
      </div>

      {/* Sidebar: Feedback */}
      <div className="space-y-6">
        <form onSubmit={handleSave} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col h-full">
          <h3 className="font-black text-slate-800 mb-4 text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-600" /> إضافة ملاحظات وتوجيهات
          </h3>
          
          <div className="flex items-center gap-2 mb-6">
            {status === 'draft' && <span className="flex items-center gap-1 text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg"><Clock className="h-4 w-4"/> مسودة للطالب</span>}
            {status === 'submitted' && <span className="flex items-center gap-1 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-lg"><Clock className="h-4 w-4"/> بانتظار مراجعتك</span>}
            {status === 'reviewed' && <span className="flex items-center gap-1 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg"><CheckCircle2 className="h-4 w-4"/> تمت المراجعة</span>}
          </div>

          <div className="flex-1 min-h-[300px] flex flex-col mb-4">
            <label className="text-sm font-bold text-slate-700 mb-2">أضف تعليقاتك على النص، نقاط القوة، ومواضع التحسين:</label>
            <textarea
              required
              placeholder="اكتب ملاحظاتك للمتدرب هنا..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 outline-none focus:border-emerald-500 transition-colors"
            ></textarea>
          </div>

          <button 
            type="submit"
            disabled={isSaving || !feedback.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50"
          >
            <Send className="h-5 w-5" /> حفظ وإرسال التقييم
          </button>

          {saveMessage && (
            <div className="mt-4 text-sm font-bold text-emerald-600 flex items-center justify-center gap-1 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4" /> {saveMessage}
            </div>
          )}
        </form>
      </div>

    </div>
  );
}
