import { ResourceView } from "@/components/resources";
import { writingPackageColumns } from "./columns";
import { writingPackageForm } from "./dialogs";
import {
  WRITING_PACKAGES_RESOURCE,
  type WritingPackage,
} from "./model";

export function WritingPackagesPage() {
  return (
    <ResourceView<WritingPackage>
      resource={WRITING_PACKAGES_RESOURCE}
      title="باقات الكتابة الإبداعية"
      description="إدارة باقات برنامج «بداية الرحلة» التي تظهر للزوار وتُستخدم عند الحجز."
      columns={writingPackageColumns}
      searchField="name"
      mode="dialog"
      form={writingPackageForm}
      getRowLabel={(pkg) => pkg.name}
      deleteConsequence="تأكّد من عدم وجود اشتراكات أو طلبات أو مواد مرتبطة. ستُحذف روابط المدربين المرتبطة بهذه الباقة."
      refineCoreProps={{
        sorters: {
          initial: [
            { field: "created_at", order: "asc" },
            { field: "id", order: "asc" },
          ],
        },
      }}
    />
  );
}
