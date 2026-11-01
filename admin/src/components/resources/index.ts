/** Stable shared interface for feature pages and standalone resource gates. */
export { ResourceAccessGate } from "./access";
export { ResourceRowActions, createResourceActions } from "./actions";
export { ResourceView } from "./view";
export type {
  ResourceDeleteDialogProps,
  ResourceFormDefinition,
  ResourceDialogFormDefinition,
  ResourceFormMode,
  ResourceFormFieldsContext,
  ResourceRowAction,
  ResourceViewProps,
} from "./types";
