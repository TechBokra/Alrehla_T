'use client';

/** آخر خط دفاع — لو الهيكل نفسه وقع (نادر). من غير تنسيقات الموقع عن قصد. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1.5rem' }}>
        <h1>حصل عطل مؤقت</h1>
        <p>مقدرناش نحمّل الموقع دلوقتي — جرّب تاني بعد لحظات.</p>
        <button type="button" onClick={reset} style={{ padding: '0.75rem 1.5rem', fontWeight: 700 }}>
          جرّب تاني
        </button>
      </body>
    </html>
  );
}
