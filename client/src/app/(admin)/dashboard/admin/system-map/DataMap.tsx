'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  MAP_COLUMNS,
  MAP_FLOWS,
  MAP_NODES,
  SEV_CHIP,
  SEV_FILL,
  SEV_LABELS,
  type Finding,
  type MapNode,
  type Severity,
} from '@/lib/data-map';

const W = 190;
const H = 48;
const VB_W = 1100;
const VB_H = 700;

const GROUP_STROKE: Record<MapNode['group'], string> = {
  people: '#4b4f9e',
  vercel: '#2b3340',
  supa: '#1f8a5b',
  ext: '#8a5a1f',
};

const nodeById = Object.fromEntries(MAP_NODES.map((n) => [n.id, n]));
const pos = (id: string) => {
  const n = nodeById[id];
  return { x: MAP_COLUMNS[n.col].x, y: n.y };
};

function pathFor(a: string, b: string): string {
  const p = pos(a);
  const q = pos(b);
  if (p.x === q.x) {
    const off = 40 + Math.abs(q.y - p.y) * 0.08;
    const x = p.x + W / 2 - 10;
    return `M${x},${p.y} C${x + off},${p.y} ${x + off},${q.y} ${x},${q.y}`;
  }
  const sx = p.x + (q.x > p.x ? W / 2 : -W / 2);
  const tx = q.x + (p.x > q.x ? W / 2 : -W / 2);
  const mx = (sx + tx) / 2;
  return `M${sx},${p.y} C${mx},${p.y} ${mx},${q.y} ${tx},${q.y}`;
}

/** نقطة في نص المنحنى (بيزييه تكعيبي عند t=0.5). */
function midOf(d: string): { x: number; y: number } {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const [x0, y0, x1, y1, x2, y2, x3, y3] = n;
  return { x: (x0 + 3 * x1 + 3 * x2 + x3) / 8, y: (y0 + 3 * y1 + 3 * y2 + y3) / 8 };
}

type Selection = { kind: 'intro' } | { kind: 'node'; id: string } | { kind: 'hot'; id: string };

/**
 * الخريطة التفاعلية. الدواير = نتيجة الفحص الحي بس (اللي اتصلح مابيظهرش).
 */
