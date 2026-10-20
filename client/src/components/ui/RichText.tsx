import React from 'react';

/**
 * عارض النصوص الطويلة القابلة للتعديل من لوحة الإدارة.
 *
 * ليه مش HTML؟
 * لو سمحنا بـ HTML خام في خانة نص، أي حد عنده صلاحية تعديل المحتوى يقدر
 * يحقن سكربت في الصفحة — ده ثغرة أمنية معروفة (XSS). بدل كده بنستخدم
 * تنسيق مبسّط بيتحوّل لعناصر React جاهزة، فمفيش أي HTML بيتنفّذ:
 *
 *   # عنوان           → عنوان
 *   ## عنوان فرعي     → عنوان فرعي
 *   - نقطة            → عنصر في قائمة
 *   **نص**            → نص عريض
 *   سطر فاضي          → فقرة جديدة
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // **عريض** فقط — أي نجوم غير متطابقة بتفضل نص عادي.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b${i}`} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-t${i}`}>{part}</React.Fragment>;
  });
}

export function RichText({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  const lines = (value ?? '').split('\n');
  const blocks: React.ReactNode[] = [];

  let listBuffer: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    listBuffer = [];
    blocks.push(
      <ul
        key={`ul-${blocks.length}`}
        className="mr-4 list-inside list-disc space-y-2"
      >
        {items.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(' ');
    paragraphBuffer = [];
    blocks.push(
      <p key={`p-${blocks.length}`}>{renderInline(text, `p-${blocks.length}`)}</p>,
    );
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2
          key={`h-${blocks.length}`}
          className="mt-10 mb-5 text-2xl font-black text-slate-900"
        >
          {line.slice(2).trim()}
        </h2>,
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3
          key={`h-${blocks.length}`}
          className="mt-8 mb-4 text-xl font-bold text-slate-900"
        >
          {line.slice(3).trim()}
        </h3>,
      );
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      listBuffer.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return <div className={className}>{blocks}</div>;
}
