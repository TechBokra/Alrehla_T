import type {
  CreateManyParams,
  CreateParams,
  DataProvider,
  DeleteManyParams,
  DeleteOneParams,
  GetListParams,
  GetManyParams,
  GetOneParams,
  UpdateManyParams,
  UpdateParams,
} from "@refinedev/core";

export type PrototypeProduct = {
  id: string;
  title: string;
  sku: string;
  price: number;
  inventory: number;
  status: "draft" | "active";
};

export type ProviderEvent = {
  operation: "getOne" | "create" | "update";
  resource: "products";
  id?: string;
  variables?: unknown;
  response?: unknown;
  error?: string;
  at: string;
};

const seedProducts: PrototypeProduct[] = [
  {
    id: "demo-204",
    title: "حقيبة قماش يومية",
    sku: "BAG-204",
    price: 34,
    inventory: 128,
    status: "active",
  },
  {
    id: "demo-203",
    title: "كوب سيراميك يومي",
    sku: "HOME-203",
    price: 22,
    inventory: 76,
    status: "draft",
  },
];

export function createPrototypeDataProvider({
  publish,
  shouldFail,
}: {
  publish: (event: ProviderEvent) => void;
  shouldFail: () => boolean;
}): DataProvider {
  const products = seedProducts.map((product) => ({ ...product }));

  async function pause() {
    await new Promise((resolve) => window.setTimeout(resolve, 450));
  }

  return {
    getList: async (_params: GetListParams) => ({
      data: products as any[],
      total: products.length,
    }),
    getOne: async ({ id }: GetOneParams) => {
      const record = products.find((product) => product.id === String(id));
      if (!record)
        throw new Error(`لم يتم العثور على منتج تجريبي بالمعرّف ${String(id)}.`);
      publish({
        operation: "getOne",
        resource: "products",
        id: record.id,
        response: record,
        at: new Date().toISOString(),
      });
      return { data: { ...record } as any };
    },
    create: async ({ variables }: CreateParams<any>) => {
      const submitted = variables as Omit<PrototypeProduct, "id">;
      const event: ProviderEvent = {
        operation: "create",
        resource: "products",
        variables: submitted,
        at: new Date().toISOString(),
      };
      publish(event);
      await pause();
      if (shouldFail()) {
        event.error =
          "فشل تجريبي في مصدر البيانات. ما زالت قيم النموذج متاحة.";
        publish({ ...event });
        throw new Error(event.error);
      }
      const record: PrototypeProduct = {
        ...submitted,
        id: `demo-${Date.now()}`,
      };
      products.unshift(record);
      event.response = { data: record };
      publish({ ...event });
      return { data: record as any };
    },
    update: async ({ id, variables }: UpdateParams<any>) => {
      const submitted = variables as Partial<Omit<PrototypeProduct, "id">>;
      const event: ProviderEvent = {
        operation: "update",
        resource: "products",
        id: String(id),
        variables: submitted,
        at: new Date().toISOString(),
      };
      publish(event);
      await pause();
      if (shouldFail()) {
        event.error =
          "فشل تجريبي في مصدر البيانات. ما زالت قيم النموذج متاحة.";
        publish({ ...event });
        throw new Error(event.error);
      }
      const index = products.findIndex((product) => product.id === String(id));
      if (index < 0)
        throw new Error(`لم يتم العثور على منتج تجريبي بالمعرّف ${String(id)}.`);
      const record = { ...products[index]!, ...submitted, id: String(id) };
      products[index] = record;
      event.response = { data: record };
      publish({ ...event });
      return { data: record as any };
    },
    deleteOne: async ({ id }: DeleteOneParams<any>) => ({
      data: { id: String(id) } as any,
    }),
    getMany: async ({ ids }: GetManyParams) => ({
      data: products.filter((product) =>
        ids.some((id) => String(id) === product.id)
      ) as any[],
    }),
    createMany: async ({ variables }: CreateManyParams<any>) => ({
      data: variables as any[],
    }),
    updateMany: async ({ ids, variables }: UpdateManyParams<any>) => ({
      data: ids.map((id) => ({
        ...(variables as object),
        id: String(id),
      })) as any[],
    }),
    deleteMany: async ({ ids }: DeleteManyParams<any>) => ({
      data: ids.map((id) => ({ id: String(id) })) as any[],
    }),
    getApiUrl: () => "prototype://local-memory/products",
  };
}
