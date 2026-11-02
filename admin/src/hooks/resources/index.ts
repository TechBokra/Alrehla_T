/** Stable shared hook interface for resource presentation and feature pages. */
export { useResourceAuthorization } from "./authorization";
export { useResourceRowActions } from "./actions";
export { useResourceController } from "./controller";
export { useResourceDeleteCrud, useResourceFormCrud, useResourceBooleanField } from "./crud";
export { useResourceContext, useResourceScope } from "./scope";
export { useResourceTable } from "./table";
export { useResourcePage } from "./page/use-resource-page";
export { useResourceFormBaseline } from "./crud/use-resource-form-baseline";
export { useResourceCommands } from "./page/use-resource-commands";
export type {
  ResourceCommandDefinition,
  ResourceCommandField,
  ResourceCommandMap,
} from "./page/use-resource-commands";
export type {
  UseResourceDeleteCrudOptions,
  UseResourceFormCrudOptions,
} from "./crud";
export type { UseResourceTableOptions } from "./table";
