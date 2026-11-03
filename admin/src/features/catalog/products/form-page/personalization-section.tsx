import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCustomMutation, useInvalidate, useList } from "@refinedev/core";
import { useStore } from "@tanstack/react-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { TagsSelect } from "@/components/ui/tags-select";
import { ResourceFormDirtyGuard } from "@/components/resources/forms/page/resource-form-dirty-guard";
import { useResourceFormBaseline } from "@/hooks/resources";
import { useResourceAuthorization } from "@/hooks/resources/authorization";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import { useAppForm } from "@/lib/form";
import {
  CATALOG_SETTINGS_PROVIDER,
  type CustomizationField,
  type StoryGoal,
} from "@/features/catalog/settings/model";
import {
  mergeSelectionIntent,
  planProductScopeChanges,
  selectedProductIds,
  sortScopeDefinitions,
  type ScopeDefinition,
} from "./personalization-scope";

type Definition = ScopeDefinition & { placeholder?: string | null };
type Values = { fields: string[]; goals: string[] };
type SaveResult = {
  results: Array<{ resource: string; id: string; ok: boolean; error?: string }>;
  succeeded: number;
  failed: number;
};
const selectionSchema = z.object({
  fields: z.array(z.string()).max(100),
  goals: z.array(z.string()).max(100),
});

function definitionOptions(items: Definition[]) {
  return items
    .filter((item) => item.applies_to !== null)
    .map((item) => ({
      value: item.id,
      label: item.label,
      description: item.is_active
        ? undefined
        : "غير نشط — سيظل الاختيار محفوظًا ولن يظهر للعملاء.",
    }));
}

