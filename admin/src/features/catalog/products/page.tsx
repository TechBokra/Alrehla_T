import { ResourceProvider } from "@/components/resources/resource-provider";
import { productForm } from "./dialogs";
import { productColumns } from "./columns";
import type { Product } from "./model";

export function ProductsPage() {
  return (
    <ResourceProvider<Product>
      resource="personalized_products"
      title="منتجات المنصة"
      description="إدارة منتجات المكتبة والقصص المخصصة. المنتجات الجديدة تُحفظ غير نشطة."
      columns={productColumns}
      form={productForm}
      deleteConsequence="ستُحذف أيضًا روابط توزيعه المرتبطة به."
      enableRowReordering
      refineCoreProps={{
        filters: {
          permanent: [
            { field: "owner_type", operator: "eq", value: "platform" },
          ],
        },
        sorters: {
          initial: [
            { field: "sort_order", order: "asc" },
            { field: "id", order: "asc" },
          ],
        },
      }}
    />
  );
}
