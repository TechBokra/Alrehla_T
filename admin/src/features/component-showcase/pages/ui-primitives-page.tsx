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
import { ShowcaseLayout } from "../showcase-layout";

function ActionsSection() {
  return (
    <section id="actions" className="scroll-mt-24 space-y-5">
      <SectionHeading
        eyebrow="Refine · mutations"
        title="Resource actions"
        description="These are the generated Refine buttons. Navigation is intentionally inert here; delete and refresh use only the local preview provider."
      />
      <Card className="rounded-[24px] shadow-sm">
        <CardHeader className="border-b bg-muted/20 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Package className="size-5" />
              </span>
              <div>
                <CardTitle className="text-sm">Products resource</CardTitle>
                <CardDescription className="mt-1">
                  Record · prd-104 · Linen market tote
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline">Refine button components</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2.5 p-5">
          <CreateButton resource="products" />
          <EditButton
            resource="products"
            recordItemId="prd-104"
            variant="outline"
          />
          <ShowButton
            resource="products"
            recordItemId="prd-104"
            variant="outline"
          />
          <CloneButton
            resource="products"
            recordItemId="prd-104"
            variant="outline"
          />
          <ListButton resource="products" variant="ghost" />
          <RefreshButton resource="products" variant="secondary" />
          <DeleteButton resource="products" recordItemId="prd-104" />
        </CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <ActionNote
          title="Create / edit / clone"
          text="Resource-aware links and action labels come from Refine context."
        />
        <ActionNote
          title="Delete"
          text="Shows the generated confirmation popover before invoking deleteOne."
        />
        <ActionNote
          title="Refresh"
          text="Invalidates the local resource query and shows the pending state."
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
        eyebrow="Shadcn · primitives"
        title="Controls, overlays, and feedback"
        description="The installed primitives shown in their intended context: interactive menus, dialogs, calendar popover, command palette, and status states."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[24px] shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              Buttons, badges, and identity
            </CardTitle>
            <CardDescription>
              Variants and everyday account/status controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Button>
                <Plus /> Primary
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link style</Button>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Badge>New</Badge>
              <Badge variant="secondary">Active</Badge>
              <Badge variant="outline">Draft</Badge>
              <Badge variant="destructive">Needs attention</Badge>
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
            <CardTitle className="text-base">Overlays and navigation</CardTitle>
            <CardDescription>
              Dialog, sheet, dropdown, popover, tooltip, and collapsible
              patterns.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2.5">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus /> New item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create a preview item</DialogTitle>
                  <DialogDescription>
                    This dialog is a UI sample; it does not save to a server.
                  </DialogDescription>
                </DialogHeader>
                <Field>
                  <FieldLabel htmlFor="dialog-item-name">Name</FieldLabel>
                  <Input
                    id="dialog-item-name"
                    placeholder="e.g. Summer collection"
                  />
                </Field>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={() => toast.success("Preview saved")}>
                      Save preview
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Trash2 data-icon="inline-start" /> Delete preview
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this preview item?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This confirmation is only a component demo. It will not
                    delete a product or call the commerce API.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() =>
                      toast.info("Destructive action confirmed", {
                        description: "Preview only — no data was deleted.",
                      })
                    }
                  >
                    Delete preview
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Quick settings</SheetTitle>
                  <SheetDescription>
                    Slide-over panel for secondary controls.
                  </SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4">
                  <Field orientation="horizontal">
                    <Checkbox id="sheet-notifications" defaultChecked />
                    <FieldLabel htmlFor="sheet-notifications">
                      Email notifications
                    </FieldLabel>
                  </Field>
                  <Field>
                    <FieldLabel>Default collection</FieldLabel>
                    <Select defaultValue="accessories">
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="accessories">
                            Accessories
                          </SelectItem>
                          <SelectItem value="home">Home & living</SelectItem>
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
                  <MoreHorizontal /> More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Product actions</DropdownMenuLabel>
                <DropdownMenuItem>
                  <PencilIcon /> Edit details
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard /> View payments
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showDrafts}
                  onCheckedChange={setShowDrafts}
                >
                  Show drafts
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarDays />{" "}
                  {date ? date.toLocaleDateString() : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} />
              </PopoverContent>
            </Popover>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Help">
                    <LifeBuoy />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Contextual help tooltip</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button variant="outline" onClick={() => setCommandOpen(true)}>
              <CommandIcon /> Command menu{" "}
              <kbd className="ml-2 rounded border px-1.5 py-0.5 text-[10px]">
                ⌘K
              </kbd>
            </Button>
            <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
              <Command>
                <CommandInput placeholder="Search a page or action…" />
                <CommandList>
                  <CommandEmpty>No matching action.</CommandEmpty>
                  <CommandGroup heading="Quick actions">
                    <CommandItem onSelect={() => setCommandOpen(false)}>
                      <Search /> Search products
                    </CommandItem>
                    <CommandItem onSelect={() => setCommandOpen(false)}>
                      <Plus /> Create product
                    </CommandItem>
                    <CommandItem onSelect={() => setCommandOpen(false)}>
                      <Check /> Review orders
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </CommandDialog>

            <Collapsible className="w-full rounded-2xl border px-4 py-3">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
                Collapsible panel{" "}
                <ChevronRight className="size-4 transition-transform data-[state=open]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 text-sm text-muted-foreground">
                Use disclosure for secondary settings without leaving the
                current page.
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[24px] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Interaction state</CardTitle>
          <CardDescription>
            Try the theme toggle in the app header, or fire a local toast.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              toast.success("Changes saved", {
                description:
                  "This toast is rendered by the installed notification UI.",
              })
            }
          >
            <Check /> Show success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.info("New product draft", {
                description: "Sonner info state from the shared app toaster.",
              })
            }
          >
            Show info toast
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.warning("Review inventory", {
                description: "A low-stock warning example.",
              })
            }
          >
            Show warning toast
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.error("Could not save", {
                description: "Example error notification state.",
              })
            }
          >
            Show error state
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.promise(
                new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
                {
                  loading: "Saving local preview…",
                  success: "Local preview saved",
                  error: "Preview could not be saved",
                }
              )
            }
          >
            Show promise lifecycle
          </Button>
          <div className="ml-auto flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            <span>Preview provider connected</span>
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
        Component preview
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

export function UiPrimitivesPage({
  activeSection,
}: {
  activeSection: "ui-primitives";
}) {
  return (
    <ShowcaseLayout activeSection={activeSection}>
      <>
        <ActionsSection />
        <PrimitivesSection />
      </>
    </ShowcaseLayout>
  );
}
