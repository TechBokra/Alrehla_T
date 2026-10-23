import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Command as CommandIcon,
  CreditCard,
  LifeBuoy,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { AutoSaveIndicator } from "@/components/refine-ui/form/auto-save-indicator";
import { CreateButton } from "@/components/refine-ui/buttons/create";
import { CloneButton } from "@/components/refine-ui/buttons/clone";
import { DeleteButton } from "@/components/refine-ui/buttons/delete";
import { EditButton } from "@/components/refine-ui/buttons/edit";
import { ListButton } from "@/components/refine-ui/buttons/list";
import { RefreshButton } from "@/components/refine-ui/buttons/refresh";
import { ShowButton } from "@/components/refine-ui/buttons/show";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ActionsSection() {
  return (
    <section id="actions" className="scroll-mt-24 space-y-5">
      <SectionHeading
        eyebrow="إجراءات البيانات"
        title="إجراءات المنتجات"
        description="أزرار Refine معروضة هنا للتجربة. التنقل غير مفعّل، والحذف والتحديث يعملان على بيانات المعاينة المحلية فقط."
      />
      <Card className="rounded-[24px] shadow-sm">
        <CardHeader className="border-b bg-muted/20 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package className="size-5" />
              </span>
              <div>
                <CardTitle className="text-sm">المنتجات</CardTitle>
                <CardDescription className="mt-1">
                  سجل · prd-104 · حقيبة قماش يومية
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline">أزرار Refine</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5 p-5">
          <CreateButton resource="products">إنشاء منتج</CreateButton>
          <EditButton
            resource="products"
            recordItemId="prd-104"
            variant="outline"
          >
            تعديل
          </EditButton>
          <ShowButton
            resource="products"
            recordItemId="prd-104"
            variant="outline"
          >
            عرض التفاصيل
          </ShowButton>
          <CloneButton
            resource="products"
            recordItemId="prd-104"
            variant="outline"
          >
            نسخ
          </CloneButton>
          <ListButton resource="products" variant="ghost">
            قائمة المنتجات
          </ListButton>
          <RefreshButton resource="products" variant="secondary">
            تحديث
          </RefreshButton>
          <DeleteButton resource="products" recordItemId="prd-104">
            حذف
          </DeleteButton>
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionNote
          title="إنشاء وتعديل ونسخ"
          text="تأتي الروابط وعناوين الإجراءات من إعدادات Refine."
        />
        <ActionNote
          title="حذف"
          text="يعرض رسالة تأكيد قبل حذف العنصر التجريبي."
        />
        <ActionNote
          title="تحديث"
          text="يحدّث بيانات المعاينة ويعرض حالة الانتظار."
        />
      </div>
    </section>
  );
}

