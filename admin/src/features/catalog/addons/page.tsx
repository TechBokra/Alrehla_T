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
      searchField="name"
      mode="dialog"
      form={addonForm}
      orderField="sort_order"
    />
  );
}
