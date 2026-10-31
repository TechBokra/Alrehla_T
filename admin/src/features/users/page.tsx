import { ResourceProvider } from "@/components/resources/resource-provider";
import { usersColumn } from "./columns";
import type { UserRecord } from "./model";

export function UsersPage() {
  return (
    <ResourceProvider<UserRecord>
      resource="users"
      title="المستخدمون"
      description="إدارة حسابات العملاء والإداريين ومقدّمي الخدمة والناشرين."
      searchFields={["full_name", "email"]}
      columns={usersColumn}
      form={{
        title: "مستخدم",
        dataProviderName: "users",
        fields: (context) => <></>,
      }}
    />
  );
}
