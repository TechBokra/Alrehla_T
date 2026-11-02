import { useOne, type BaseRecord } from "@refinedev/core";
import type { ComponentType, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useResourceAuthorization } from "@/hooks/resources";
import { useResourceFormCrud } from "@/hooks/resources/crud/use-resource-form-crud";
import { useResourceCommands } from "@/hooks/resources/page/use-resource-commands";
import { useResourcePage } from "@/hooks/resources/page/use-resource-page";
import { ResourcePageContextProvider } from "@/contexts/resource-page";
import type { ResourcePageRuntime } from "@/contexts/resource-page/types";
import { ResourceFormFooter } from "../forms/page/resource-form-footer";
import { ResourceFormDirtyGuard } from "../forms/page/resource-form-dirty-guard";
import { ResourceCommandDialogs } from "./resource-command-dialogs";
import type {
  ResourceDetailsPageDefinition,
  ResourceFormFeatureContext,
  ResourceFormPageDefinition,
  ResourceFormFeatureState,
  ResourcePageFactory,
  ResourceFormFactory,
} from "./types";
import type { ResourceCommandMap } from "@/hooks/resources/page/use-resource-commands";

const EMPTY_COMMANDS: ResourceCommandMap<BaseRecord> = {};

/**
 * Bind page UI components once at module scope. The returned Page component
 * owns Refine page state; feature hooks/components own only feature fields and
 * layouts.
 */
export function createResourcePage<
  TRecord extends BaseRecord,
  TFeature extends { form: unknown } = { form: unknown },
  TCommands extends ResourceCommandMap<TRecord> = ResourceCommandMap<TRecord>,
>(
  definition: ResourceFormPageDefinition<TRecord, TFeature, TCommands>,
): ResourceFormFactory<TRecord, TFeature, TCommands>;
export function createResourcePage<
  TRecord extends BaseRecord,
  TCommands extends ResourceCommandMap<TRecord> = ResourceCommandMap<TRecord>,
>(
  definition: ResourceDetailsPageDefinition<TRecord, TCommands>,
): Extract<ResourcePageFactory<TRecord, { form: unknown }, TCommands>, { kind: "details" }>;
export function createResourcePage<TRecord extends BaseRecord>(
  definition: ResourceFormPageDefinition<TRecord, any, any> | ResourceDetailsPageDefinition<TRecord, any>,
): ResourcePageFactory<TRecord> {
  function Page({ id }: { id?: string }) {
    if (definition.kind === "form") {
      if (!definition.page) {
        return <UnavailablePage message="صفحة النموذج غير مهيأة لهذا المورد." />;
      }
      return <FormPageRoute definition={definition} id={id} />;
    }
    return <DetailsPageRoute definition={definition} id={id} />;
  }

  function Fields() {
    if (definition.kind !== "form" || !definition.page?.Fields) return null;
    const Component = definition.page.Fields;
    return <Component />;
  }

  function Footer({
    onCancel,
    saveLabel,
    showCancel = true,
    disabled = false,
    className,
  }: {
    onCancel?: () => void;
    saveLabel?: string;
    showCancel?: boolean;
    disabled?: boolean;
    className?: string;
  }) {
    const page = useResourcePage(definition);
    if (page.kind !== "form") return null;
    return (
      <ResourceFormFooter
        mode={page.mode === "edit" ? "edit" : "create"}
        disabled={page.disabled || disabled}
        onCancel={onCancel}
        saveLabel={saveLabel}
        showCancel={showCancel}
        className={className}
      />
    );
  }

  function DirtyGuard() {
    return definition.kind === "form" && definition.page
      ? <ResourceFormDirtyGuard />
      : null;
  }

  function Action({ name, children }: { name: string; children?: ReactNode }) {
    const page = useResourcePage(definition);
    const action = page.actions[name];
    if (!action) return null;
    return (
      <Button {...action.buttonProps}>
        {children ?? action.label}
      </Button>
    );
  }

  function ActionMenuItem({ name, children }: { name: string; children?: ReactNode }) {
    const page = useResourcePage(definition);
    const action = page.actions[name];
    if (!action) return null;
    return (
      <DropdownMenuItem {...action.menuItemProps}>
        {children ?? action.label}
      </DropdownMenuItem>
    );
  }

  function CommandDialogs() {
    if (definition.kind !== "details") return null;
    return <ResourceCommandDialogs commands={definition.commands} />;
  }

  const factory = {
    ...definition,
    Page,
    Fields,
    Footer,
    DirtyGuard,
    Action,
    ActionMenuItem,
    CommandDialogs,
  };
  return factory as ResourcePageFactory<TRecord>;
}

