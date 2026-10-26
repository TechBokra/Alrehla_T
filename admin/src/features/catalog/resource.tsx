import {
  ResourceProvider,
  type ResourceProviderProps,
} from "@/components/resources/resource-provider";
import {
  CatalogFormFields,
  type CatalogDefinition,
  type CatalogResourceName,
} from "./editor";
import { catalogError } from "./model";
import type { CatalogRow } from "./columns";

type CatalogResourceProps<TRecord extends CatalogRow> = Omit<
  ResourceProviderProps<TRecord>,
  "resource" | "form"
> & {
  resource: CatalogResourceName;
  definition: CatalogDefinition<TRecord>;
};

/** Catalog defaults and fields; all page composition belongs to ResourceProvider. */
export function CatalogResource<TRecord extends CatalogRow>({
  definition,
  searchField = "name",
  enableRowReordering = true,
  refineCoreProps,
  ...props
}: CatalogResourceProps<TRecord>) {
  return (
    <ResourceProvider<TRecord>
      {...props}
      searchField={searchField}
      enableRowReordering={enableRowReordering}
      refineCoreProps={{
        ...refineCoreProps,
        sorters: refineCoreProps?.sorters ?? {
          initial: [
            { field: "sort_order", order: "asc" },
            { field: "id", order: "asc" },
          ],
        },
      }}
      form={{
        title: definition.title,
        canEdit: definition.canEdit,
        getErrorMessage: catalogError,
        fields: (context) => (
          <CatalogFormFields definition={definition} {...context} />
        ),
      }}
    />
  );
}
