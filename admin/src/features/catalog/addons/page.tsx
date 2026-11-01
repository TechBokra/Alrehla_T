import { ResourceView } from "@/components/resources";
import { addonForm } from "./dialogs";
import { addonColumns } from "./columns";
import type { Addon } from "./model";

export function AddonsPage() {
  return (
    <ResourceView<Addon>
      resource="addon_products"
      title="الإضافات"
      description="إدارة الإضافات وأسعارها الشاملة للتخصيص. الإضافات الجديدة تُحفظ غير نشطة."
      columns={addonColumns}
      form={addonForm}
      enableRowReordering
      refineCoreProps={{
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