export function ProductPersonalizationSection({
  productId,
  disabled,
}: {
  productId?: string;
  disabled: boolean;
}) {
  const authorization = useResourceAuthorization(
    "personalized_products",
    "edit",
    { id: productId },
  );
  const fieldsQuery = useList<CustomizationField>({
    resource: "customization_fields",
    dataProviderName: CATALOG_SETTINGS_PROVIDER,
    pagination: { currentPage: 1, pageSize: 100 },
    sorters: [
      { field: "sort_order", order: "asc" },
      { field: "id", order: "asc" },
    ],
    meta: {
      select: "id,label,is_active,applies_to,updated_at,sort_order,placeholder",
    },
    queryOptions: {
      retry: false,
      enabled: Boolean(productId) && authorization.allowed,
    },
  });
  const goalsQuery = useList<StoryGoal>({
    resource: "story_goals",
    dataProviderName: CATALOG_SETTINGS_PROVIDER,
    pagination: { currentPage: 1, pageSize: 100 },
    sorters: [
      { field: "sort_order", order: "asc" },
      { field: "id", order: "asc" },
    ],
    meta: { select: "id,label,is_active,applies_to,updated_at,sort_order" },
    queryOptions: {
      retry: false,
      enabled: Boolean(productId) && authorization.allowed,
    },
  });
  const fields = useMemo(
    () =>
      sortScopeDefinitions(
        (fieldsQuery.query.data?.data ?? []) as Definition[],
      ),
    [fieldsQuery.query.data],
  );
  const goals = useMemo(
    () =>
      sortScopeDefinitions((goalsQuery.query.data?.data ?? []) as Definition[]),
    [goalsQuery.query.data],
  );
  const denied = !authorization.isLoading && !authorization.allowed;
  const hasError = fieldsQuery.query.isError || goalsQuery.query.isError;
  const complete =
    fieldsQuery.query.data?.total === fields.length &&
    goalsQuery.query.data?.total === goals.length;
  const loading =
    authorization.isLoading ||
    fieldsQuery.query.isLoading ||
    goalsQuery.query.isLoading;
  const overPageLimit =
    !loading && !hasError && Boolean(productId) && !complete;
  const [readyOnce, setReadyOnce] = useState(false);
  useEffect(() => {
    if (complete) setReadyOnce(true);
  }, [complete]);
  if (!productId)
    return (
      <Alert>
        <AlertTitle>خيارات التخصيص</AlertTitle>
        <AlertDescription>
          يمكن اختيار خانات التخصيص وأهداف القصة بعد حفظ المنتج لأول مرة.
        </AlertDescription>
      </Alert>
    );
  if (denied)
    return (
      <Alert variant="destructive">
        <AlertTitle>لا تتوفر صلاحية التعديل</AlertTitle>
        <AlertDescription>
          لا تملك صلاحية إدارة تخصيص هذا المنتج.
        </AlertDescription>
      </Alert>
    );
  const hasSnapshot = Boolean(fieldsQuery.query.data && goalsQuery.query.data);
  if (loading && !hasSnapshot)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        جارٍ تحميل جميع تعريفات التخصيص…
      </p>
    );
  if ((hasError || overPageLimit) && !(readyOnce && hasSnapshot))
    return (
      <Alert variant="destructive">
        <AlertTitle>
          {overPageLimit
            ? "تعذّر تحميل جميع التعريفات"
            : "تعذّر تحميل خيارات التخصيص"}
        </AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {overPageLimit
            ? "تعذر تحميل المجموعة كاملة، لذا لن يُسمح بحفظ اختيارات غير مكتملة."
            : "تحقق من اتصال البيانات ثم أعد المحاولة."}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void fieldsQuery.query.refetch();
              void goalsQuery.query.refetch();
            }}
          >
            إعادة المحاولة
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (!complete && !(readyOnce && hasSnapshot))
    return (
      <p role="status" className="text-sm text-muted-foreground">
        جارٍ تحميل جميع تعريفات التخصيص…
      </p>
    );
  const readReady =
    complete &&
    !hasError &&
    !overPageLimit &&
    !fieldsQuery.query.isFetching &&
    !goalsQuery.query.isFetching;
  return (
    <PersonalizationEditor
      key={productId}
      productId={productId}
      disabled={disabled}
      readReady={readReady}
      readError={hasError || overPageLimit}
      fields={fields}
      goals={goals}
      refetch={async () => {
        const [f, g] = await Promise.all([
          fieldsQuery.query.refetch(),
          goalsQuery.query.refetch(),
        ]);
        if (
          !f.data ||
          !g.data ||
          f.isError ||
          g.isError ||
          f.data.total !== f.data.data.length ||
          g.data.total !== g.data.data.length
        )
          throw new Error("تعذّر تحميل جميع التعريفات الحالية.");
        return {
          fields: sortScopeDefinitions(f.data.data as Definition[]),
          goals: sortScopeDefinitions(g.data.data as Definition[]),
        };
      }}
    />
  );
}

