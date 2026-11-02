import type { CloudinaryUploadResult, Uploader } from "@uploadcn/core";
import type { ImageUploadSelection } from "./types";

const terminalFailure = new Set(["error", "rejected", "cancelled"]);
const terminal = new Set(["success", ...terminalFailure]);

/** Files that will actually start uploading when the save handler resolves them. */
export function getPendingCloudinaryUploadIds(
  uploader: Uploader<CloudinaryUploadResult>,
  ids: readonly string[],
): string[] {
  const uniqueIds = [...new Set(ids)];
  const items = uniqueIds.map((id) => uploader.getItem(id));
  if (items.some((item) => !item)) {
    throw new Error("الملف المحدد لم يعد موجودًا في قائمة الرفع.");
  }
  return items
    .filter((item) => item && !terminal.has(item.status))
    .map((item) => item!.id);
}

/** Starts only the selected files and waits for every one to finish. */
export async function resolveCloudinaryUploads(
  uploader: Uploader<CloudinaryUploadResult>,
  ids: readonly string[],
): Promise<CloudinaryUploadResult[]> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];

  const inspect = () => uniqueIds.map((id) => uploader.getItem(id));
  const toStart = getPendingCloudinaryUploadIds(uploader, uniqueIds);
  if (toStart.length) {
    await new Promise<void>((resolve, reject) => {
      let unsubscribe = () => {};
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        unsubscribe();
        if (error) reject(error);
        else resolve();
      };
      const check = () => {
        const items = inspect();
        if (items.some((item) => !item)) {
          finish(new Error("الملف المحدد لم يعد موجودًا في قائمة الرفع."));
          return;
        }
        if (items.every((item) => terminal.has(item!.status))) finish();
      };
      unsubscribe = uploader.subscribe(check);
      try {
        uploader.start(toStart);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("تعذّر بدء رفع الصورة."));
        return;
      }
      check();
    });
  }

  const results = inspect();
  const failed = results.find((item) => !item || terminalFailure.has(item.status));
  if (failed) {
    throw new Error(
      failed?.issues[0]?.message || "تعذّر رفع صورة. أزل الملف الفاشل ثم اختره مجددًا.",
    );
  }
  const uploaded = results.map((item) => item?.result);
  if (uploaded.some((result) => !result?.secure_url)) {
    throw new Error("لم يرجع رفع الصورة رابطًا صالحًا.");
  }
  return uploaded as CloudinaryUploadResult[];
}

export async function resolveImageSelectionUrls(
  resolve: (ids: readonly string[]) => Promise<CloudinaryUploadResult[]>,
  images: readonly ImageUploadSelection[],
): Promise<string[]> {
  const queued = images.filter(
    (image): image is Extract<ImageUploadSelection, { kind: "queued" }> =>
      image.kind === "queued",
  );
  const uploadIds = [...new Set(queued.map((image) => image.uploadId))];
  const results = await resolve(uploadIds);
  const urlsById = new Map(
    uploadIds.map((id, index) => [id, results[index].secure_url]),
  );
  return images.map((image) =>
    image.kind === "saved" ? image.url : urlsById.get(image.uploadId)!,
  );
}
