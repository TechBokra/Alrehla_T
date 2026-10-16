/**
 * توزيع الطلبات على المسؤولين (ملف 14) — الثوابت المشتركة.
 */
export type WorkLine = 'enha_lak' | 'box' | 'courses' | 'services' | 'studio';
export type WorkStage = 'payment' | 'fulfilment';

// الترتيب مقصود: مسارات «إنها لك» (الطلب · الاستوديو · الصندوق) جنب بعض.
export const WORK_LINES: WorkLine[] = ['enha_lak', 'studio', 'box', 'courses', 'services'];
export const WORK_STAGES: WorkStage[] = ['payment', 'fulfilment'];

/** اسم المسار كامل (للمهام والفلاتر): «إنها لك» واحدة بمساراتها. */
export const WORK_LINE_LABELS: Record<WorkLine, string> = {
  enha_lak: 'إنها لك — الطلب (مكتبة وقصص)',
  studio: 'إنها لك — إنتاج القصة المخصّصة',
  box: 'إنها لك — صندوق الرحلة',
  courses: 'حجوزات «بداية الرحلة»',
  services: 'الخدمات الإبداعية',
};

/** اسم المسار داخل منظومته (بدون اسم المنظومة). */
export const WORK_TRACK_LABELS: Record<WorkLine, string> = {
  enha_lak: 'الطلب (مكتبة وقصص)',
  studio: 'إنتاج القصة المخصّصة (الاستوديو)',
  box: 'صندوق الرحلة',
  courses: 'الحجوزات',
  services: 'الخدمات',
};

/**
 * المنظومات: «إنها لك» منظومة واحدة مساراتها الطلب العادي وإنتاج القصة المخصّصة (الاستوديو)
 * وصندوق الرحلة. المفاتيح (`line`) هي مفاتيح التخزين في القاعدة، والشاشات بتعرض المنظومة كوحدة
 * واحدة وتخصّص كل مسار جواها (مراحله ومسؤولوه ومهله).
 */
export type WorkGroup = 'enha_lak' | 'courses' | 'services';

export const WORK_GROUPS: { id: WorkGroup; label: string; lines: WorkLine[] }[] = [
  { id: 'enha_lak', label: 'إنها لك', lines: ['enha_lak', 'studio', 'box'] },
  { id: 'courses', label: 'حجوزات «بداية الرحلة»', lines: ['courses'] },
  { id: 'services', label: 'الخدمات الإبداعية', lines: ['services'] },
];

export function groupOfLine(line: WorkLine): WorkGroup {
  return WORK_GROUPS.find((g) => g.lines.includes(line))?.id ?? 'enha_lak';
}

export function isWorkGroup(v: unknown): v is WorkGroup {
  return typeof v === 'string' && WORK_GROUPS.some((g) => g.id === v);
}

export const WORK_STAGE_LABELS: Record<WorkStage, string> = {
  payment: 'مراجعة الدفع',
  fulfilment: 'التنفيذ',
};

export const WORK_STAGE_HINTS: Record<WorkStage, string> = {
  payment: 'أول ما العميل يرفع الإيصال — يتأكد من التحويل ويأكد الدفع.',
  fulfilment: 'بعد تأكيد الدفع — التجهيز والشحن، أو تعيين المدرب والجدولة، أو متابعة مقدّم الخدمة.',
};

export function isWorkLine(v: unknown): v is WorkLine {
  return typeof v === 'string' && (WORK_LINES as string[]).includes(v);
}
export function isWorkStage(v: unknown): v is WorkStage {
  return typeof v === 'string' && (WORK_STAGES as string[]).includes(v);
}

/**
 * المراحل اللي بتتعمل فعلًا لكل نوع. استوديو القصص مهمته **مهمة واحدة لكل
 * مشروع** (مرحلة التنفيذ) وصاحبها بيتغيّر مع مرحلة المشروع — مفيش «مراجعة دفع»
 * لأنها مهمة الطلب نفسه (خط «إنها لك»).
 */
export const WORK_LINE_STAGES: Record<WorkLine, WorkStage[]> = {
  enha_lak: ['payment', 'fulfilment'],
  box: ['payment', 'fulfilment'],
  courses: ['payment', 'fulfilment'],
  services: ['payment', 'fulfilment'],
  studio: ['fulfilment'],
};

export function isStageOfLine(line: WorkLine, stage: WorkStage): boolean {
  return WORK_LINE_STAGES[line].includes(stage);
}

/** سطر الشرح تحت المرحلة — الاستوديو ليه شرح خاص. */
export function workStageHint(line: WorkLine, stage: WorkStage): string {
  if (line === 'studio' && stage === 'fulfilment') {
    return 'مسؤولو الإنتاج: بيستلموا المشروع في الفحص والتسليم والإيقاف، وأي مرحلة مالهاش محرر/مشرف فني معيّن، وتحذير إلغاء الطلب. في مراحل النص والرسم المهمة بتروح تلقائيًا للمحرر/المشرف الفني المعيّن على المشروع. لو فاضية: حاملو دور «مسؤول إنتاج القصص».';
  }
  return WORK_STAGE_HINTS[stage];
}

