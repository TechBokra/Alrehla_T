import { useMemo } from "react";
import { createCloudinaryUploadAdapter } from "@/components/upload/cloudinary";
import { mediaRequest } from "@/providers/refine/data-provider/media-library-data-provider";
import { MEDIA_FORMATS, MEDIA_PRESET } from "./model";
import { z } from "zod";
const signature = z.object({
  apiKey: z.string(),
  signature: z.string(),
  timestamp: z.number(),
});
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
              signature.parse(
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