export function DataMap({ findings }: { findings: Finding[] }) {
  // رقم كل نقطة = ترتيبها في القايمة (نفس الرقم تحت الخريطة).
  const numbered = findings.map((f, i) => ({ ...f, n: i + 1 }));
  const [flowId, setFlowId] = useState<string | null>(null);
  const [sel, setSel] = useState<Selection>({ kind: 'intro' });

  const edges = useMemo(() => {
    const m = new Map<string, { a: string; b: string; flows: Set<string>; d: string }>();
    for (const f of MAP_FLOWS) {
      for (const [a, b] of f.steps) {
        const k = `${a}>${b}`;
        if (!m.has(k)) m.set(k, { a, b, flows: new Set(), d: pathFor(a, b) });
        m.get(k)!.flows.add(f.id);
      }
    }
    return m;
  }, []);

  const flow = MAP_FLOWS.find((f) => f.id === flowId) ?? null;
  const used = new Set(flow?.steps.flatMap(([a, b]) => [a, b]) ?? []);
  const highlighted = new Set(sel.kind === 'hot' ? (numbered.find((h) => h.id === sel.id)?.on ?? []) : sel.kind === 'node' ? [sel.id] : []);

  const pinsByNode = new Map<string, (Finding & { n: number })[]>();
  for (const h of numbered) {
    const id = h.on[0];
    pinsByNode.set(id, [...(pinsByNode.get(id) ?? []), h]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="المسارات">
        <FlowButton active={!flowId} onClick={() => setFlowId(null)}>
          الكل
        </FlowButton>
        {MAP_FLOWS.map((f) => (
          <FlowButton key={f.id} active={flowId === f.id} onClick={() => setFlowId(f.id)}>
            {f.name}
          </FlowButton>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="block h-auto w-full min-w-[760px]" role="img" aria-label="خريطة مسار البيانات">
            {MAP_COLUMNS.map((c) => (
              <g key={c.label}>
                <text x={c.x} y={26} textAnchor="middle" className="fill-slate-500 text-[15px] font-bold">
                  {c.label}
                </text>
                {c.sub && (
                  <text x={c.x} y={42} textAnchor="middle" className="fill-slate-400 text-[11px]">
                    {c.sub}
                  </text>
                )}
              </g>
            ))}

            {[...edges.values()].map((e) => {
              const on = !!flow && e.flows.has(flow.id);
              return (
                <path
                  key={`${e.a}>${e.b}`}
                  d={e.d}
                  fill="none"
                  stroke={on ? '#0f7a63' : '#b9c0bc'}
                  strokeWidth={on ? 2.6 : 1.4}
                  opacity={flow && !on ? 0.18 : 1}
                />
              );
            })}

            {flow?.steps.map(([a, b], i) => {
              const m = midOf(edges.get(`${a}>${b}`)!.d);
              return (
                <g key={i}>
                  <circle cx={m.x} cy={m.y} r={9} fill="#0f7a63" />
                  <text x={m.x} y={m.y + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>
                    {i + 1}
                  </text>
                </g>
              );
            })}

            {MAP_NODES.map((n) => {
              const p = pos(n.id);
              const dim = !!flow && !used.has(n.id);
              const isSel = highlighted.has(n.id);
              return (
                <g
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.title} — ${n.sub}`}
                  className="cursor-pointer focus:outline-none"
                  opacity={dim ? 0.28 : 1}
                  onClick={() => setSel({ kind: 'node', id: n.id })}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      setSel({ kind: 'node', id: n.id });
                    }
                  }}
                >
                  <rect
                    x={p.x - W / 2}
                    y={p.y - H / 2}
                    width={W}
                    height={H}
                    rx={10}
                    fill="#fff"
                    stroke={GROUP_STROKE[n.group]}
                    strokeWidth={isSel ? 3 : 1.5}
                  />
                  <text x={p.x} y={p.y - 3} textAnchor="middle" fill="#1d2422" fontSize={13} fontWeight={700}>
                    {n.title}
                  </text>
                  <text x={p.x} y={p.y + 14} textAnchor="middle" fill="#5d6764" fontSize={11}>
                    {n.sub}
                  </text>
                </g>
              );
            })}

            {[...pinsByNode.entries()].flatMap(([id, list]) =>
              list.map((h, i) => {
                const p = pos(id);
                const cx = p.x - W / 2 + 4 + i * 22;
                const cy = p.y - H / 2 - 2;
                return (
                  <g key={h.id} className="cursor-pointer" onClick={() => setSel({ kind: 'hot', id: h.id })}>
                    <circle cx={cx} cy={cy} r={10} fill={SEV_FILL[h.sev]} stroke="#fff" strokeWidth={2} />
                    <text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>
                      {h.n}
                    </text>
                  </g>
                );
              }),
            )}
          </svg>
        </div>

        <aside className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24" aria-live="polite">
          <Panel sel={sel} flowId={flowId} findings={numbered} onSel={setSel} onFlow={setFlowId} />
        </aside>
      </div>

      <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600">
        {(['high', 'mid', 'low'] as Severity[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-3 w-3 rounded-full" style={{ background: SEV_FILL[s] }} />
            {SEV_LABELS[s]}
          </span>
        ))}
        {(Object.keys(GROUP_STROKE) as MapNode['group'][]).map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <i className="inline-block h-3 w-3 rounded border-2" style={{ borderColor: GROUP_STROKE[g] }} />
            {g === 'people' ? 'الناس' : g === 'vercel' ? 'Vercel' : g === 'supa' ? 'Supabase' : 'خدمات برّه'}
          </span>
        ))}
      </div>
    </div>
  );
}

function FlowButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[40px] rounded-full border px-4 py-1.5 text-sm font-bold transition-colors ${
        active ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function Panel({
  sel,
  flowId,
  findings,
  onSel,
  onFlow,
}: {
  sel: Selection;
  flowId: string | null;
  findings: (Finding & { n: number })[];
  onSel: (s: Selection) => void;
  onFlow: (id: string) => void;
}) {
  if (sel.kind === 'hot') {
    const h = findings.find((x) => x.id === sel.id);
    if (h) {
      return (
        <>
          <p className="text-xs font-black text-slate-500">نقطة {h.n}</p>
          <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-black ${SEV_CHIP[h.sev]}`}>{SEV_LABELS[h.sev]}</span>
          <h2 className="text-lg font-black text-slate-900">{h.title}</h2>
          <p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-800">{h.evidence}</p>
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium leading-relaxed text-emerald-950">
            <span className="block text-xs font-black text-emerald-800">الإصلاح المقترح</span>
            {h.fix}
          </p>
          {h.href && (
            <Link href={h.href} className="inline-block text-sm font-black text-emerald-800 hover:underline">
              {h.hrefLabel ?? 'افتح'} ←
            </Link>
          )}
        </>
      );
    }
  }
  if (sel.kind === 'node') {
    const n = nodeById[sel.id];
    const flows = MAP_FLOWS.filter((f) => f.steps.some(([a, b]) => a === n.id || b === n.id));
    const hots = findings.filter((h) => h.on.includes(n.id));
    return (
      <>
        <p className="text-xs font-black text-slate-500">{MAP_COLUMNS[n.col].label}</p>
        <h2 className="text-lg font-black text-slate-900">{n.title}</h2>
        <p className="text-sm text-slate-600">{n.sub}</p>
        {hots.map((h) => (
          <button key={h.id} type="button" onClick={() => onSel({ kind: 'hot', id: h.id })} className="block text-start text-sm font-bold text-emerald-800 hover:underline">
            {h.n}. {h.title}
          </button>
        ))}
        <p className="text-sm text-slate-600">بيعدّي عليه:</p>
        <div className="flex flex-wrap gap-1.5">
          {flows.map((f) => (
            <button key={f.id} type="button" onClick={() => onFlow(f.id)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200">
              {f.name}
            </button>
          ))}
        </div>
      </>
    );
  }
  const flow = MAP_FLOWS.find((f) => f.id === flowId);
  if (flow) {
    return (
      <>
        <p className="text-xs font-black text-slate-500">مسار</p>
        <h2 className="text-lg font-black text-slate-900">{flow.name}</h2>
        <ol className="list-decimal space-y-1.5 ps-5 text-sm">
          {flow.steps.map(([a, b, l], i) => (
            <li key={i}>
              <b>{nodeById[a].title}</b> ← <b>{nodeById[b].title}</b>
              {l && <span className="block text-xs text-slate-500">{l}</span>}
            </li>
          ))}
        </ol>
      </>
    );
  }
  return (
    <>
      <p className="text-xs font-black text-slate-500">نتيجة الفحص</p>
      <h2 className="text-lg font-black text-slate-900">
        {findings.length === 0 ? 'مفيش تكدّس دلوقتي' : `${findings.length} نقطة محتاجة انتباه`}
      </h2>
      <p className="text-sm leading-relaxed text-slate-700">
        {findings.length === 0
          ? 'الفحص ماطلّعش أي مشكلة. شغّله تاني بعد فترة، أو لما تحس إن حاجة بطيئة.'
          : 'دوس على أي نقطة تشوف الدليل والإصلاح. اختار مسار من فوق تشوف خطواته.'}
      </p>
      {findings.map((h) => (
        <button key={h.id} type="button" onClick={() => onSel({ kind: 'hot', id: h.id })} className={`block w-full rounded-xl px-3 py-2 text-start text-sm font-bold ${SEV_CHIP[h.sev]}`}>
          {h.n}. {h.title}
        </button>
      ))}
    </>
  );
}
