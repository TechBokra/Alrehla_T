import { ShowcaseLayout } from "../showcase-layout";
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

export function FieldsPage({ activeSection }: { activeSection: "fields" }) {
  return (
    <ShowcaseLayout activeSection={activeSection}>
      <AllFieldsForm />
      <Collapsible className="flex flex-col gap-4">
        <CollapsibleTrigger asChild>
          <Button type="button" variant="outline" className="self-start">
            Refine authentication examples
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Refine sign in</CardTitle>
                <CardDescription>
                  Separate local authentication example.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignInForm />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Refine sign up</CardTitle>
                <CardDescription>
                  Separate local registration example.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignUpForm />
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ShowcaseLayout>
  );
}
