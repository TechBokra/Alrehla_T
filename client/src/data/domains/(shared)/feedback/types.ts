import type { FeedbackLine } from '@/lib/feedback-lines';

export type FeedbackRow = {
  id: string;
  userId: string;
  line: FeedbackLine;
  rating: number;
  comment: string;
  status: 'new' | 'seen';
  createdAt: string;
};
