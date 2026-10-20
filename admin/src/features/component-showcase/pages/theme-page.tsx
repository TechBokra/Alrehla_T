import { Blocks, Palette, ShieldCheck, Sparkles, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShowcaseLayout } from "../showcase-layout";

function OverviewSection() {
  return (
    <section id="overview" className="scroll-mt-24 space-y-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] xl:items-stretch">
        <div className="relative flex min-h-[330px] flex-col justify-between overflow-hidden rounded-[28px] border bg-card p-7 shadow-sm sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative space-y-5">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Sparkles className="size-3.5" />
              Frontend system preview
            </Badge>
            <div className="max-w-3xl space-y-3">
              <h1 className="text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Calesee Admin,
                <br />
                <span className="text-primary">component by component.</span>
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Use the sidebar to explore the theme, UI primitives, data
                views, and field/form patterns on their own pages.
              </p>
            </div>
          </div>
          <div className="relative mt-8 flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="rounded-full bg-background/75 px-3 py-1"
            >
              preset · b2pQWmaCB
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full bg-background/75 px-3 py-1"
            >
              shadcn/ui · latest CLI
            </Badge>
            <Badge
              variant="outline"
              className="rounded-full bg-background/75 px-3 py-1"
            >
              Refine · source components
            </Badge>
          </div>
        </div>

        <Card className="rounded-[28px] shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Theme tokens</CardTitle>
                <CardDescription className="mt-1">
                  Live semantic colors from the applied preset
                </CardDescription>
              </div>
              <PaletteIcon />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-2">
              <ColorToken
                label="Primary"
                color="bg-primary"
                text="text-primary-foreground"
              />
              <ColorToken
                label="Secondary"
                color="bg-secondary"
                text="text-secondary-foreground"
              />
              <ColorToken
                label="Accent"
                color="bg-accent"
                text="text-accent-foreground"
              />
              <ColorToken
                label="Surface"
                color="bg-card"
                text="text-card-foreground"
              />
              <ColorToken
                label="Border"
                color="bg-muted"
                text="text-muted-foreground"
              />
              <ColorToken
                label="Danger"
                color="bg-destructive"
                text="text-white"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                Charts · green family
              </span>
              <div className="flex gap-1.5" aria-label="Chart palette">
                {[1, 2, 3, 4, 5].map((number) => (
                  <span
                    key={number}
                    className="size-5 rounded-full border border-background shadow-sm"
                    style={{ backgroundColor: `var(--chart-${number})` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Corner radius</span>
              <span className="font-medium tabular-nums">
                0.45rem · compact
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <QuickStat
          icon={<Blocks />}
          label="UI primitives"
          value="30+"
          detail="inputs, overlays, navigation"
        />
        <QuickStat
          icon={<Table2 />}
          label="Refine modules"
          value="4 groups"
          detail="views, data table, auth, actions"
        />
        <QuickStat
          icon={<ShieldCheck />}
          label="Preview safety"
          value="Local only"
          detail="no production API or auth calls"
        />
      </div>
    </section>
  );
}

function ColorToken({
  label,
  color,
  text,
}: {
  label: string;
  color: string;
  text: string;
}) {
  return (
    <div
      className={`flex h-14 items-end rounded-xl border p-2 ${color} ${text}`}
    >
      <span className="text-[11px] font-medium">{label}</span>
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-[22px] shadow-sm">
      <CardContent className="flex items-center gap-4 p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-semibold">{value}</span>
            <span className="hidden truncate text-xs text-muted-foreground 2xl:block">
              {detail}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PaletteIcon() {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Palette className="size-4" />
    </span>
  );
}

export function ThemePage({ activeSection }: { activeSection: "theme" }) {
  return (
    <ShowcaseLayout activeSection={activeSection}>
      <OverviewSection />
    </ShowcaseLayout>
  );
}
