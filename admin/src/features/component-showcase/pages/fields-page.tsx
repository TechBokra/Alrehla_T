import { AllFieldsForm } from "./all-fields-form";
import { SignInForm } from "@/components/refine-ui/form/sign-in-form";
import { SignUpForm } from "@/components/refine-ui/form/sign-up-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function FieldsPage() {
  return (
    <>
      <AllFieldsForm />
      <Collapsible className="flex flex-col gap-4">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="self-start">
            أمثلة تسجيل الدخول باستخدام Refine
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>تسجيل الدخول باستخدام Refine</CardTitle>
                <CardDescription>
                  مثال منفصل لتسجيل الدخول المحلي.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignInForm />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>إنشاء حساب باستخدام Refine</CardTitle>
                <CardDescription>مثال منفصل لإنشاء حساب محلي.</CardDescription>
              </CardHeader>
              <CardContent>
                <SignUpForm />
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
