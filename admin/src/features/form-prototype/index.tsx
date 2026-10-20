"use client";

import { Code2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AllFieldsForm } from "./all-fields-form";
import { RefineFormDemo } from "./refine-demo";

const compositionExample = `const form = useAppForm({
  defaultValues,
  validators: { onChange: schema, onSubmit: schema },
  onSubmit: async ({ value }) => onFinish(value),
})

return (
  <form.AppForm>
    <form onSubmit={(event) => {
      event.preventDefault()
      void form.handleSubmit()
    }}>
      <form.AppField name="title">
        {(field) => <field.Input label="Title" />}
      </form.AppField>
      <form.FormActions>
        <form.SubmitButton>Save</form.SubmitButton>
        <form.ResetButton />
      </form.FormActions>
    </form>
  </form.AppForm>
)`;

export function FormPrototypePage() {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4 border-b pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">PROTOTYPE · APP LOCAL</Badge>
          <Badge variant="secondary">TanStack Form</Badge>
          <Badge variant="secondary">Refine</Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Composable forms
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Explore a typed TanStack form hook with pre-bound controls, then see
          Refine connect validated values to create and edit operations. Every
          record and save on this page is an in-memory preview.
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="text-primary" />
            <CardTitle>Composition pattern</CardTitle>
          </div>
          <CardDescription>
            The field name is checked against the form&apos;s TypeScript value
            shape; its registered component reads its value from the matching
            field context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-xl bg-muted p-4 text-xs leading-relaxed sm:text-sm">
            {compositionExample}
          </pre>
        </CardContent>
      </Card>

      <AllFieldsForm />
      <div className="border-t pt-10">
        <RefineFormDemo />
      </div>
    </div>
  );
}