function FormPageRoute<TRecord extends BaseRecord>({
  definition,
  id,
}: {
      definition: ResourceFormPageDefinition<TRecord, ResourceFormFeatureState>;
  id?: string;
}) {
  const pageDefinition = definition.page!;
  const crud = useResourceFormCrud<TRecord>({
    resource: definition.resource,
    id,
    dataProviderName: definition.dataProviderName,
    canEdit: pageDefinition.canEdit,
    getErrorMessage: pageDefinition.getErrorMessage,
    suppressNotifications: true,
    presentation: "page",
    redirectAfterCreate: pageDefinition.redirectAfterCreate,
  });
  const mode = id === undefined ? "create" : "edit";
  const title = pageDefinition.title(mode);

  return (
    <section className="flex flex-col gap-6" aria-busy={crud.busy}>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {pageDefinition.description?.(mode) ? (
          <p className="text-muted-foreground">{pageDefinition.description(mode)}</p>
        ) : null}
      </header>
      {crud.initialLoading ? (
        <div role="status" className="flex flex-col gap-4">
          <span>جارٍ تحميل {title}…</span>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : crud.initialError ? (
        <Alert variant={crud.state === "failed" ? "destructive" : "default"}>
          <AlertTitle>
            {crud.state === "forbidden"
              ? "لا تملك صلاحية الوصول إلى هذا المورد"
              : crud.state === "missing"
                ? "السجل غير متاح"
                : "تعذّر تحميل البيانات"}
          </AlertTitle>
          <AlertDescription className="mt-2 flex flex-col items-start gap-3">
            <p>{crud.error ?? "تحقق من الاتصال ثم حاول تحميل السجل مرة أخرى."}</p>
            {crud.canRetry ? (
              <Button variant="outline" disabled={crud.busy} onClick={() => void crud.retryLoad()}>
                إعادة المحاولة
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : crud.unavailable ? (
        <Alert>
          <AlertTitle>السجل غير متاح للتعديل</AlertTitle>
          <AlertDescription>لا يمكن تعديل هذا السجل من هذه الصفحة.</AlertDescription>
        </Alert>
      ) : (
        <FormPageContent
          definition={definition}
          context={{
            record: crud.record,
            id,
            mode,
            disabled: crud.busy || crud.unavailable,
            pending: crud.pending,
            save: crud.save,
            refreshRecord: crud.refreshRecord,
            getLastError: crud.getLastError,
            redirectAfterCreate: crud.redirectAfterCreate,
          }}
          crud={crud}
        />
      )}
    </section>
  );
}

function FormPageContent<TRecord extends BaseRecord>({
  definition,
  context,
  crud,
}: {
  definition: ResourceFormPageDefinition<TRecord, ResourceFormFeatureState>;
  context: ResourceFormFeatureContext<TRecord>;
  crud: ReturnType<typeof useResourceFormCrud<TRecord>>;
}) {
  const pageDefinition = definition.page!;
  const feature = pageDefinition.useFeatureForm(context);
  const featureIsDirty = Boolean(feature.isDirty);
  const commandBlockReason = featureIsDirty
    ? "احفظ تغييرات النموذج أو ألغِها قبل تنفيذ الإجراء."
    : undefined;
  const commandController = useResourceCommands<TRecord>({
    resource: definition.resource,
    id: context.id ?? "",
    record: context.record ?? ({} as TRecord),
    dataProviderName: definition.dataProviderName ?? "default",
    commands: pageDefinition.commands ?? EMPTY_COMMANDS,
    refetchRecord: crud.refreshRecord,
    enabled: Boolean(context.id && context.record) && !featureIsDirty,
    blockedMessage: commandBlockReason,
  });
  const runtime: ResourcePageRuntime<TRecord> = {
    kind: "form",
    resource: definition.resource,
    id: context.id,
    record: context.record,
    mode: context.mode,
    title: pageDefinition.title(context.mode),
    disabled: context.disabled,
    pending: context.pending,
    loading: crud.busy,
    error: crud.error ?? undefined,
    save: crud.save as ResourcePageRuntime<TRecord>["save"],
    refreshRecord: crud.refreshRecord,
    redirectAfterCreate: crud.redirectAfterCreate as ResourcePageRuntime<TRecord>["redirectAfterCreate"],
    getLastError: crud.getLastError,
    retry: crud.retryLoad,
    canRetry: crud.canRetry,
    form: feature.form,
    feature,
    actions: commandController.actions,
    activeCommandKey: commandController.activeCommandKey,
    closeCommand: commandController.close,
    feedback: commandController.feedback,
    commandBlockReason,
  };
  const Content = pageDefinition.Content;
  return (
    <ResourcePageContextProvider value={runtime}>
      {commandBlockReason && pageDefinition.commands ? (
        <Alert>
          <AlertDescription>{commandBlockReason}</AlertDescription>
        </Alert>
      ) : null}
      <Content />
      {pageDefinition.commands ? <ResourceCommandDialogs commands={pageDefinition.commands} /> : null}
    </ResourcePageContextProvider>
  );
}

function DetailsPageRoute<TRecord extends BaseRecord>({
  definition,
  id,
}: {
  definition: ResourceDetailsPageDefinition<TRecord>;
  id?: string;
}) {
  const access = useResourceAuthorization(definition.resource, "show", { id });
  const detail = useOne<TRecord>({
    resource: definition.resource,
    id: id ?? "",
    dataProviderName: definition.dataProviderName,
    errorNotification: false,
    queryOptions: {
      enabled: Boolean(id) && access.allowed,
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const record = detail.result;
  const query = detail.query;
  const commandController = useResourceCommands<TRecord>({
    resource: definition.resource,
    id: id ?? "",
    record: record ?? ({} as TRecord),
    dataProviderName: definition.dataProviderName,
    commands: definition.commands,
    enabled: Boolean(id && record),
    refetchRecord: async () => {
      const refreshed = await query.refetch();
      return refreshed.data?.data;
    },
  });
  if (access.isPending || (access.allowed && (query.isPending || query.isFetching && !record))) {
    return <LoadingPage title={definition.title} />;
  }
  if (!id || access.isError || !access.allowed || query.isError || !record) {
    return (
      <Alert variant={query.isError || access.isError ? "destructive" : "default"}>
        <AlertTitle>
          {!access.allowed && !access.isError
            ? "لا تملك صلاحية الوصول إلى هذا المورد"
            : query.isError || access.isError
              ? "تعذّر تحميل البيانات"
              : "السجل غير متاح"}
        </AlertTitle>
        <AlertDescription className="mt-2 flex flex-col items-start gap-3">
          <p>
            {access.data?.reason ??
              (query.isError || access.isError
                ? "تحقق من الاتصال ثم حاول تحميل السجل مرة أخرى."
                : "قد يكون السجل غير موجود أو غير متاح لحسابك.")}
          </p>
          {access.isError || query.isError ? (
            <Button
              variant="outline"
              disabled={access.isFetching || query.isFetching}
              onClick={() => void (access.isError ? access.refetch() : query.refetch())}
            >
              إعادة المحاولة
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }
  const runtime: ResourcePageRuntime<TRecord> = {
    kind: "details",
    resource: definition.resource,
    id,
    record,
    mode: "details",
    title: definition.title,
    disabled: commandController.pending,
    pending: commandController.pending,
    loading: query.isFetching,
    error: commandController.preflightError,
    actions: commandController.actions,
    activeCommandKey: commandController.activeCommandKey,
    closeCommand: commandController.close,
    feedback: commandController.feedback,
  };
  const Content = definition.Content;
  return (
    <ResourcePageContextProvider value={runtime}>
      <section className="flex flex-col gap-6" aria-busy={runtime.pending}>
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{definition.title}</h1>
          {definition.description ? <p className="text-muted-foreground">{definition.description}</p> : null}
        </header>
        {commandController.feedback ? (
          <Alert variant={commandController.feedback.kind === "error" ? "destructive" : "default"}>
            <AlertDescription>{commandController.feedback.message}</AlertDescription>
          </Alert>
        ) : null}
        <Content />
        <ResourceCommandDialogs commands={definition.commands} />
      </section>
    </ResourcePageContextProvider>
  );
}

function LoadingPage({ title }: { title: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span>جارٍ تحميل {title}…</span>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function UnavailablePage({ message }: { message: string }) {
  return <Alert><AlertTitle>السجل غير متاح</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>;
}

export type { ResourcePageActionDescriptor } from "@/contexts/resource-page/types";
