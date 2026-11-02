import { resourceDialogForms } from "./dialog";
import { resourcePageForms } from "./page";

/** Select one of the two shared resource form presentations: modal or route. */
export const resourceFormRegistry = {
  dialog: resourceDialogForms,
  page: resourcePageForms,
} as const;