// ── المواعيد والأولوية والمراحل الدقيقة (migration 20261016030000) ─────────────

export type WorkPriority = 'low' | 'normal' | 'high' | 'urgent';
export const WORK_PRIORITIES: WorkPriority[] = ['low', 'normal', 'high', 'urgent'];

export const WORK_PRIORITY_LABELS: Record<WorkPriority, string> = {
  low: 'منخفضة',
  normal: 'عادية',
  high: 'عالية',
  urgent: 'عاجلة',
};

export function isWorkPriority(v: unknown): v is WorkPriority {
  return typeof v === 'string' && (WORK_PRIORITIES as string[]).includes(v);
}

/** الأعلى أولًا — للترتيب. */
export function priorityRank(p: WorkPriority): number {
  return { urgent: 0, high: 1, normal: 2, low: 3 }[p];
}

const HOUR = 3_600_000;

/**
 * «قرب الموعد» = آخر ٢٥٪ من المهلة (بحد أدنى ساعتين) — **نفس قاعدة فحص الإشعارات
 * في القاعدة** (`work_tasks_deadline_sweep`). لو اتغيّرت هناك لازم تتغيّر هنا.
 */
export function soonLeadMs(stepChangedAt: string | null, dueAt: string): number {
  const window = stepChangedAt ? new Date(dueAt).getTime() - new Date(stepChangedAt).getTime() : 0;
  return Math.max(window * 0.25, 2 * HOUR);
}

export type DeadlineKind =
  | 'none' // من غير موعد
  | 'ok' // في الميعاد
  | 'soon' // قرب
  | 'overdue' // فات
  | 'done_on_time'
  | 'done_late'
  | 'done_no_due';

export type DeadlineState = {
  kind: DeadlineKind;
  /** المتبقي (soon/ok) أو التأخير (overdue) أو الفرق عند القفل — بالملّي ثانية، موجب دايمًا. */
  ms: number | null;
};

export function deadlineState(
  task: { status: 'open' | 'done'; dueAt: string | null; stepChangedAt?: string | null; doneAt?: string | null },
  now: number,
): DeadlineState {
  if (task.status === 'done') {
    if (!task.dueAt) return { kind: 'done_no_due', ms: null };
    const due = new Date(task.dueAt).getTime();
    const done = task.doneAt ? new Date(task.doneAt).getTime() : now;
    return done <= due
      ? { kind: 'done_on_time', ms: due - done }
      : { kind: 'done_late', ms: done - due };
  }
  if (!task.dueAt) return { kind: 'none', ms: null };
  const due = new Date(task.dueAt).getTime();
  if (now >= due) return { kind: 'overdue', ms: now - due };
  const remaining = due - now;
  return remaining <= soonLeadMs(task.stepChangedAt ?? null, task.dueAt)
    ? { kind: 'soon', ms: remaining }
    : { kind: 'ok', ms: remaining };
}

/** الأكثر استعجالًا أولًا: متأخر ← قرب ← في الميعاد ← من غير موعد. */
export function deadlineRank(kind: DeadlineKind): number {
  return { overdue: 0, soon: 1, ok: 2, none: 3, done_on_time: 4, done_late: 4, done_no_due: 4 }[kind];
}

