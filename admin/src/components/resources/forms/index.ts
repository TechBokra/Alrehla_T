/** Stable shared surface for route pages, dialog resources and feature forms. */
export { resourceFormRegistry } from "./registry";
export {
  resourceDialogForms,
  ResourceEditor,
  ResourceFormDialog,
} from "./dialog";
export type { ResourceFormDialogContext } from "./dialog";
export {
  resourcePageForms,
  ResourceFormPage,
  ResourceFormFooter,
  ResourceFormDirtyGuard,
} from "./page";
export type { ResourceFormPageContext } from "./page";
