import { useState } from "react";
import { useDelete, useInvalidate, useList, useUpdate } from "@refinedev/core";
import {
  Copy,
  ImagePlus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Images,
} from "lucide-react";
import { toast } from "sonner";
import { useAppForm } from "@/lib/form";
import { useAdminIdentity } from "@/features/auth/identity-provider";
import type { CloudinaryUploadResult, UploadAdapter } from "@uploadcn/core";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ImageUpload } from "@/components/upload/image-upload";
import { AvatarUpload } from "@/components/upload/avatar-upload";
import { LogoUpload } from "@/components/upload/logo-upload";
import { ProductMediaUpload } from "@/components/upload/product-media-upload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import {
  assetEditSchema,
  MEDIA_PROVIDER,
  MEDIA_RESOURCE,
  uploadFolders,
  type MediaAsset,
  type MediaPage,
} from "./model";
import { useLibraryUploadAdapter } from "./use-upload-adapter";

const number = new Intl.NumberFormat("ar-EG");
const bytes = (value: number) =>
  value >= 1024 * 1024
    ? `${number.format(Math.round((value / 1024 / 1024) * 10) / 10)} م.ب`
    : `${number.format(Math.ceil(value / 1024))} ك.ب`;

export function UploadsPage() {
  const identity = useAdminIdentity();
  const [folder, setFolder] = useState("all");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("desc");
  const [cursors, setCursors] = useState<string[]>([""]);
  const [page, setPage] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [preview, setPreview] = useState<MediaAsset>();
  const [edit, setEdit] = useState<MediaAsset>();
  const [deleting, setDeleting] = useState<MediaAsset>();
  const [deleteError, setDeleteError] = useState("");
  const invalidate = useInvalidate();
  const { mutate: remove, mutation: deletion } = useDelete();
  const { query } = useList<MediaAsset>({
    resource: MEDIA_RESOURCE,
    dataProviderName: MEDIA_PROVIDER,
    pagination: { mode: "off" },
    sorters: [{ field: "createdAt", order: sort }],
    meta: {
      folder: folder === "all" ? "" : folder,
      search,
      cursor: cursors[page],
      identity: identity.data?.id,
    },
    queryOptions: {
      enabled: Boolean(identity.data?.id),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });
  const result = query.data as MediaPage | undefined;
  const reset = () => {
    setPage(0);
    setCursors([""]);
  };
  const refresh = async () => {
    await invalidate({
      resource: MEDIA_RESOURCE,
      dataProviderName: MEDIA_PROVIDER,
      invalidates: ["list"],
    });
  };
  return (
    <section className="flex flex-col gap-6" aria-labelledby="uploads-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 id="uploads-title" className="text-2xl font-semibold">
            مكتبة المرفوعات
          </h1>
          <p className="text-sm text-muted-foreground">
            صور Cloudinary العامة: رفع، معاينة، تعديل البيانات وحذف الصور غير
            المستخدمة.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            aria-label="تحديث المكتبة"
          >
            <RefreshCw data-icon="inline-start" />
            تحديث
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <ImagePlus data-icon="inline-start" />
            رفع صور
          </Button>
        </div>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(draft.trim());
          reset();
        }}
      >
        <FieldGroup className="grid gap-3 md:grid-cols-[1fr_14rem_12rem_auto]">
          <Field>
            <FieldLabel htmlFor="media-search">البحث</FieldLabel>
            <Input
              id="media-search"
              placeholder="ابحث عن ملف أو وسم"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="media-folder">المجلد</FieldLabel>
            <Select
              value={folder}
              onValueChange={(value) => {
                setFolder(value);
                reset();
              }}
            >
              <SelectTrigger id="media-folder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">كل المجلدات</SelectItem>
                  {uploadFolders.map((value) => (
                    <SelectItem key={value} value={value}>
                      <span dir="ltr">{value}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="media-sort">الترتيب</FieldLabel>
            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(value as "asc" | "desc");
                reset();
              }}
            >
              <SelectTrigger id="media-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="desc">الأحدث أولًا</SelectItem>
                  <SelectItem value="asc">الأقدم أولًا</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" className="self-end">
            <Search data-icon="inline-start" />
            بحث
          </Button>
        </FieldGroup>
      </form>
      {query.isError && (
        <Alert variant="destructive">
          <AlertTitle>تعذر تحميل المكتبة</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
          <Button variant="outline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </Button>
        </Alert>
      )}
      {identity.isLoading || query.isLoading ? (
        <div
          role="status"
          aria-label="جارٍ تحميل الصور"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      ) : result?.data.length === 0 ? (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>لا توجد صور مطابقة</EmptyTitle>
            <EmptyDescription>
              غيّر البحث أو ارفع صورًا جديدة للمكتبة.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              رفع صور
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        result && (
          <>
            <p className="text-sm text-muted-foreground" role="status">
              {number.format(result.total)} صورة · الصفحة{" "}
              {number.format(page + 1)}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {result.data.map((item) => (
                <Card key={item.id} className="gap-0 overflow-hidden py-0">
                  <button
                    type="button"
                    className="flex aspect-square items-center justify-center bg-muted p-3 focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => setPreview(item)}
                    aria-label={`معاينة ${item.caption || item.publicId}`}
                  >
                    <img
                      src={item.url}
                      alt={item.alt || item.caption || item.publicId}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain"
                    />
                  </button>
                  <CardContent className="flex flex-col gap-2 p-4">
                    <p className="truncate font-medium">
                      {item.caption || item.publicId.split("/").at(-1)}
                    </p>
                    <p
                      dir="ltr"
                      className="truncate text-start text-xs text-muted-foreground"
                    >
                      {item.publicId}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">
                        {item.format.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {bytes(item.bytes)} · {number.format(item.width)} ×{" "}
                        {number.format(item.height)}
                      </span>
                    </div>
                  </CardContent>
                  <CardFooter className="justify-between gap-1 border-t p-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`نسخ رابط ${item.caption || item.publicId}`}
                      onClick={() =>
                        void navigator.clipboard.writeText(item.url).then(
                          () => toast.success("تم نسخ الرابط"),
                          () => toast.error("تعذر نسخ الرابط"),
                        )
                      }
                    >
                      <Copy />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`تعديل ${item.caption || item.publicId}`}
                      onClick={() => setEdit(item)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`حذف ${item.caption || item.publicId}`}
                      onClick={() => {
                        setDeleteError("");
                        setDeleting(item);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
            <nav
              aria-label="صفحات مكتبة الصور"
              className="flex justify-between gap-3"
            >
              <Button
                variant="outline"
                disabled={page === 0 || query.isFetching}
                onClick={() => setPage((value) => value - 1)}
              >
                السابق
              </Button>
              <Button
                variant="outline"
                disabled={!result.nextCursor || query.isFetching}
                onClick={() => {
                  if (result.nextCursor) {
                    setCursors((values) => [
                      ...values.slice(0, page + 1),
                      result.nextCursor!,
                    ]);
                    setPage((value) => value + 1);
                  }
                }}
              >
                التالي
              </Button>
            </nav>
          </>
        )
      )}
      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={refresh}
      />
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(undefined);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.caption || "معاينة الصورة"}</DialogTitle>
            <DialogDescription>
              <span dir="ltr">{preview?.publicId}</span>
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <>
              <img
                src={preview.url}
                alt={preview.alt || preview.caption}
                className="max-h-[65vh] w-full object-contain"
              />
              <p className="text-sm text-muted-foreground">
                {new Date(preview.createdAt).toLocaleString("ar-EG", {
                  timeZone: "Africa/Cairo",
                })}{" "}
                · {bytes(preview.bytes)}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
      {edit && (
        <EditDialog
          key={edit.id}
          asset={edit}
          onClose={() => setEdit(undefined)}
          onSaved={refresh}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !deletion.isPending) setDeleting(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصورة نهائيًا؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف الملف من Cloudinary. يتحقق الخادم أولًا أن الصورة غير
              مستخدمة في الموقع. لا يمكن التراجع عن الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p dir="ltr" className="break-all text-sm">
            {deleting?.publicId}
          </p>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>
              إلغاء
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deletion.isPending}
              onClick={() => {
                if (deleting)
                  remove(
                    {
                      resource: MEDIA_RESOURCE,
                      id: deleting.id,
                      dataProviderName: MEDIA_PROVIDER,
                      meta: { publicId: deleting.publicId },
                      mutationMode: "pessimistic",
                    },
                    {
                      onSuccess: () => {
                        setDeleting(undefined);
                        reset();
                        void refresh();
                      },
                      onError: (error) => setDeleteError(error.message),
                    },
                  );
              }}
            >
              {deletion.isPending ? "جارٍ الحذف…" : "حذف الصورة"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => Promise<void>;
}) {
  const [folder, setFolder] = useState<string>(uploadFolders[0]);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState("images");
  const adapter = useLibraryUploadAdapter(folder);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) {
          toast.info("انتظر اكتمال الرفع أو ألغ الملفات أولًا.");
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>رفع صور للمكتبة</DialogTitle>
          <DialogDescription>
            صور JPG أو PNG أو WebP أو AVIF، حتى ٥ ميجابايت للصورة.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="upload-target">مجلد الرفع</FieldLabel>
            <Select value={folder} onValueChange={setFolder} disabled={pending}>
              <SelectTrigger id="upload-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {uploadFolders.map((value) => (
                    <SelectItem key={value} value={value}>
                      <span dir="ltr">{value}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="upload-kind">نوع الرفع</FieldLabel>
            <Select value={mode} onValueChange={setMode} disabled={pending}>
              <SelectTrigger id="upload-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="images">صور</SelectItem>
                  <SelectItem value="avatar">صورة شخصية</SelectItem>
                  <SelectItem value="logo">شعار</SelectItem>
                  <SelectItem value="product">صور منتج</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        {adapter ? (
          <LibraryUploader
            key={`${folder}:${mode}`}
            mode={mode}
            adapter={adapter}
            onPending={setPending}
            onUploaded={onUploaded}
          />
        ) : (
          <p role="alert" className="text-sm text-destructive">
            إعدادات اتصال Cloudinary غير مكتملة.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
function LibraryUploader({
  adapter,
  mode,
  onPending,
  onUploaded,
}: {
  adapter: UploadAdapter<CloudinaryUploadResult>;
  mode: string;
  onPending: (pending: boolean) => void;
  onUploaded: () => Promise<void>;
}) {
  const props = {
    adapter,
    accept: "image/jpeg,image/png,image/webp,image/avif",
    maxSize: 5 * 1024 * 1024,
    onPendingChange: onPending,
    onSuccess: () => {
      void onUploaded();
    },
  };
  if (mode === "avatar")
    return (
      <AvatarUpload
        {...props}
        onChange={(item) => {
          if (item) void onUploaded();
        }}
      />
    );
  if (mode === "logo")
    return (
      <LogoUpload
        {...props}
        name="الرحلة"
        title="رفع شعار"
        description="رفع صورة شعار إلى المكتبة."
      />
    );
  if (mode === "product")
    return (
      <>
        <ProductMediaUpload {...props} maxFiles={10} />
        <p className="text-sm text-muted-foreground">
          ترتيب الصور والغلاف هنا للمعاينة فقط؛ ربطها بمنتج يتم من نموذج المنتج.
        </p>
      </>
    );
  return <ImageUpload {...props} maxFiles={10} />;
}
function EditDialog({
  asset,
  onClose,
  onSaved,
}: {
  asset: MediaAsset;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { mutateAsync: update, mutation } = useUpdate();
  const [error, setError] = useState("");
  const form = useAppForm({
    defaultValues: {
      caption: asset.caption,
      alt: asset.alt,
      tags: asset.tags.join(", "),
    },
    validators: { onChange: assetEditSchema, onSubmit: assetEditSchema },
    onSubmit: async ({ value }) => {
      setError("");
      try {
        await update({
          resource: MEDIA_RESOURCE,
          id: asset.id,
          dataProviderName: MEDIA_PROVIDER,
          meta: { publicId: asset.publicId },
          values: {
            caption: value.caption,
            alt: value.alt,
            tags: value.tags
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          },
          mutationMode: "pessimistic",
        });
        await onSaved();
        onClose();
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "تعذر حفظ التغييرات.",
        );
      }
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل بيانات الصورة</DialogTitle>
          <DialogDescription>
            تعديل العنوان والوصف البديل والوسوم مع الاحتفاظ برابط الصورة.
          </DialogDescription>
        </DialogHeader>
        <form.AppForm>
          <form
            className="flex flex-col gap-5"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              <form.AppField name="caption">
                {(field) => (
                  <field.InputField
                    label="العنوان"
                    props={{ disabled: mutation.isPending }}
                  />
                )}
              </form.AppField>
              <form.AppField name="alt">
                {(field) => (
                  <field.TextareaField
                    label="الوصف البديل"
                    description="وصف يساعد مستخدمي قارئات الشاشة."
                    props={{ disabled: mutation.isPending }}
                  />
                )}
              </form.AppField>
              <form.AppField name="tags">
                {(field) => (
                  <field.InputField
                    label="الوسوم"
                    description="افصل الوسوم بفاصلة إنجليزية."
                    props={{ disabled: mutation.isPending }}
                  />
                )}
              </form.AppField>
            </FieldGroup>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <form.FormActions>
              <form.SubmitButton props={{ disabled: mutation.isPending }}>
                حفظ التغييرات
              </form.SubmitButton>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={onClose}
              >
                إلغاء
              </Button>
            </form.FormActions>
          </form>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  );
}
