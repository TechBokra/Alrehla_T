import { z } from "zod";
import { emailSchema, optionalHttpUrlSchema, textSchema } from "@/lib/schema/common";

export const siteIdentityContactSchema = z.object({
  siteName: textSchema.max(120, "اسم الموقع بحد أقصى ١٢٠ حرفًا"),
  contactEmail: z.union([
    z.literal(""),
    emailSchema.max(254, "البريد الإلكتروني طويل جدًا"),
  ]),
  contactPhone: textSchema.max(40, "رقم الهاتف طويل جدًا"),
  whatsappNumber: textSchema.max(40, "رقم الواتساب طويل جدًا"),
  workingHours: textSchema.max(160, "مواعيد العمل بحد أقصى ١٦٠ حرفًا"),
  address: textSchema.max(240, "العنوان بحد أقصى ٢٤٠ حرفًا"),
  facebookUrl: optionalHttpUrlSchema,
  instagramUrl: optionalHttpUrlSchema,
});

export type SiteIdentityContactValues = z.infer<typeof siteIdentityContactSchema>;

export interface SiteIdentityContactRecord {
  id: string;
  key: string;
  siteName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  whatsappNumber: string | null;
  workingHours: string | null;
  address: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
}

export function siteIdentityContactValues(
  record?: Partial<SiteIdentityContactRecord>,
): SiteIdentityContactValues {
  return {
    siteName: record?.siteName ?? "",
    contactEmail: record?.contactEmail ?? "",
    contactPhone: record?.contactPhone ?? "",
    whatsappNumber: record?.whatsappNumber ?? "",
    workingHours: record?.workingHours ?? "",
    address: record?.address ?? "",
    facebookUrl: record?.facebookUrl ?? "",
    instagramUrl: record?.instagramUrl ?? "",
  };
}

export function siteIdentityContactQuery({
  enabled,
  authVersion,
  profileId,
}: {
  enabled: boolean;
  authVersion: number;
  profileId?: string;
}) {
  return {
    resource: "site_settings",
    id: "general",
    dataProviderName: "siteSettings",
    meta: {
      idColumnName: "key",
      authVersion,
      identity: profileId,
      select:
        "id,key,siteName:value->>siteName,contactEmail:value->>contactEmail,contactPhone:value->>contactPhone,whatsappNumber:value->>whatsappNumber,workingHours:value->>workingHours,address:value->>address,facebookUrl:value->>facebookUrl,instagramUrl:value->>instagramUrl",
    },
    queryOptions: {
      enabled,
      staleTime: 0,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: "always" as const,
    },
    errorNotification: false as const,
  };
}
