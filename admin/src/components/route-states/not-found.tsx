import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="justify-items-center gap-3">
          <Badge variant="secondary" dir="ltr">
            404
          </Badge>
          <CardTitle>
            <h1>الصفحة دي مش موجودة.</h1>
          </CardTitle>
          <CardDescription>
            استخدم قائمة التنقل للرجوع إلى لوحة المعاينة.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
