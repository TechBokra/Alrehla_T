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
};

export function RootError({ error, reset }: RootErrorProps) {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <Card className="w-full max-w-md" role="alert">
        <CardHeader className="gap-3">
          <AlertCircle aria-hidden="true" className="size-6 text-destructive" />
          <CardTitle>
            <h1>حصلت مشكلة في معاينة لوحة الإدارة</h1>
          </CardTitle>
          <CardDescription className="break-words" dir="auto">
            {String(error)}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button type="button" onClick={reset}>
            <RotateCcw data-icon="inline-start" aria-hidden="true" />
            حاول مرة أخرى
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
