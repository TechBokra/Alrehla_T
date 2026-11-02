import { useMemo } from "react";
import { z } from "zod";
import { createCloudinaryUploadAdapter } from "@/components/upload/cloudinary";
import { mediaRequest } from "@/providers/refine/data-provider/media-library-data-provider";

const MEDIA_PRESET = "alrehla_media_library";
const MEDIA_FORMATS = "jpg,jpeg,png,webp,avif";

const signatureSchema = z.object({
  apiKey: z.string(),
  signature: z.string(),
  timestamp: z.number(),
});

/** Signed Cloudinary adapter for files stored through the media-library backend. */
export function useLibraryUploadAdapter(folder: string) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  return useMemo(
    () =>
      cloudName
        ? createCloudinaryUploadAdapter({
            cloudName,
            folder,
            resourceType: "image",
            params: {
              upload_preset: MEDIA_PRESET,
              allowed_formats: MEDIA_FORMATS,
              overwrite: "false",
              type: "upload",
            },
            sign: async (params, item) =>
              signatureSchema.parse(
                await mediaRequest({
                  action: "sign",
                  params,
                  file: { name: item.name, size: item.size, type: item.type },
                }),
              ),
          })
        : undefined,
    [cloudName, folder],
  );
}
