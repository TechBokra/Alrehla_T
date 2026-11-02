/** Stable shared interface for feature pages and standalone resource gates. */
export { ResourceAccessGate } from "./access";
export { ResourceRowActions, createResourceActions } from "./actions";
export { ResourceView } from "./view";
export { createResourcePage } from "./page";
export type {
  ResourceDeleteDialogProps,
  ResourceFormDefinition,
  ResourceDialogFormDefinition,
  ResourceFormMode,
  ResourceFormFieldsContext,
  ResourceRowAction,
  ResourceViewProps,
} from "./types";
export type { ResourcePageFactory, ResourceFormFactory } from "./page";
