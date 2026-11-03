export type ScopeDefinition = {
  id: string;
  applies_to: string[] | null;
  updated_at: string;
  label: string;
  is_active: boolean;
  sort_order: number | null;
};

export type ScopeChange = {
  id: string;
  expectedUpdatedAt: string;
  expectedAppliesTo: string[];
  appliesTo: string[];
};

/** Null means global inheritance. Empty arrays are invalid and never mean global. */
export function selectedProductIds(
  definitions: ScopeDefinition[],
  productId: string,
) {
  return definitions
    .filter(
      (item) => item.applies_to !== null && item.applies_to.includes(productId),
    )
    .map((item) => item.id);
}

export function mergeSelectionIntent(
  serverSelected: string[],
  baselineSelected: string[],
  requestedSelected: string[],
  availableIds: Iterable<string>,
) {
  const server = new Set(serverSelected);
  const baseline = new Set(baselineSelected);
  const requested = new Set(requestedSelected);
  const available = new Set(availableIds);
  const touched = new Set([...baseline, ...requested]);
  const unavailable: string[] = [];
  for (const id of touched) {
    if (baseline.has(id) === requested.has(id)) continue;
    if (requested.has(id) && !available.has(id)) {
      unavailable.push(id);
      continue;
    }
    if (requested.has(id)) server.add(id);
    else server.delete(id);
  }
  return { selected: [...server], unavailable };
}

export function planProductScopeChanges(
  definitions: ScopeDefinition[],
  productId: string,
  selected: Iterable<string>,
): ScopeChange[] {
  const desired = new Set(selected);
  if (desired.size > 100) throw new Error("يمكن اختيار ١٠٠ تعريف كحد أقصى.");
  const known = new Set(
    definitions
      .filter((item) => item.applies_to !== null)
      .map((item) => item.id),
  );
  if ([...desired].some((id) => !known.has(id)))
    throw new Error(
      "تحتوي الاختيارات على تعريف غير معروف أو موروث. حدّث البيانات وراجعها قبل الحفظ.",
    );
  return definitions.flatMap((definition) => {
    const scope = definition.applies_to;
    if (scope === null) return [];
    const hasProduct = scope.includes(productId);
    const wantsProduct = desired.has(definition.id);
    if (hasProduct === wantsProduct) return [];
    const appliesTo = wantsProduct
      ? [...scope, productId]
      : scope.filter((id) => id !== productId);
    if (appliesTo.length === 0)
      throw new Error(
        `لا يمكن إزالة «${definition.label}» لأنها مخصصة لهذا المنتج وحده. غيّر نطاقها من إعدادات الكتالوج أولًا.`,
      );
    if (appliesTo.length > 100)
      throw new Error("بلغ نطاق أحد التعريفات الحد الأقصى وهو ١٠٠ هدف.");
    return [
      {
        id: definition.id,
        expectedUpdatedAt: definition.updated_at,
        expectedAppliesTo: [...scope],
        appliesTo,
      },
    ];
  });
}

export function scopeAppliesToProduct(
  definition: ScopeDefinition,
  productId: string,
) {
  return (
    definition.applies_to === null || definition.applies_to.includes(productId)
  );
}

export function sortScopeDefinitions<
  T extends { sort_order: number | null; id: string },
>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
  );
}
