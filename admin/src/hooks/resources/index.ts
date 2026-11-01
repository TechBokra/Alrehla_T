/** Stable shared hook interface for resource presentation and feature pages. */
export { useResourceAuthorization } from "./authorization";
export { useResourceRowActions } from "./actions";
export { useResourceController } from "./controller";
export { useResourceDeleteCrud, useResourceFormCrud } from "./crud";
export { useResourceContext, useResourceScope } from "./scope";
export { useResourceTable } from "./table";
export type {
  UseResourceDeleteCrudOptions,
  UseResourceFormCrudOptions,
} from "./crud";
export type { UseResourceTableOptions } from "./table";
