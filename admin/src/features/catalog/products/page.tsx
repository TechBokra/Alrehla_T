import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/block/shuip/data-table";
import { catalogSchema } from "../model";
import { catalogColumns } from "../columns";
import { CatalogResource } from "../resource";
import type { CatalogDefinition } from "../editor";
import {
  productCreate,
  productUpdate,
  productValues,
  isEditableProduct,
  type Product,
} from "./model";

const definition: CatalogDefinition<Product> = {
  resource: "personalized_products",
  title: "منتج للمنصة",
  schema: catalogSchema,
  createPayload: productCreate,
  updatePayload: productUpdate,
  fromRecord: productValues,
  canEdit: isEditableProduct,
};
const categories = [
  { value: "library", label: "المكتبة" },
  { value: "custom", label: "قصة مخصصة" },
];
function columns(edit: (id: string) => void): ColumnDef<Product, unknown>[] {
  const columns = catalogColumns<Product>(edit);
  columns.splice(1, 0, {
    accessorKey: "category",
    meta: { label: "التصنيف", variant: "multiSelect", options: categories },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="التصنيف" />
    ),
    cell: ({ row }) =>
      categories.find((category) => category.value === row.original.category)
        ?.label ?? "اشتراك",
  });
  return columns;
}
export function ProductsPage() {
  return (
    <CatalogResource
      definition={definition}
      title="منتجات المنصة"
      description="إدارة منتجات المكتبة والقصص المخصصة. المنتجات الجديدة تُحفظ غير نشطة."
      columns={columns}
      filters={[{ field: "owner_type", operator: "eq", value: "platform" }]}
    />
  );
}
