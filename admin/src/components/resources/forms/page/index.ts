import { ResourceFormDirtyGuard } from "./resource-form-dirty-guard";
import { ResourceFormFooter } from "./resource-form-footer";

/** Form page primitives shared by the resource page factory and feature forms. */
export const resourcePageForms = {
  Footer: ResourceFormFooter,
  DirtyGuard: ResourceFormDirtyGuard,
} as const;

export { ResourceFormFooter } from "./resource-form-footer";
export { ResourceFormDirtyGuard } from "./resource-form-dirty-guard";
