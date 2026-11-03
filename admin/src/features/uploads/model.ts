import { z } from "zod";

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
