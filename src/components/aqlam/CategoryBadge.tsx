import { BookOpen, Clapperboard, Feather, Lightbulb, Newspaper, PenLine, type LucideIcon } from 'lucide-react';
import { categoryLabel, isAqlamCategory } from '@/lib/aqlam/post';

const ICONS: Record<string, LucideIcon> = {
  story: BookOpen,
  poem: Feather,
  reflection: Lightbulb,
  article: Newspaper,
  scene: Clapperboard,
};

/** أيقونة النوع (قصة/قصيدة/خاطرة/مقال/مشهد) — الأيقونة وحدها مش معلومة، فمعاها النص دايمًا. */
export function CategoryIcon({ category, className = 'h-4 w-4' }: { category: string; className?: string }) {
  const Icon = isAqlamCategory(category) ? ICONS[category] : PenLine;
  return <Icon className={className} aria-hidden="true" />;
}

export function CategoryBadge({ category }: { category: string }) {
  const label = categoryLabel(category);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-800 ring-1 ring-slate-200">
      <CategoryIcon category={category} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
