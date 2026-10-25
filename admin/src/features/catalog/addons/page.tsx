import { addonSchema } from "../model";
import { catalogColumns } from "../columns";
import { CatalogResource } from "../resource";
import type { CatalogDefinition } from "../editor";
import { addonCreate, addonUpdate, addonValues, type Addon } from "./model";
const definition: CatalogDefinition<Addon> = {
  title: "إضافة",
  schema: addonSchema,
  createPayload: addonCreate,
  updatePayload: addonUpdate,
  fromRecord: addonValues,
  canEdit: () => true,
};
const columns = catalogColumns<Addon>;
export function AddonsPage() {
  return (
    <CatalogResource
      resource="addon_products"
      definition={definition}
      title="الإضافات"
      description="إدارة الإضافات وأسعارها الشاملة للتخصيص. الإضافات الجديدة تُحفظ غير نشطة."
      columns={columns}
    />
  );
}
