import { useCallback, useMemo, useState } from "react";
import { useUploader, useUploadSelector } from "@uploadcn/react";
import type { CloudinaryUploadResult, UploadAdapter } from "@uploadcn/core";
import { useInvalidate } from "@refinedev/core";
import { useLibraryUploadAdapter } from "@/hooks/uploads";
import type { ResourceUploadDefinition, ResourceUploadHandle } from "@/hooks/uploads";
import { useResourceAuthorization } from "@/hooks/resources/authorization";
import { assertResourceAccess } from "@/providers/refine/access-control-provider";
import {
  getPendingCloudinaryUploadIds,
  resolveCloudinaryUploads,
} from "@/hooks/uploads/resource-upload-utils";

const unavailableAdapter: UploadAdapter<CloudinaryUploadResult> = {
  name: "cloudinary-unconfigured",
  async upload() {
    throw new Error("إعداد Cloudinary غير مكتمل.");
  },
};

export function useResourceUploadSlot(
  definition: ResourceUploadDefinition,
): ResourceUploadHandle {
  const invalidate = useInvalidate();
  const [uploadingIds, setUploadingIds] = useState<ReadonlySet<string>>(() => new Set());
  const adapter = useLibraryUploadAdapter(definition.folder);
  const access = useResourceAuthorization("uploads", "upload");
  const uploader = useUploader<CloudinaryUploadResult>({
    adapter: adapter ?? unavailableAdapter,
    autoUpload: false,
    accept: definition.accept,
    maxSize: definition.maxSize,
    maxFiles: definition.maxFiles,
    retry: false,
  });
  const items = useUploadSelector(uploader, (state) => state.items);
  const failed = items.some((item) =>
    ["error", "rejected", "cancelled"].includes(item.status) ||
    (item.status === "success" && !item.result?.secure_url),
  );
  const uploading = uploadingIds.size > 0;

  const resolve = useCallback(
    async (ids: readonly string[]) => {
      if (!ids.length) return [];
      await assertResourceAccess("uploads", "upload");
      if (!adapter) throw new Error("إعداد رفع الصور غير مكتمل.");
      const pendingIds = getPendingCloudinaryUploadIds(uploader, ids);
      if (pendingIds.length === 0) return resolveCloudinaryUploads(uploader, ids);

      setUploadingIds(new Set(pendingIds));
      let result: CloudinaryUploadResult[];
      try {
        result = await resolveCloudinaryUploads(uploader, ids);
      } finally {
        setUploadingIds(new Set());
      }
      // UploadCN sends files directly to Cloudinary, outside Refine mutations.
      // Refresh the cached library so the new asset is immediately selectable.
      await invalidate({
        resource: "uploads",
        dataProviderName: "mediaLibrary",
        invalidates: ["list", "many"],
      });
      return result;
    },
    [adapter, uploader, invalidate],
  );

  return useMemo(
    () => ({
      adapter,
      uploader,
      items,
      allowed: access.allowed,
      accessPending: access.isPending,
      failed,
      uploading,
      uploadingIds,
      resolve,
      clearCompleted: () => uploader.clearCompleted(),
    }),
    [adapter, uploader, items, access.allowed, access.isPending, failed, uploading, uploadingIds, resolve],
  );
}
