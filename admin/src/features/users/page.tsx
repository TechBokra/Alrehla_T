import { ResourceView } from "@/components/resources";
import { createResourcePage } from "@/components/resources/page";
import { usersColumn } from "./columns";
import type { UserRecord } from "./model";

const usersForm = createResourcePage<UserRecord>({
  kind: "form",
  resource: "users",
  dataProviderName: "users",
  dialog: {
    title: "مستخدم",
    fields: () => null,
  },
});

export function UsersPage() {
  return (
    <ResourceView<UserRecord>
      resource="users"
      title="المستخدمون"
      description="إدارة حسابات العملاء والإداريين ومقدّمي الخدمة والناشرين."
      searchFields={["full_name", "email"]}
      columns={usersColumn}
      mode="dialog"
      form={usersForm}
    />
  );
}
