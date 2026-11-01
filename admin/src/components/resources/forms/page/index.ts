import { ResourceFormDirtyGuard } from "./resource-form-dirty-guard";
import { ResourceFormFooter } from "./resource-form-footer";
import { ResourceFormPage } from "./resource-form-page";

/** Route-page presentation modules shared by feature create/edit pages. */
export const resourcePageForms = {
  Page: ResourceFormPage,
  Footer: ResourceFormFooter,
  DirtyGuard: ResourceFormDirtyGuard,
} as const;

export { ResourceFormPage } from "./resource-form-page";
export { ResourceFormFooter } from "./resource-form-footer";
export { ResourceFormDirtyGuard } from "./resource-form-dirty-guard";
export type { ResourceFormPageContext } from "../types";
