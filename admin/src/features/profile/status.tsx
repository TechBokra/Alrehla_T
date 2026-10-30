import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
export function ErrorAlert({ message: text }: { message: string }) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>تعذر إكمال العملية</AlertTitle>
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}
