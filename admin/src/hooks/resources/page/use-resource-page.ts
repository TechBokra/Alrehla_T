import { useResourcePageContext } from "@/contexts/resource-page";
import type { ResourcePageRuntime } from "@/contexts/resource-page/types";
import type { BaseRecord } from "@refinedev/core";
import type {
  ResourceDetailsPageDefinition,
  ResourceFormFactory,
} from "@/components/resources/page/types";
import type { ResourcePageActionDescriptor } from "@/contexts/resource-page/types";

export interface ResourcePageIdentity {
  resource: string;
}

type ResourcePageRecord<TDefinition> =
  TDefinition extends ResourceFormFactory<infer TRecord, any>
    ? TRecord
    : TDefinition extends ResourceDetailsPageDefinition<infer TRecord>
      ? TRecord
      : BaseRecord;
type ResourcePageForm<TDefinition> =
  TDefinition extends ResourceFormFactory<any, infer TFeature>
    ? TFeature extends { form: infer TForm }
      ? TForm
      : undefined
    : undefined;
type ResourcePageFeature<TDefinition> =
  TDefinition extends ResourceFormFactory<any, infer TFeature>
    ? TFeature
    : undefined;
type ResourcePageActions<TDefinition> = TDefinition extends { commands: infer TCommands }
  ? { [TKey in keyof TCommands]: ResourcePageActionDescriptor<Record<string, string>> }
  : TDefinition extends { page: { commands: infer TCommands } }
    ? { [TKey in keyof TCommands]: ResourcePageActionDescriptor<Record<string, string>> }
    : Record<string, ResourcePageActionDescriptor<Record<string, string>>>;

/** Read the state prepared by a resource's page controller. */
export function useResourcePage<TDefinition extends ResourcePageIdentity>(
  definition: TDefinition,
) {
  type TRecord = ResourcePageRecord<TDefinition>;
  const page = useResourcePageContext<TRecord>();
  if (page.resource !== definition.resource) {
    throw new Error(
      `Resource page context mismatch: expected ${definition.resource}, received ${page.resource}.`,
    );
  }
  return {
    ...page,
    form: page.form as ResourcePageForm<TDefinition>,
    feature: page.feature as ResourcePageFeature<TDefinition>,
    actions: page.actions as ResourcePageActions<TDefinition>,
  } as Omit<ResourcePageRuntime<TRecord>, "form" | "feature" | "actions"> & {
    form: ResourcePageForm<TDefinition>;
    feature: ResourcePageFeature<TDefinition>;
    actions: ResourcePageActions<TDefinition>;
  };
}
