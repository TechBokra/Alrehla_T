import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type RootErrorProps = {
  error: unknown;
  reset: () => void;
  onReload?: () => void;
};

export function RootError({ error, reset, onReload }: RootErrorProps) {
  return (
    <main
      dir="rtl"
      className="grid min-h-svh place-items-center bg-background p-6"
    >
      <Card className="w-full max-w-md" role="alert">
        <CardHeader className="gap-3">
          <AlertCircle aria-hidden="true" className="size-6 text-destructive" />
          <CardTitle>
            <h1>تعذّر عرض لوحة الإدارة</h1>
          </CardTitle>
          <CardDescription>
            حدث خطأ غير متوقع. حاول مرة أخرى، أو أعد تحميل الصفحة إذا استمرت
            المشكلة.
          </CardDescription>
          {import.meta.env.DEV && (
            <p className="break-words text-sm text-muted-foreground" dir="auto">
              {String(error)}
            </p>
          )}
        </CardHeader>
        <CardFooter className="flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            حاول مرة أخرى
          </Button>
          {onReload && (
            <Button type="button" variant="outline" onClick={onReload}>
              إعادة تحميل الصفحة
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