function plural(n: number, one: string, two: string, few: string, many: string): string {
  const fmt = n.toLocaleString('ar-EG');
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${fmt} ${few}`;
  return `${fmt} ${many}`;
}

/** مدة بالعربي المصري: «٣٥ دقيقة» / «٥ ساعات» / «يومين». */
export function formatSpan(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return plural(Math.max(minutes, 1), 'دقيقة', 'دقيقتين', 'دقايق', 'دقيقة');
  const hours = Math.round(minutes / 60);
  if (hours < 48) return plural(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
  const days = Math.round(hours / 24);
  return plural(days, 'يوم', 'يومين', 'أيام', 'يوم');
}

// ── كتالوج المراحل ────────────────────────────────────────────────────────────

export type TaskStepOwner = 'rule' | 'editor' | 'art_lead' | 'manager';

export const TASK_STEP_OWNER_LABELS: Record<TaskStepOwner, string> = {
  rule: 'حسب «توزيع الطلبات»',
  editor: 'المحرر المعيّن على المشروع',
  art_lead: 'المشرف الفني المعيّن على المشروع',
  manager: 'مسؤولو الإنتاج',
};

export function isTaskStepOwner(v: unknown): v is TaskStepOwner {
  return typeof v === 'string' && ['rule', 'editor', 'art_lead', 'manager'].includes(v);
}

export type TaskStep = {
  line: WorkLine;
  step: string;
  label: string;
  hint: string | null;
  slaHours: number | null;
  ownerKind: TaskStepOwner;
  sortOrder: number;
  showTab: boolean;
};

/** اسم المرحلة الدقيقة من الكتالوج، وإلا اسم المرحلة العامة. */
export function stepLabel(catalog: TaskStep[], line: WorkLine, step: string, stage: WorkStage): string {
  const hit = catalog.find((s) => s.line === line && s.step === step);
  return hit ? hit.label : step === stage || !step ? WORK_STAGE_LABELS[stage] : step;
}

/**
 * مسار النوع: المراحل بترتيبها للعرض. مراحل «التنفيذ» الدقيقة بتحلّ محل «التنفيذ» العامة
 * لو موجودة (وإلا بتفضل العامة).
 */
export function pathSteps(catalog: TaskStep[], line: WorkLine): TaskStep[] {
  const mine = catalog.filter((s) => s.line === line).sort((a, b) => a.sortOrder - b.sortOrder);
  // صندوق الرحلة: مراجعة الدفع، ثم شحنة لكل شهر (مهمة لكل شحنة). «التنفيذ» العام مجرد افتراضي للمسؤولين،
  // ومراحل حالة الطلب الدقيقة (paid/preparing/shipped) مابقتش بتتفتح على الصندوق.
  if (line === 'box') {
    return mine.filter((s) => s.step === 'payment' || s.step === 'shipment');
  }
  const hasSpecific = mine.some((s) => s.step !== 'payment' && s.step !== 'fulfilment');
  return hasSpecific ? mine.filter((s) => s.step !== 'fulfilment') : mine;
}

// ── سجل التطورات ──────────────────────────────────────────────────────────────

export type WorkTaskEventKind =
  | 'created'
  | 'assigned'
  | 'step'
  | 'due'
  | 'priority'
  | 'done'
  | 'reopened'
  | 'reminder_soon'
  | 'reminder_overdue'
  | 'note';

export type WorkTaskEvent = {
  id: number;
  taskId: string;
  kind: WorkTaskEventKind;
  actorId: string | null;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
};

const EVENT_KINDS: WorkTaskEventKind[] = [
  'created', 'assigned', 'step', 'due', 'priority', 'done', 'reopened', 'reminder_soon', 'reminder_overdue', 'note',
];

export function isWorkTaskEventKind(v: unknown): v is WorkTaskEventKind {
  return typeof v === 'string' && (EVENT_KINDS as string[]).includes(v);
}

export type EventContext = {
  /** اسم إداري أو undefined (عميل/نظام). */
  personName: (id: string) => string | undefined;
  /** اسم المرحلة الدقيقة للمهمة. */
  stepName: (step: string) => string;
  /** تنسيق وقت (بتوقيت القاهرة). */
  formatTime: (iso: string) => string;
};

/** «مين عمل إيه» — جملة واحدة للسجل (النظام لو مفيش فاعل إداري معروف). */
export function describeEvent(e: WorkTaskEvent, ctx: EventContext): { who: string; text: string } {
  const who = (e.actorId && ctx.personName(e.actorId)) || 'النظام';
  const names = (csv: string | null) =>
    (csv ?? '')
      .split(',')
      .filter(Boolean)
      .map((id) => ctx.personName(id) ?? 'إداري')
      .join('، ');

  switch (e.kind) {
    case 'created':
      return { who, text: `اتفتحت في مرحلة «${ctx.stepName(e.toValue ?? '')}»` };
    case 'assigned': {
      const to = names(e.toValue);
      return { who, text: to ? `اتسندت لـ ${to}` : 'اتشال المسؤول — بقت لكل الإدارة' };
    }
    case 'step':
      return { who, text: `انتقلت من «${ctx.stepName(e.fromValue ?? '')}» إلى «${ctx.stepName(e.toValue ?? '')}»` };
    case 'due':
      return {
        who,
        text: e.toValue ? `الموعد اتغيّر إلى ${ctx.formatTime(e.toValue)}` : 'الموعد اتشال',
      };
    case 'priority':
      return {
        who,
        text: `الأولوية بقت ${isWorkPriority(e.toValue) ? WORK_PRIORITY_LABELS[e.toValue] : e.toValue ?? ''}`,
      };
    case 'done':
      return {
        who,
        text:
          e.toValue === 'on_time' ? 'اتقفلت في الميعاد ✓' : e.toValue === 'late' ? 'اتقفلت بعد الموعد' : 'اتقفلت',
      };
    case 'reopened':
      return { who, text: `اتفتحت تاني في «${ctx.stepName(e.toValue ?? '')}»` };
    case 'reminder_soon':
      return { who: 'النظام', text: '⏰ تنبيه: قرب الموعد' };
    case 'reminder_overdue':
      return { who: 'النظام', text: '⚠ تنبيه: فات الموعد' };
    case 'note':
      return { who, text: e.note ?? '' };
  }
}
