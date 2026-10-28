import {
  cloudinaryAdapter,
  type CloudinaryAdapterOptions,
  type CloudinarySignature,
  type CloudinaryUploadResult,
} from "@uploadcn/core";
import { z } from "zod";

export type { CloudinaryUploadResult };
export type CloudinaryImageValue = CloudinaryUploadResult | string | null;

/** Admin media requires a server-authorized signature; no unsigned fallback. */
export function createCloudinaryUploadAdapter(
  options: Omit<CloudinaryAdapterOptions, "sign" | "uploadPreset"> & {
    sign: NonNullable<CloudinaryAdapterOptions["sign"]>;
  },
) {
  if (!options.cloudName.trim())
    throw new Error("Cloudinary cloud name is required.");
  return cloudinaryAdapter(options);
}

const signatureSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.union([z.number().positive(), z.string().regex(/^\d+$/)]),
  apiKey: z.string().min(1),
});

/** The authenticated server must authorize/allowlist parameters before signing. */
export function createCloudinarySigner({
  endpoint,
  getAccessToken,
}: {
  endpoint: string;
  getAccessToken: () => Promise<string | null>;
}): NonNullable<CloudinaryAdapterOptions["sign"]> {
  return async (params, item): Promise<CloudinarySignature> => {
    const token = await getAccessToken();
    if (!token) throw new Error("سجّل الدخول قبل رفع الملفات.");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        params,
        file: { name: item.name, size: item.size, type: item.type },
      }),
    });
    if (!response.ok) throw new Error("تعذر السماح برفع الملف. حاول مرة أخرى.");
    return signatureSchema.parse(await response.json());
  };
}