function PrimitivesSection() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [commandOpen, setCommandOpen] = useState(false);
  const [showDrafts, setShowDrafts] = useState(true);

  return (
    <section id="primitives" className="scroll-mt-24 space-y-5">
      <SectionHeading
        eyebrow="Shadcn · عناصر الواجهة"
        title="عناصر التحكم والنوافذ والتنبيهات"
        description="مكوّنات تفاعلية تشمل القوائم والنوافذ والتقويم والبحث وحالات الإشعارات."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[24px] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              الأزرار والحالات والهوية
            </CardTitle>
            <CardDescription>
              أشكال الأزرار وعناصر الحساب والحالة.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button>
                <Plus /> أساسي
              </Button>
              <Button variant="secondary">ثانوي</Button>
              <Button variant="outline">محدد بإطار</Button>
              <Button variant="ghost">شفاف</Button>
              <Button variant="destructive">تحذير</Button>
              <Button variant="link">كرابط</Button>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Badge>جديد</Badge>
              <Badge variant="secondary">نشط</Badge>
              <Badge variant="outline">مسودة</Badge>
              <Badge variant="destructive">يتطلب الانتباه</Badge>
              <Avatar className="ml-2 size-9">
                <AvatarFallback>MC</AvatarFallback>
              </Avatar>
              <div className="grid gap-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <AutoSaveIndicator status="idle" />
              <AutoSaveIndicator status="pending" />
              <AutoSaveIndicator status="success" />
              <AutoSaveIndicator status="error" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">النوافذ والتنقل</CardTitle>
            <CardDescription>
              أمثلة للنوافذ والألواح والقوائم والتلميحات والعناصر القابلة للطي.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2.5">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus /> عنصر جديد
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إنشاء عنصر تجريبي</DialogTitle>
                  <DialogDescription>
                    هذه نافذة للتجربة فقط، ولن تُحفظ البيانات على الخادم.
                  </DialogDescription>
                </DialogHeader>
                <Field>
                  <FieldLabel htmlFor="dialog-item-name">الاسم</FieldLabel>
                  <Input
                    id="dialog-item-name"
                    placeholder="مثال: مجموعة الصيف"
                  />
                </Field>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">إلغاء</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={() => toast.success("تم حفظ المعاينة")}>
                      حفظ المعاينة
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Trash2 data-icon="inline-start" /> حذف المعاينة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف العنصر التجريبي؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    هذه الرسالة للتجربة فقط، ولن تحذف منتجًا أو تتصل بنظام
                    المتجر.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() =>
                      toast.info("تم تأكيد الإجراء", {
                        description: "معاينة فقط — لم يتم حذف أي بيانات.",
                      })
                    }
                  >
                    حذف المعاينة
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">فتح اللوحة</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>إعدادات سريعة</SheetTitle>
                  <SheetDescription>
                    لوحة جانبية لإعدادات إضافية.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4">
                  <Field orientation="horizontal">
                    <Checkbox id="sheet-notifications" defaultChecked />
                    <FieldLabel htmlFor="sheet-notifications">
                      تنبيهات البريد الإلكتروني
                    </FieldLabel>
                  </Field>
                  <Field>
                    <FieldLabel>المجموعة الافتراضية</FieldLabel>
                    <Select defaultValue="accessories">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="accessories">إكسسوارات</SelectItem>
                          <SelectItem value="home">المنزل والمعيشة</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </SheetContent>
            </Sheet>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontal /> المزيد
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>إجراءات المنتج</DropdownMenuLabel>
                <DropdownMenuItem>
                  <PencilIcon /> تعديل التفاصيل
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard /> عرض المدفوعات
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showDrafts}
                  onCheckedChange={setShowDrafts}
                >
                  عرض المسودات
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarDays />{" "}
                  {date ? date.toLocaleDateString("ar-EG") : "اختار تاريخًا"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} />
              </PopoverContent>
            </Popover>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="مساعدة">
                    <LifeBuoy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>مساعدة مرتبطة بالعنصر</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button variant="outline" onClick={() => setCommandOpen(true)}>
              <CommandIcon /> قائمة الأوامر{" "}
              <kbd className="ml-2 rounded border px-1.5 py-0.5 text-[10px]">
                ⌘K
              </kbd>
            </Button>
            <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
              <Command>
                <CommandInput placeholder="ابحث عن صفحة أو إجراء…" />
                <CommandList>
                  <CommandEmpty>لا توجد إجراءات مطابقة.</CommandEmpty>
                  <CommandGroup heading="إجراءات سريعة">
                    <CommandItem onSelect={() => setCommandOpen(false)}>
                      <Search /> البحث عن منتجات
                    </CommandItem>
                    <CommandItem onSelect={() => setCommandOpen(false)}>
                      <Plus /> إنشاء منتج
                    </CommandItem>
                    <CommandItem onSelect={() => setCommandOpen(false)}>
                      <Check /> مراجعة الطلبات
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </CommandDialog>

            <Collapsible className="w-full rounded-2xl border px-4 py-3">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
                لوحة قابلة للطي{" "}
                <ChevronRight className="size-4 transition-transform data-[state=open]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 text-sm text-muted-foreground">
                اعرض الإعدادات الإضافية دون مغادرة الصفحة.
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">حالات التفاعل</CardTitle>
          <CardDescription>
            جرّب تغيير المظهر من رأس الصفحة أو اعرض إشعارًا تجريبيًا.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              toast.success("تم حفظ التغييرات", {
                description: "يظهر هذا الإشعار عبر مكوّن التنبيهات المثبّت.",
              })
            }
          >
            <Check /> إظهار إشعار نجاح
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.info("مسودة منتج جديدة", {
                description: "مثال لإشعار معلومات داخل التطبيق.",
              })
            }
          >
            إظهار إشعار معلومات
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.warning("راجع المخزون", {
                description: "مثال على تنبيه بانخفاض المخزون.",
              })
            }
          >
            إظهار إشعار تحذير
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.error("تعذّر الحفظ", {
                description: "مثال على إشعار خطأ.",
              })
            }
          >
            إظهار إشعار خطأ
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.promise(
                new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
                {
                  loading: "جارٍ حفظ المعاينة…",
                  success: "تم حفظ المعاينة",
                  error: "تعذّر حفظ المعاينة",
                },
              )
            }
          >
            تجربة حالة الحفظ
          </Button>
          <div className="ml-auto flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            <span>مصدر بيانات المعاينة متصل</span>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          {eyebrow}
        </p>
        <h2 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
          {title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <span className="hidden items-center gap-1 whitespace-nowrap text-xs text-muted-foreground lg:inline-flex">
        <WandSparkles className="size-3.5" />
        معاينة للمكوّن
      </span>
    </div>
  );
}

function ActionNote({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}

function PencilIcon() {
  return <Pencil className="size-4" />;
}

export function UiPrimitivesPage() {
  return (
    <>
      <ActionsSection />
      <PrimitivesSection />
    </>
  );
}
