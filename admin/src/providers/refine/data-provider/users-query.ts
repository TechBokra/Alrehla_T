import type { CrudFilter } from "@refinedev/core";

type UserListQuery = {
  filters?: CrudFilter[];
  sorters?: { field: string; order: "asc" | "desc" }[];
  pagination?: { currentPage?: number; pageSize?: number };
};

const sortableFields = new Set(["full_name", "email", "role", "is_guardian"]);

function scalar(value: unknown): unknown {
  if (value && typeof value === "object" && "value" in value) {
    return (value as { value?: unknown }).value;
  }
  return value;
}

function filterValue(filters: CrudFilter[] | undefined, field: string) {
  const filter = filters?.find((item) => "field" in item && item.field === field);
  return filter && "field" in filter ? scalar(filter.value) : undefined;
}

export function buildUserListRequest(query: UserListQuery = {}) {
  const searchFilter = query.filters?.find(
    (filter) => !("field" in filter) && filter.key === "__data_table_search",
  );
  const rawSearch =
    searchFilter && !("field" in searchFilter)
      ? searchFilter.value
      : undefined;
  const searchValue = Array.isArray(rawSearch)
    ? rawSearch[0]?.value
    : rawSearch;
  const search =
    typeof searchValue === "string"
      ? searchValue.replace(/\\(["\\])/g, "$1").slice(0, 120)
      : "";
  const roleValue = filterValue(query.filters, "role");
  const guardianValue = filterValue(query.filters, "is_guardian");
  const statusValue = filterValue(query.filters, "status");
  const requestedSort = query.sorters?.[0];
  const sort = requestedSort && sortableFields.has(requestedSort.field)
    ? requestedSort.field
    : "created_at";
  const currentPage = Math.max(1, Math.floor(query.pagination?.currentPage ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(query.pagination?.pageSize ?? 20)));

  return {
    action: "list",
    search,
    role: typeof roleValue === "string" && roleValue ? roleValue : null,
    guardian:
      guardianValue === true || guardianValue === "true"
        ? true
        : guardianValue === false || guardianValue === "false"
          ? false
          : null,
    status:
      typeof statusValue === "string" && statusValue ? statusValue : "not_archived",
    sort,
    order: requestedSort?.order === "asc" ? "asc" : "desc",
    offset: (currentPage - 1) * limit,
    limit,
  };
}
