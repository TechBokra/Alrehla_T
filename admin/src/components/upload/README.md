# Upload components

`/uploads` uses the installed UploadCN blocks: ImageUpload, AvatarUpload (crop), LogoUpload and ProductMediaUpload. FileUpload is also reusable. Shared primitives live in `components/ui/upload.tsx`; blocks accept an explicit adapter. `onPendingChange` protects the page dialog from interrupting queued, processing or paused uploads.

## Real Cloudinary integration

`hooks/uploads/use-library-upload-adapter.ts` builds the shared signed adapter. Supabase's existing `media-library` Edge Function authenticates the current admin, checks content permissions and signs restricted image parameters. The browser uploads bytes directly to Cloudinary. Successful media-library uploads invalidate the Refine media list.

Resource form pages declare upload slots in their page definition. The shared
resource upload layer creates a non-auto-starting UploadCN queue for each slot;
the registered `ImageUploadField` selects files and shows queue state. Product
submission waits for the selected cover upload to complete before calling the
Refine CRUD mutation, and aborts that mutation when upload preparation fails.

The `/uploads` grid supports folder/search filters, date sorting, cursor pagination, previews, copying URLs, caption/alt/tags editing and deletion. Refine uses the named `mediaLibrary` provider. Product-media ordering in the upload dialog is a local preview; it does not save product associations. Removing queued items does not delete Cloudinary assets.

## Backend setup

Source: `client/supabase/functions/media-library/index.ts` (from the repository root). Configure Supabase secrets `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and comma-separated `MEDIA_ALLOWED_ORIGINS`. Supabase supplies its own URL and auth keys. Keep all secret keys outside Vite variables.

Deploy `media-library` using the existing Supabase project. Its config disables the gateway JWT check; the handler explicitly validates tokens using `auth.getUser` and checks current admin permissions. The function provides list/get/sign/update/delete actions, scopes public images to `alrehla/`, excludes private assets, and rechecks resource references before deletion. Incomplete scans block deletion.

Use a signed `alrehla_media_library` preset with supported JPG/JPEG/PNG/WebP/AVIF formats, unique names and overwrite disabled. UI and declared-metadata preflight limit images to 5 MiB. Cloudinary has account-level size limits, not per-preset byte limits. Frontend settings: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`.

The generic `cloudinary.ts` factory can also receive a custom authenticated signer. Form fields require an explicit adapter and a separate resource-save operation. No Next.js API route or browser Cloudinary SDK is required.
