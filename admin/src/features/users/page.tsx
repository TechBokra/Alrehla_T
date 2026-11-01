import { ResourceView } from "@/components/resources";
import { usersColumn } from "./columns";
import type { UserRecord } from "./model";

export function UsersPage() {
  return (
    <ResourceView<UserRecord>
      resource="users"
      title="المستخدمون"
      description="إدارة حسابات العملاء والإداريين ومقدّمي الخدمة والناشرين."
      searchFields={["full_name", "email"]}
      columns={usersColumn}
      mode="dialog"
      form={{
        title: "مستخدم",
        dataProviderName: "users",
        fields: (context) => <></>,
      }}
    />
  );
}
