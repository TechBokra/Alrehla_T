import type {
  AuthProvider,
  BaseRecord,
  CreateParams,
  CreateResponse,
  DataProvider,
  DeleteOneParams,
  DeleteOneResponse,
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  RouterProvider,
  UpdateParams,
  UpdateResponse,
} from "@refinedev/core";
import type React from "react";

export type DemoProduct = {
  id: string;
  title: string;
  sku: string;
  status: "Active" | "Draft";
  inventory: number;
  price: number;
};

let demoProducts: DemoProduct[] = [
  {
    id: "prd-104",
    title: "حقيبة قماش يومية",
    sku: "BAG-104",
    status: "Active",
    inventory: 128,
    price: 34,
  },
  {
    id: "prd-103",
    title: "كوب سيراميك يومي",
    sku: "HOME-103",
    status: "Active",
    inventory: 76,
    price: 22,
  },
  {
    id: "prd-102",
    title: "طقم ملابس منزلي ناعم",
    sku: "APP-102",
    status: "Draft",
    inventory: 0,
    price: 86,
  },
  {
    id: "prd-101",
    title: "شمعة عطرية برائحة الأرز",
    sku: "HOME-101",
    status: "Active",
    inventory: 42,
    price: 28,
  },
  {
    id: "prd-100",
    title: "حقيبة سفر قماشية",
    sku: "BAG-100",
    status: "Active",
    inventory: 19,
    price: 112,
  },
];

export function getDemoProducts(): DemoProduct[] {
  return demoProducts.map((product) => ({ ...product }));
}

export const previewDataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const pageSize = params.pagination?.pageSize ?? demoProducts.length;
    const currentPage = params.pagination?.currentPage ?? 1;
    const start = (currentPage - 1) * pageSize;

    return {
      data: demoProducts.slice(start, start + pageSize) as unknown as TData[],
      total: demoProducts.length,
    };
  },
  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => ({
    data: (demoProducts.find((product) => product.id === String(params.id)) ??
      demoProducts[0]) as unknown as TData,
  }),
  create: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const variables = params.variables as Record<string, unknown>;
    const record = {
      id: `prd-${Date.now()}`,
      title: String(variables.title ?? "منتج تجريبي"),
      sku: String(variables.sku ?? "PREVIEW-001"),
      status: "Draft" as const,
      inventory: Number(variables.inventory ?? 0),
      price: Number(variables.price ?? 0),
    };
    demoProducts = [record, ...demoProducts];
    return { data: record as unknown as TData };
  },
  update: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const variables = params.variables as Record<string, unknown>;
    const current = demoProducts.find(
      (product) => product.id === String(params.id),
    );
    const record = {
      ...(current ?? demoProducts[0]),
      ...variables,
      id: String(params.id),
    } as DemoProduct;
    demoProducts = demoProducts.map((product) =>
      product.id === record.id ? record : product,
    );
    return { data: record as unknown as TData };
  },
  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = {}>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    const removed = demoProducts.find(
      (product) => product.id === String(params.id),
    );
    demoProducts = demoProducts.filter(
      (product) => product.id !== String(params.id),
    );
    return {
      data: (removed ?? { id: String(params.id) }) as unknown as TData,
    };
  },
  getApiUrl: () => "local-preview://refine-data-provider",
};

export const previewAuthProvider: AuthProvider = {
  login: async () => ({ success: true }),
  logout: async () => ({ success: true }),
  check: async () => ({ authenticated: true }),
  onError: async () => ({}),
  register: async () => ({ success: true }),
  getIdentity: async () => ({
    id: "preview-admin",
    name: "مشرف تجريبي",
    email: "admin@example.test",
  }),
};

const PreviewLink: NonNullable<RouterProvider["Link"]> = ({
  to,
  children,
  ...props
}) => {
  const onClick = props.onClick as
    | React.MouseEventHandler<HTMLAnchorElement>
    | undefined;

  return (
    <a
      href={to || "#"}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
};

export const previewRouterProvider: RouterProvider = {
  go: () => (config) => config.to ?? "/",
  back: () => () => undefined,
  parse: () => () => ({
    pathname: "/",
    resource: { name: "products", list: "/" },
    action: "list",
    id: "prd-104",
    params: {},
  }),
  Link: PreviewLink,
};
