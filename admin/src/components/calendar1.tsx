import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "cn";

type CalendarId = "work" | "meetings" | "social" | "personal" | "important";
type CalendarView = "month" | "week";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  date: string;
  start?: string;
  end?: string;
  calendar: CalendarId;
};

type Draft = {
  id?: string;
  title: string;
  description: string;
  date: string;
  start: string;
  end: string;
  calendar: CalendarId;
};

type Calendar1Props = {
  className?: string;
};

const TODAY = new Date(2026, 9, 21);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CALENDARS: Record<
  CalendarId,
  { label: string; dot: string; chip: string }
> = {
  work: {
    label: "Work",
    dot: "bg-chart-1",
    chip: "bg-chart-1/15 hover:bg-chart-1/25",
  },
  meetings: {
    label: "Meetings",
    dot: "bg-chart-2",
    chip: "bg-chart-2/15 hover:bg-chart-2/25",
  },
  social: {
    label: "Social",
    dot: "bg-chart-3",
    chip: "bg-chart-3/15 hover:bg-chart-3/25",
  },
  personal: {
    label: "Personal",
    dot: "bg-chart-4",
    chip: "bg-chart-4/15 hover:bg-chart-4/25",
  },
  important: {
    label: "Important",
    dot: "bg-chart-5",
    chip: "bg-chart-5/15 hover:bg-chart-5/25",
  },
};

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "Sprint kickoff",
    date: "2026-09-28",
    start: "10:00",
    end: "11:00",
    calendar: "work",
  },
  {
    id: "2",
    title: "Team offsite",
    date: "2026-10-01",
    calendar: "social",
    description: "Full day at the lake house. Bus leaves at 8am.",
  },
  {
    id: "3",
    title: "Design review",
    date: "2026-10-02",
    start: "14:00",
    end: "15:00",
    calendar: "meetings",
  },
  {
    id: "4",
    title: "Standup",
    date: "2026-10-05",
    start: "09:00",
    end: "09:15",
    calendar: "meetings",
  },
  {
    id: "5",
    title: "Dentist",
    date: "2026-10-07",
    start: "15:30",
    end: "16:15",
    calendar: "personal",
  },
  {
    id: "6",
    title: "Investor update",
    date: "2026-10-08",
    start: "11:00",
    end: "12:00",
    calendar: "important",
  },
  {
    id: "7",
    title: "Product review",
    date: "2026-10-12",
    start: "11:00",
    end: "12:00",
    calendar: "meetings",
  },
  {
    id: "8",
    title: "Write release notes",
    date: "2026-10-12",
    start: "15:00",
    end: "16:00",
    calendar: "work",
  },
  {
    id: "9",
    title: "Interview",
    date: "2026-10-13",
    start: "16:30",
    end: "17:30",
    calendar: "important",
  },
  {
    id: "10",
    title: "Quarterly planning",
    date: "2026-10-16",
    start: "10:00",
    end: "12:30",
    calendar: "meetings",
  },
  {
    id: "11",
    title: "Farmers market",
    date: "2026-10-17",
    start: "09:00",
    end: "11:00",
    calendar: "personal",
  },
  {
    id: "12",
    title: "Standup",
    date: "2026-10-19",
    start: "09:00",
    end: "09:15",
    calendar: "meetings",
  },
  {
    id: "13",
    title: "Customer call",
    date: "2026-10-21",
    start: "10:30",
    end: "11:00",
    calendar: "work",
  },
  {
    id: "14",
    title: "Team lunch",
    date: "2026-10-21",
    start: "12:30",
    end: "13:30",
    calendar: "social",
  },
  {
    id: "15",
    title: "Yoga",
    date: "2026-10-21",
    start: "18:00",
    end: "19:00",
    calendar: "personal",
  },
  {
    id: "16",
    title: "Launch rehearsal",
    date: "2026-10-23",
    start: "16:00",
    end: "17:00",
    calendar: "work",
  },
  {
    id: "17",
    title: "Weekend hike",
    date: "2026-10-25",
    start: "08:00",
    end: "12:00",
    calendar: "personal",
  },
  {
    id: "18",
    title: "Board meeting",
    date: "2026-10-29",
    start: "09:30",
    end: "11:00",
    calendar: "important",
  },
  { id: "19", title: "Launch day", date: "2026-10-30", calendar: "important" },
  {
    id: "20",
    title: "Halloween party",
    date: "2026-10-31",
    start: "19:00",
    end: "23:00",
    calendar: "social",
  },
  {
    id: "21",
    title: "Retro",
    date: "2026-11-02",
    start: "14:00",
    end: "15:00",
    calendar: "meetings",
  },
];

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const shortMonthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
});
const longDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === 0
    ? `${displayHour}${suffix}`
    : `${displayHour}:${String(minute).padStart(2, "0")}${suffix}`;
}

