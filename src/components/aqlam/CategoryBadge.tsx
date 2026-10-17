import {
  BookOpen,
  Clapperboard,
  Feather,
  Globe,
  Heart,
  Lightbulb,
  Music,
  Newspaper,
  PenLine,
  Quote,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { categoryMeta, type AqlamCategoryIcon, type AqlamConfig } from '@/lib/aqlam/config';

/** الأسماء ثابتة في الإعداد (`AQLAM_CATEGORY_ICONS`)، والرسم هنا. */
const ICONS: Record<AqlamCategoryIcon, LucideIcon> = {
  book: BookOpen,
  feather: Feather,
  lightbulb: Lightbulb,
  newspaper: Newspaper,
  clapperboard: Clapperboard,
  pen: PenLine,
  quote: Quote,
  sparkles: Sparkles,
  heart: Heart,
  star: Star,
  globe: Globe,
  music: Music,
};

/** أيقونة النوع — الأيقونة وحدها مش معلومة، فمعاها النص دايمًا. التصنيف المجهول بياخد القلم. */
export function CategoryIcon({
  icon,
  className = 'h-4 w-4',
}: {
  icon: AqlamCategoryIcon | undefined | null;
  className?: string;
}) {
  const Icon = (icon && ICONS[icon]) || PenLine;
  return <Icon className={className} aria-hidden="true" />;
}

export function CategoryBadge({ category, cfg }: { category: string; cfg: AqlamConfig }) {
  const meta = categoryMeta(cfg, category);
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-slate-800 ring-1 ring-slate-200">
      <CategoryIcon icon={meta.icon} className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}