function PersonalizationEditor({
  productId,
  disabled,
  readReady,
  readError,
  fields,
  goals,
  refetch,
}: {
  productId: string;
  disabled: boolean;
  readReady: boolean;
  readError: boolean;
  fields: Definition[];
  goals: Definition[];
  refetch: () => Promise<{ fields: Definition[]; goals: Definition[] }>;
}) {
  const initial: Values = {
    fields: selectedProductIds(fields, productId),
    goals: selectedProductIds(goals, productId),
  };
  const baseline = useResourceFormBaseline(() => initial);
  const [scopeSnapshot, setScopeSnapshot] = useState(() => ({ fields, goals }));
  const [feedback, setFeedback] = useState<{
    kind: "success" | "warning" | "error";
    text: string;
  }>();
  const [refreshNeeded, setRefreshNeeded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const mutation = useCustomMutation<SaveResult>({
    mutationOptions: { retry: false },
  });
  const invalidate = useInvalidate();
  const form = useAppForm({
    defaultValues: baseline.defaultValues,
    validators: { onSubmit: selectionSchema },
    onSubmit: async ({ value }) => save(value),
  });
  const dirty = useStore(form.store, (state) => state.isDirty);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const pending = submitting || mutation.mutation.isPending || refreshing;
  const canSave = dirty && !disabled && readReady && !pending && !refreshNeeded;

  async function refreshAndReconcile() {
    if (
      submitting ||
      mutation.mutation.isPending ||
      disabled ||
      refreshLock.current
    )
      return;
    refreshLock.current = true;
    setRefreshing(true);
    const requested = form.state.values;
    const previousBaseline = baseline.defaultValues;
    try {
      const actual = await refetch();
      const actualValues = {
        fields: selectedProductIds(actual.fields, productId),
        goals: selectedProductIds(actual.goals, productId),
      };
      const mergedFields = mergeSelectionIntent(
        actualValues.fields,
        previousBaseline.fields,
        requested.fields,
        actual.fields
          .filter((item) => item.applies_to !== null)
          .map((item) => item.id),
      );
      const mergedGoals = mergeSelectionIntent(
        actualValues.goals,
        previousBaseline.goals,
        requested.goals,
        actual.goals
          .filter((item) => item.applies_to !== null)
          .map((item) => item.id),
      );
      setScopeSnapshot(actual);
      baseline.reset(form, actualValues);
      form.setFieldValue("fields", mergedFields.selected);
      form.setFieldValue("goals", mergedGoals.selected);
      setRefreshNeeded(false);
      const unavailable = [
        ...mergedFields.unavailable,
        ...mergedGoals.unavailable,
      ];
      setFeedback(
        unavailable.length
          ? {
              kind: "warning",
              text: `تم تحديث البيانات. تعذّر الاحتفاظ باختيارات لتعريفات حُذفت أو أصبحت عامة: ${unavailable.join("، ")}.`,
            }
          : undefined,
      );
    } catch (error) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "تعذّر تحديث البيانات الحالية.",
      });
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }

  async function save(requested: Values) {
    let fieldChanges: ReturnType<typeof planProductScopeChanges>;
    let goalChanges: ReturnType<typeof planProductScopeChanges>;
    try {
      fieldChanges = planProductScopeChanges(
        scopeSnapshot.fields,
        productId,
        requested.fields,
      );
      goalChanges = planProductScopeChanges(
        scopeSnapshot.goals,
        productId,
        requested.goals,
      );
    } catch (error) {
      setRefreshNeeded(true);
      setFeedback({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "تعذّر التحقق من الاختيارات.",
      });
      return;
    }
    if (!readReady || disabled || refreshNeeded || refreshLock.current) return;
    if (!fieldChanges.length && !goalChanges.length) {
      baseline.reset(form, {
        fields: selectedProductIds(scopeSnapshot.fields, productId),
        goals: selectedProductIds(scopeSnapshot.goals, productId),
      });
      return;
    }
    setFeedback(undefined);
    let confirmed: number | undefined;
    try {
      await assertResourceAccess("personalized_products", "edit", {
        id: productId,
      });
      const result = await mutation.mutateAsync({
        url: "product-personalization/save",
        method: "post",
        dataProviderName: CATALOG_SETTINGS_PROVIDER,
        values: {
          productId,
          changes: [
            ...fieldChanges.map((change) => ({
              ...change,
              resource: "customization_fields" as const,
            })),
            ...goalChanges.map((change) => ({
              ...change,
              resource: "story_goals" as const,
            })),
          ],
        },
        successNotification: false,
        errorNotification: false,
      });
      const outcome = result.data;
      const expectedCount = fieldChanges.length + goalChanges.length;
      if (
        !outcome ||
        !Number.isInteger(outcome.succeeded) ||
        !Number.isInteger(outcome.failed) ||
        outcome.succeeded < 0 ||
        outcome.failed < 0 ||
        outcome.succeeded + outcome.failed !== expectedCount ||
        outcome.results.length !== expectedCount
      )
        throw new Error(
          "تعذّر تأكيد نتيجة الحفظ. حدّث النطاقات قبل إعادة المحاولة.",
        );
      confirmed = outcome.succeeded;
      await Promise.all(
        ["customization_fields", "story_goals"].map((resource) =>
          invalidate({
            resource,
            dataProviderName: CATALOG_SETTINGS_PROVIDER,
            invalidates: ["list", "many", "detail"],
          }),
        ),
      );
      const actual = await refetch();
      const actualValues = {
        fields: selectedProductIds(actual.fields, productId),
        goals: selectedProductIds(actual.goals, productId),
      };
      setScopeSnapshot(actual);
      const failed = outcome.failed;
      if (failed) {
        const requested = form.state.values;
        const previousBaseline = baseline.defaultValues;
        const mergedFields = mergeSelectionIntent(
          actualValues.fields,
          previousBaseline.fields,
          requested.fields,
          actual.fields
            .filter((item) => item.applies_to !== null)
            .map((item) => item.id),
        );
        const mergedGoals = mergeSelectionIntent(
          actualValues.goals,
          previousBaseline.goals,
          requested.goals,
          actual.goals
            .filter((item) => item.applies_to !== null)
            .map((item) => item.id),
        );
        baseline.reset(form, actualValues);
        form.setFieldValue("fields", mergedFields.selected);
        form.setFieldValue("goals", mergedGoals.selected);
        setRefreshNeeded(false);
        const unavailable = [
          ...mergedFields.unavailable,
          ...mergedGoals.unavailable,
        ];
        setFeedback({
          kind: "warning",
          text: `تم تأكيد ${outcome.succeeded} تغييرًا وتعذّر تأكيد ${failed}. بقيت تغييراتك الصريحة${unavailable.length ? ` باستثناء تعريفات لم تعد متاحة: ${unavailable.join("، ")}` : ""}؛ أعد المحاولة لحفظ المتبقي.`,
        });
      } else {
        baseline.reset(form, actualValues);
        setFeedback({ kind: "success", text: "تم حفظ خيارات التخصيص." });
      }
    } catch (error) {
      setRefreshNeeded(true);
      setFeedback({
        kind: "error",
        text:
          confirmed !== undefined
            ? `تم تأكيد ${confirmed} تغييرًا، لكن تعذّر تحديث النطاقات المعروضة. احتفظنا باختياراتك؛ حدّث البيانات لمراجعة ما حُفظ قبل إعادة المحاولة.`
            : error instanceof Error
              ? error.message
              : "تعذّر تأكيد الحفظ. حدّث البيانات وراجع الاختيارات قبل إعادة المحاولة.",
      });
    }
  }

  const inheritedFields = fields.filter((item) => item.applies_to === null);
  const inheritedGoals = goals.filter((item) => item.applies_to === null);
  return (
    <form.AppForm>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (canSave) void form.handleSubmit();
        }}
      >
        <div
          className="flex flex-col gap-5"
          aria-labelledby="product-personalization-title"
        >
          <div>
            <h2
              id="product-personalization-title"
              className="text-base font-semibold"
            >
              خيارات التخصيص
            </h2>
            <p className="text-sm text-muted-foreground">
              اختر التعريفات المخصصة لهذا المنتج. الخيارات العامة موروثة وتُدار
              من إعدادات الكتالوج.
            </p>
            {disabled ? (
              <p className="text-sm text-muted-foreground">
                احفظ التغييرات الحالية في بيانات المنتج قبل تعديل خيارات
                التخصيص.
              </p>
            ) : null}
          </div>
          <ResourceFormDirtyGuard />
          {!readReady ? (
            <Alert variant={readError ? "destructive" : "default"}>
              <AlertTitle>
                {readError
                  ? "الاختيارات الحالية غير مكتملة"
                  : "جارٍ تحديث التعريفات"}
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                {readError
                  ? "تعذّر تحديث جميع التعريفات. احتفظنا بتغييراتك، والحفظ متوقف حتى تكتمل القراءة."
                  : "الحفظ متوقف مؤقتًا حتى يكتمل التحقق من البيانات."}
                {readError ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || disabled}
                    onClick={() => void refreshAndReconcile()}
                  >
                    إعادة المحاولة ومراجعة البيانات
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {inheritedFields.length || inheritedGoals.length ? (
            <div className="rounded-lg border p-3">
              <p className="font-medium">موروث من النطاق العام</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {inheritedFields.map((item) => (
                  <li key={`field-${item.id}`}>
                    <Badge variant="secondary" className="text-sm">
                      <bdi>{item.label}</bdi> · خانة{" "}
                      {item.is_active ? "نشطة" : "غير نشطة"}
                    </Badge>
                  </li>
                ))}
                {inheritedGoals.map((item) => (
                  <li key={`goal-${item.id}`}>
                    <Badge variant="secondary" className="text-sm">
                      <bdi>{item.label}</bdi> · هدف{" "}
                      {item.is_active ? "نشط" : "غير نشط"}
                    </Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <Link
                  to="/catalog/settings/customization-fields"
                  className="text-primary underline"
                >
                  إدارة الخانات العامة
                </Link>
                <Link
                  to="/catalog/settings/story-goals"
                  className="text-primary underline"
                >
                  إدارة الأهداف العامة
                </Link>
              </div>
            </div>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="personalization-fields">
                خانات التخصيص
              </FieldLabel>
              <FieldDescription id="personalization-fields-help">
                الخانات غير النشطة تظل محددة ومحفوظة دون ظهورها للعملاء.
              </FieldDescription>
              <form.AppField name="fields">
                {(field) => (
                  <TagsSelect
                    id="personalization-fields"
                    options={definitionOptions(fields)}
                    value={field.state.value}
                    disabled={disabled || !readReady || pending}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    maxVisibleTags={8}
                    aria-describedby="personalization-fields-help"
                    triggerAriaLabel="اختيار خانات التخصيص"
                  />
                )}
              </form.AppField>
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لا توجد خانات تخصيص بعد.{" "}
                  <Link
                    to="/catalog/settings/customization-fields"
                    className="text-primary underline"
                  >
                    أضف خانة من إعدادات الكتالوج
                  </Link>
                </p>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="personalization-goals">
                أهداف القصة
              </FieldLabel>
              <FieldDescription id="personalization-goals-help">
                الأهداف غير النشطة تظل محددة ومحفوظة دون ظهورها للعملاء.
              </FieldDescription>
              <form.AppField name="goals">
                {(field) => (
                  <TagsSelect
                    id="personalization-goals"
                    options={definitionOptions(goals)}
                    value={field.state.value}
                    disabled={disabled || !readReady || pending}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    maxVisibleTags={8}
                    aria-describedby="personalization-goals-help"
                    triggerAriaLabel="اختيار أهداف القصة"
                  />
                )}
              </form.AppField>
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  لا توجد أهداف قصة بعد.{" "}
                  <Link
                    to="/catalog/settings/story-goals"
                    className="text-primary underline"
                  >
                    أضف هدفًا من إعدادات الكتالوج
                  </Link>
                </p>
              ) : null}
            </Field>
          </FieldGroup>
          {feedback ? (
            <Alert
              variant={feedback.kind === "success" ? "default" : "destructive"}
            >
              <AlertTitle>
                {feedback.kind === "success"
                  ? "تم"
                  : feedback.kind === "warning"
                    ? "حفظ جزئي"
                    : "تعذّر الحفظ"}
              </AlertTitle>
              <AlertDescription>{feedback.text}</AlertDescription>
            </Alert>
          ) : null}
          {refreshNeeded ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending || disabled}
              onClick={() => void refreshAndReconcile()}
            >
              تحديث ومطابقة الاختيارات مع البيانات الحالية
            </Button>
          ) : null}
          <Button type="submit" disabled={!canSave}>
            {pending ? "جارٍ الحفظ…" : "حفظ خيارات التخصيص"}
          </Button>
        </div>
      </form>
    </form.AppForm>
  );
}