function buildMonthDays(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const cells =
    Math.ceil((((first.getDay() + 6) % 7) + last.getDate()) / 7) * 7;
  return Array.from({ length: cells }, (_, index) => addDays(start, index));
}

function formatWeekRange(anchor: Date) {
  const start = startOfWeek(anchor);
  const end = addDays(start, 6);
  const endLabel =
    start.getMonth() === end.getMonth()
      ? String(end.getDate())
      : `${shortMonthFormatter.format(end)} ${end.getDate()}`;
  return `${shortMonthFormatter.format(start)} ${start.getDate()} – ${endLabel}, ${end.getFullYear()}`;
}

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  return (a.start ?? "").localeCompare(b.start ?? "");
}

const Calendar1 = ({ className }: Calendar1Props) => {
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(TODAY);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDate, setDropDate] = useState<string | null>(null);

  const days = useMemo(
    () =>
      view === "month"
        ? buildMonthDays(anchor)
        : Array.from({ length: 7 }, (_, index) =>
            addDays(startOfWeek(anchor), index)
          ),
    [anchor, view]
  );
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      map.set(event.date, [...(map.get(event.date) ?? []), event]);
    });
    map.forEach((list) => list.sort(sortEvents));
    return map;
  }, [events]);

  const isEditing = Boolean(draft?.id);
  const isAllDay = Boolean(draft && !draft.start && !draft.end);
  const draftDate = draft ? parseIsoDate(draft.date) : null;
  const hasTimeError = Boolean(
    draft &&
    !isAllDay &&
    (!draft.start || !draft.end || draft.end <= draft.start)
  );

  const step = (direction: number) =>
    setAnchor(
      view === "month"
        ? new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1)
        : addDays(anchor, direction * 7)
    );

  const openNewEvent = (date: string) =>
    setDraft({
      title: "",
      description: "",
      date,
      start: "09:00",
      end: "10:00",
      calendar: "work",
    });

  const openEvent = (event: CalendarEvent) =>
    setDraft({
      id: event.id,
      title: event.title,
      description: event.description ?? "",
      date: event.date,
      start: event.start ?? "",
      end: event.end ?? "",
      calendar: event.calendar,
    });

  const updateDraft = (patch: Partial<Draft>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));

  const handleSubmit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!draft || !draft.title.trim() || !draftDate || hasTimeError) return;
    const saved: CalendarEvent = {
      id: draft.id ?? String(Date.now()),
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      date: draft.date,
      start: isAllDay ? undefined : draft.start,
      end: isAllDay ? undefined : draft.end,
      calendar: draft.calendar,
    };
    setEvents((current) =>
      draft.id
        ? current.map((item) => (item.id === draft.id ? saved : item))
        : [...current, saved]
    );
    setDraft(null);
  };

  const handleDelete = () => {
    if (!draft?.id) return;
    setEvents((current) => current.filter((item) => item.id !== draft.id));
    setDraft(null);
  };

  const handleDrop = (dragEvent: DragEvent<HTMLDivElement>, date: string) => {
    dragEvent.preventDefault();
    if (draggingId) {
      setEvents((current) =>
        current.map((item) =>
          item.id === draggingId ? { ...item, date } : item
        )
      );
    }
    setDraggingId(null);
    setDropDate(null);
  };

  return (
    <section
      className={cn(
        "flex h-svh max-h-[1200px] min-h-[600px] w-full flex-col overflow-hidden bg-background text-foreground",
        className
      )}
    >
      <header className="flex min-h-14 items-center justify-between gap-3 border-b px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-semibold">
            Calendar -{" "}
            {view === "month"
              ? monthFormatter.format(anchor)
              : formatWeekRange(anchor)}
          </h2>
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={view === "month" ? "Previous month" : "Previous week"}
              onClick={() => step(-1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={view === "month" ? "Next month" : "Next week"}
              onClick={() => step(1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={view}
          onValueChange={(value) => {
            if (value === "month" || value === "week") setView(value);
          }}
          aria-label="Calendar view"
          className="shrink-0"
        >
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
        </ToggleGroup>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="sticky top-0 z-10 grid min-w-[720px] grid-cols-7 border-b bg-muted/40 backdrop-blur">
          {WEEKDAYS.map((weekday) => (
            <div
              key={weekday}
              className="flex h-10 items-center justify-end border-r px-3 text-xs font-medium text-muted-foreground last:border-r-0"
            >
              {weekday}
            </div>
          ))}
        </div>

        <div
          className="grid min-w-[720px] flex-1 grid-cols-7"
          style={{
            gridTemplateRows: `repeat(${days.length / 7}, minmax(${view === "month" ? "7.5rem" : "0"}, 1fr))`,
          }}
        >
          {days.map((date) => {
            const iso = toIsoDate(date);
            const dayEvents = eventsByDay.get(iso) ?? [];
            const isOutside =
              view === "month" && date.getMonth() !== anchor.getMonth();
            const isToday = iso === toIsoDate(TODAY);
            return (
              <div
                key={iso}
                onDragOver={(dragEvent) => {
                  if (!draggingId) return;
                  dragEvent.preventDefault();
                  setDropDate(iso);
                }}
                onDrop={(dragEvent) => handleDrop(dragEvent, iso)}
                className={cn(
                  "group flex min-h-0 cursor-pointer flex-col gap-1 border-r border-b px-2 pt-1.5 pb-2 transition-colors hover:bg-muted/30 [&:nth-child(7n)]:border-r-0",
                  isOutside && "bg-muted/30",
                  dropDate === iso && "bg-muted/60"
                )}
              >
                <div className="flex items-center justify-end gap-1.5 text-xs font-medium">
                  {date.getDate() === 1 ? (
                    <span className="text-muted-foreground">
                      {shortMonthFormatter.format(date)}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full",
                      isOutside && "text-muted-foreground",
                      isToday &&
                        "bg-primary font-semibold text-primary-foreground"
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>

                <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                  {dayEvents.map((event) => {
                    const eventDate = parseIsoDate(event.date);
                    const eventDateLabel = eventDate
                      ? longDayFormatter.format(eventDate)
                      : "an unknown date";

                    return (
                      <button
                        key={event.id}
                        type="button"
                        draggable
                        aria-label={`${event.title}${event.start ? ` at ${formatTime(event.start)}` : ""} on ${eventDateLabel}`}
                        onDragStart={(dragEvent) => {
                          dragEvent.dataTransfer.effectAllowed = "move";
                          dragEvent.dataTransfer.setData(
                            "text/plain",
                            event.id
                          );
                          setDraggingId(event.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropDate(null);
                        }}
                        onClick={() => openEvent(event)}
                        title={`${event.title} · ${eventDateLabel}`}
                        className={cn(
                          "flex h-7 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-xs font-medium transition-colors",
                          CALENDARS[event.calendar].chip,
                          draggingId === event.id && "opacity-40"
                        )}
                      >
                        <span
                          className={cn(
                            "h-4 w-0.5 shrink-0 rounded-full",
                            CALENDARS[event.calendar].dot
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 truncate">
                          {event.start ? (
                            <span className="mr-1.5 text-muted-foreground">
                              {formatTime(event.start)}
                            </span>
                          ) : null}
                          {event.title}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => openNewEvent(iso)}
                  aria-label={`Add event on ${longDayFormatter.format(date)}`}
                  className="mt-auto flex h-6 items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                >
                  <Plus className="size-3.5" />
                  Add event
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        <SheetContent className="min-h-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="shrink-0">
            <SheetTitle>{isEditing ? "Edit event" : "New event"}</SheetTitle>
            <SheetDescription>
              {draftDate
                ? longDayFormatter.format(draftDate)
                : "Choose a date for this event."}
            </SheetDescription>
          </SheetHeader>

          {draft ? (
            <form
              id="calendar1-event-form"
              onSubmit={handleSubmit}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="calendar1-title">Title</FieldLabel>
                  <Input
                    id="calendar1-title"
                    value={draft.title}
                    onChange={(event) =>
                      updateDraft({ title: event.target.value })
                    }
                    placeholder="Planning session"
                    required
                    autoFocus
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="calendar1-description">Notes</FieldLabel>
                  <Textarea
                    id="calendar1-description"
                    value={draft.description}
                    onChange={(event) =>
                      updateDraft({ description: event.target.value })
                    }
                    placeholder="Agenda, links, or anything to remember"
                    rows={3}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="calendar1-date">Date</FieldLabel>
                  <Input
                    id="calendar1-date"
                    type="date"
                    value={draft.date}
                    onChange={(event) =>
                      updateDraft({ date: event.target.value })
                    }
                    required
                  />
                </Field>
                <Field data-invalid={hasTimeError || undefined}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <FieldLabel htmlFor="calendar1-start">Starts</FieldLabel>
                      <Input
                        id="calendar1-start"
                        type="time"
                        value={draft.start}
                        onChange={(event) =>
                          updateDraft({ start: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <FieldLabel htmlFor="calendar1-end">Ends</FieldLabel>
                      <Input
                        id="calendar1-end"
                        type="time"
                        value={draft.end}
                        onChange={(event) =>
                          updateDraft({ end: event.target.value })
                        }
                        aria-invalid={hasTimeError || undefined}
                      />
                    </div>
                  </div>
                  <FieldDescription>
                    {hasTimeError
                      ? "The end time must be after the start time."
                      : "Clear both times for an all day event."}
                  </FieldDescription>
                </Field>
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-medium">Calendar</span>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    value={draft.calendar}
                    onValueChange={(value) => {
                      if (Object.hasOwn(CALENDARS, value)) {
                        updateDraft({ calendar: value as CalendarId });
                      }
                    }}
                    aria-label="Event calendar"
                    className="flex-wrap"
                  >
                    {(Object.keys(CALENDARS) as CalendarId[]).map((id) => (
                      <ToggleGroupItem
                        key={id}
                        value={id}
                        aria-label={`${CALENDARS[id].label} calendar`}
                        className="rounded-full"
                      >
                        <span
                          className={cn(
                            "size-2.5 rounded-full",
                            CALENDARS[id].dot
                          )}
                          aria-hidden="true"
                        />
                        {CALENDARS[id].label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </FieldGroup>
            </form>
          ) : null}

          <SheetFooter className="shrink-0 flex-row justify-between gap-2">
            {isEditing ? (
              <Button type="button" variant="ghost" onClick={handleDelete}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft(null)}
              >
                Cancel
              </Button>
              <Button type="submit" form="calendar1-event-form">
                {isEditing ? "Save" : "Add event"}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
};

export { Calendar1 };
