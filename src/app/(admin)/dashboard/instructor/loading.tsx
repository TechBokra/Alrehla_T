import React from 'react';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 animate-pulse">
      <div className="mb-8">
        <div className="h-8 w-64 rounded-xl bg-slate-200"></div>
      </div>
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-3xl bg-slate-200"></div>
        ))}
      </div>
      <div className="h-96 rounded-3xl bg-slate-200"></div>
    </div>
  );
}
