import { useOne } from "@refinedev/core";
import {
  useAdminIdentity,
  useAdminSessionVersion,
} from "@/hooks/auth/use-admin-access";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteIdentityContactForm } from "./form";
import {
  siteIdentityContactQuery,
  type SiteIdentityContactRecord,
} from "./model";

export function IdentityContactPage() {
  const identity = useAdminIdentity();
  const sessionVersion = useAdminSessionVersion();
  const { query } = useOne<SiteIdentityContactRecord>(
    siteIdentityContactQuery({
      enabled: Boolean(identity.data?.id),
      authVersion: sessionVersion,
      profileId: identity.data?.id,
    }),
  );
  const record = query.data?.data;

  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>تعذر تحميل بيانات الهوية والتواصل</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <p>{query.error.message}</p>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "جارٍ التحميل…" : "إعادة المحاولة"}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (query.isPending || !record) {
    return (
      <div role="status" aria-label="جارٍ تحميل الإعدادات" className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <section className="flex min-w-0 flex-col gap-6" aria-labelledby="identity-contact-title">
      <header className="flex flex-col gap-2">
        <h2 id="identity-contact-title" className="text-xl font-semibold">
          الهوية والتواصل
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          بيانات المنصة التي تظهر للعملاء في الموقع وصفحة التواصل. اترك الحقل
          فارغًا لإخفاء بيانات التواصل الاختيارية.
        </p>
      </header>
      <SiteIdentityContactForm record={record} />
    </section>
  );
}
