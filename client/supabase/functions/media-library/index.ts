import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const folders = [
  "alrehla/uploads",
  "alrehla/products",
  "alrehla/addons",
  "alrehla/site",
  "alrehla/blog",
  "alrehla/avatars",
];
const formats = "jpg,jpeg,png,webp,avif";
const preset = "alrehla_media_library";
const scanTables = [
  "site_settings",
  "page_content",
  "personalized_products",
  "addon_products",
  "standalone_services",
  "blog_posts",
  "box_subscription_plans",
  "box_subscriptions",
  "publishers",
  "user_profiles",
  "child_profiles",
  "service_providers",
  "instructor_media",
  "profile_update_requests",
  "testimonials",
  "orders",
  "order_items",
  "course_subscriptions",
  "service_orders",
  "service_order_messages",
  "session_attachments",
  "portfolio_documents",
  "join_requests",
];
class Failure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const env = (key: string) => Deno.env.get(key) ?? "";
const validId = (id: unknown): id is string =>
  typeof id === "string" &&
  id.startsWith("alrehla/") &&
  !id.startsWith("alrehla/private/") &&
  !id.includes("..") &&
  id.length < 500;
function asset(value: Record<string, any>) {
  return {
    id: value.asset_id,
    publicId: value.public_id,
    url: value.secure_url,
    caption: value.context?.custom?.caption ?? value.display_name ?? "",
    alt: value.context?.custom?.alt ?? "",
    tags: value.tags ?? [],
    format: value.format ?? "",
    bytes: value.bytes ?? 0,
    width: value.width ?? 0,
    height: value.height ?? 0,
    createdAt: value.created_at,
  };
}
async function cloud(path: string, method = "GET", body?: unknown) {
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(env("CLOUDINARY_CLOUD_NAME"))}${path}`,
    {
      method,
      headers: {
        Authorization: `Basic ${btoa(env("CLOUDINARY_API_KEY") + ":" + env("CLOUDINARY_API_SECRET"))}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!response.ok)
    throw new Failure(
      response.status === 429 ? 429 : 502,
      "تعذر إتمام الطلب لدى Cloudinary. حاول مرة أخرى.",
    );
  return await response.json();
}
async function signature(params: Record<string, string>) {
  const timestamp = Math.floor(Date.now() / 1000);
  const values = { ...params, timestamp: String(timestamp) };
  const text =
    Object.keys(values)
      .sort()
      .map((key) => `${key}=${values[key]}`)
      .join("&") + env("CLOUDINARY_API_SECRET");
  const hash = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(text),
  );
  return {
    apiKey: env("CLOUDINARY_API_KEY"),
    timestamp,
    signature: [...new Uint8Array(hash)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join(""),
  };
}
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(stringsIn);
  return [];
}
function references(text: string, publicId: string) {
  if (text === publicId) return true;
  const urls =
    text.match(/https?:\/\/res\.cloudinary\.com\/[^\s"'()<>\\]+/g) ?? [];
  return urls.some((url) => {
    try {
      const path = decodeURIComponent(new URL(url).pathname);
      return (
        path.includes("/upload/") &&
        (path.endsWith("/" + publicId) ||
          path.slice(0, path.lastIndexOf(".")).endsWith("/" + publicId))
      );
    } catch {
      return true;
    }
  });
}
async function assertUnused(publicId: string) {
  // Use the existing backend's full-row scan policy; incomplete reads fail closed.
  const service = createClient(
    env("SUPABASE_URL"),
    env("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  for (const table of scanTables) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await service
        .from(table)
        .select("*")
        .range(offset, offset + 499);
      if (error || !data)
        throw new Failure(503, "تعذر التحقق من استخدام الصورة. لم يتم حذفها.");
      if (
        data.some((row) =>
          stringsIn(row).some((text) => references(text, publicId)),
        )
      )
        throw new Failure(409, "هذه الصورة مستخدمة في الموقع ولا يمكن حذفها.");
      if (data.length < 500) break;
      if (offset >= 10_000)
        throw new Failure(
          503,
          "حجم فحص الاستخدام كبير. استخدم أداة تنظيف الوسائط الحالية.",
        );
    }
  }
}
export async function handleRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const allowed = (
    env("MEDIA_ALLOWED_ORIGINS") ||
    "http://localhost:4173,http://127.0.0.1:4173"
  ).split(",");
  const cors = {
    "Access-Control-Allow-Origin":
      origin && allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  const json = (status: number, body: unknown) =>
    Response.json(body, { status, headers: cors });
  if (origin && !allowed.includes(origin))
    return json(403, { error: "Origin not allowed" });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST")
    return json(405, { error: "Method not allowed" });
  try {
    const token = /^Bearer ([^\s]+)$/i.exec(
      request.headers.get("authorization") ?? "",
    )?.[1];
    if (!token) throw new Failure(401, "سجّل الدخول للمتابعة.");
    const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (error || !user)
      throw new Failure(401, "انتهت الجلسة. سجّل الدخول مجددًا.");
    const { data: profile, error: profileError } = await client
      .from("user_profiles")
      .select("role, archived_at, admin_role_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw new Failure(503, "تعذر التحقق من الصلاحيات.");
    if (
      !profile ||
      profile.archived_at ||
      user.app_metadata?.must_set_password === true ||
      !["super_admin", "general_supervisor"].includes(profile.role)
    )
      throw new Failure(403, "ليس لديك صلاحية إدارة الوسائط.");
    if (profile.role === "general_supervisor") {
      let roleQuery = client.from("admin_roles").select("permissions");
      roleQuery = profile.admin_role_id
        ? roleQuery.eq("id", profile.admin_role_id)
        : roleQuery.eq("is_default", true);
      const { data: role, error: roleError } = await roleQuery.maybeSingle();
      if (roleError) throw new Failure(503, "تعذر التحقق من صلاحيات المحتوى.");
      if (!role?.permissions?.includes("canManageContent"))
        throw new Failure(403, "ليس لديك صلاحية إدارة المحتوى.");
    }
    if (
      !env("CLOUDINARY_CLOUD_NAME") ||
      !env("CLOUDINARY_API_KEY") ||
      !env("CLOUDINARY_API_SECRET")
    )
      throw new Failure(503, "إعدادات Cloudinary غير مكتملة.");
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16_384)
      throw new Failure(413, "الطلب كبير جدًا.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new Failure(400, "طلب JSON غير صالح.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Failure(400, "طلب غير صالح.");
    if (body.action === "list") {
      const q =
        typeof body.search === "string" ? body.search.trim().slice(0, 100) : "";
      if (body.folder && !folders.includes(body.folder))
        throw new Failure(400, "مجلد غير مسموح.");
      let expression = `resource_type:image AND type:upload AND public_id:${body.folder || "alrehla"}/* AND NOT public_id:alrehla/private/*`;
      if (q) expression += ` AND ${JSON.stringify(q)}`;
      const result = await cloud("/resources/search", "POST", {
        expression,
        with_field: ["context", "tags"],
        sort_by: [{ created_at: body.sort === "asc" ? "asc" : "desc" }],
        max_results: 24,
        ...(typeof body.cursor === "string"
          ? { next_cursor: body.cursor.slice(0, 2000) }
          : {}),
      });
      return json(200, {
        data: result.resources.map(asset),
        total: result.total_count,
        nextCursor: result.next_cursor,
      });
    }
    if (body.action === "sign") {
      const params = body.params;
      const keys = Object.keys(params ?? {})
        .sort()
        .join(",");
      if (
        keys !== "allowed_formats,folder,overwrite,type,upload_preset" ||
        !folders.includes(params.folder) ||
        params.allowed_formats !== formats ||
        params.overwrite !== "false" ||
        params.type !== "upload" ||
        params.upload_preset !== preset
      )
        throw new Failure(400, "إعدادات رفع غير مسموحة.");
      if (
        !body.file ||
        !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
          body.file.type,
        ) ||
        !Number.isSafeInteger(body.file.size) ||
        body.file.size <= 0 ||
        body.file.size > 5 * 1024 * 1024
      )
        throw new Failure(400, "صيغة الملف أو حجمه غير مسموح.");
      return json(200, await signature(params));
    }
    if (
      !["update", "delete", "get"].includes(body.action) ||
      !validId(body.publicId)
    )
      throw new Failure(400, "طلب غير صالح.");
    const path =
      "/resources/image/upload/" +
      body.publicId.split("/").map(encodeURIComponent).join("%2F");
    const current = await cloud(path + "?context=true&tags=true");
    if (body.action === "get") return json(200, { data: asset(current) });
    if (body.action === "update") {
      if (
        typeof body.caption !== "string" ||
        body.caption.length > 200 ||
        typeof body.alt !== "string" ||
        body.alt.length > 500 ||
        !Array.isArray(body.tags) ||
        body.tags.length > 20 ||
        body.tags.some(
          (tag: unknown) =>
            typeof tag !== "string" || tag.length > 50 || /[|=\\,]/.test(tag),
        )
      )
        throw new Failure(400, "بيانات الصورة غير صالحة.");
      const context = {
        ...current.context?.custom,
        caption: body.caption.trim(),
        alt: body.alt.trim(),
      };
      const escapeContext = (value: string) =>
        value.replace(/([\\=|])/g, "\\$1");
      const contextString = Object.entries(context)
        .map(
          ([key, value]) =>
            `${escapeContext(key)}=${escapeContext(String(value))}`,
        )
        .join("|");
      await cloud(path, "POST", {
        context: contextString,
        tags: body.tags.join(","),
      });
      return json(200, {
        data: asset(await cloud(path + "?context=true&tags=true")),
      });
    }
    if (body.confirmPublicId !== body.publicId)
      throw new Failure(400, "تأكيد الحذف غير مطابق.");
    await assertUnused(body.publicId);
    const query = new URLSearchParams({
      "public_ids[]": body.publicId,
      invalidate: "true",
    });
    const deleted = await cloud("/resources/image/upload?" + query, "DELETE");
    if (!["deleted", "not_found"].includes(deleted.deleted?.[body.publicId]))
      throw new Failure(502, "لم يتم تأكيد حذف الصورة.");
    return json(200, { data: asset(current) });
  } catch (error) {
    if (error instanceof Failure)
      return json(error.status, { error: error.message });
    console.error(
      "Media library operation failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return json(500, { error: "تعذر إتمام العملية. حاول مرة أخرى." });
  }
}
Deno.serve(handleRequest);
