import { z } from "zod";

export const MEDIA_PROVIDER = "mediaLibrary";
export const MEDIA_RESOURCE = "uploads";
export const MEDIA_PRESET = "alrehla_media_library";
export const MEDIA_FORMATS = "jpg,jpeg,png,webp,avif";
export const uploadFolders = [
  "alrehla/uploads",
  "alrehla/products",
  "alrehla/addons",
  "alrehla/site",
  "alrehla/blog",
  "alrehla/avatars",
] as const;
export const assetSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  url: z.string().url(),
  caption: z.string(),
  alt: z.string(),
  tags: z.array(z.string()),
  format: z.string(),
  bytes: z.number(),
  width: z.number(),
  height: z.number(),
  createdAt: z.string(),
});
export type MediaAsset = z.infer<typeof assetSchema>;
export const mediaPageSchema = z.object({
  data: z.array(assetSchema),
  total: z.number(),
  nextCursor: z.string().optional(),
});
export type MediaPage = z.infer<typeof mediaPageSchema>;
export const assetEditSchema = z.object({
  caption: z.string().trim().max(200, "الحد الأقصى ٢٠٠ حرف"),
  alt: z.string().trim().max(500, "الحد الأقصى ٥٠٠ حرف"),
  tags: z
    .string()
    .max(500, "الحد الأقصى ٥٠٠ حرف")
    .refine(
      (value) =>
        value.split(",").filter((v) => v.trim()).length <= 20 &&
        value
          .split(",")
          .every((v) => v.trim().length <= 50 && !/[|=\\]/.test(v)),
      "حتى ٢٠ وسمًا، كل وسم حتى ٥٠ حرفًا ومن دون | أو = أو شرطة مائلة عكسية",
    ),
});
