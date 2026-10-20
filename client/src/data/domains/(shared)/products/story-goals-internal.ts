import type { StoryGoal } from '@/lib/story-goals';
import { readAppliesTo } from '@/lib/applies-to';

type GoalRow = {
  id: string;
  label: string;
  applies_to: string[] | null;
  is_active: boolean;
  sort_order: number;
};

export function mapGoal(r: GoalRow): StoryGoal {
  return {
    id: r.id,
    label: r.label,
    appliesTo: readAppliesTo(r.applies_to),
    isActive: Boolean(r.is_active),
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
  };
}
