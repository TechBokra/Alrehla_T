import type { ReactNode } from "react";
import { useResourceAuthorization } from "@/hooks/resources/use-resource-authorization";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ResourceAccessGate({ resource, action = "list", children }: {
  resource: string;
  action?: string;
  children: ReactNode;
}) {
  const access = useResourceAuthorization(resource, action);
  if (access.isPending) return (
    <div role="status" className="flex flex-col gap-3">
      <span>جارٍ التحقق من صلاحية الوصول…</span>
      <Skeleton className="h-32 w-full" />
    </div>
  );
  if (!access.allowed) return (
    <Alert className="text-start">
      <AlertTitle>{access.isError ? "تعذّر التحقق من الصلاحيات" : "غير مصرح بالوصول"}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-3">
        <p>{access.isError ? "تعذّر تحميل صلاحيات الحساب. حاول مرة أخرى." : access.data?.reason}</p>
        <Button variant="outline" disabled={access.isFetching} onClick={() => void access.refetch()}>
          {access.isFetching ? "جارٍ التحقق…" : "إعادة المحاولة"}
        </Button>
      </AlertDescription>
    </Alert>
  );
  return children;
}
