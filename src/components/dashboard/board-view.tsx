import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { addBoard } from "@/lib/github/api";
import {
  BOARD_MAX,
  boardSearchFromState,
  parseBoardSort,
  sortBoard,
  type BoardEntry,
  type BoardSort,
} from "@/lib/github/board";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

const SORTS: { id: BoardSort; label: string }[] = [
  { id: "peak", label: "Peak day" },
  { id: "streak", label: "Streak" },
  { id: "volume", label: "Volume" },
  { id: "active", label: "Active days" },
];

export function BoardView({
  entries,
  max = BOARD_MAX,
  sort: sortFromUrl,
  date,
  today,
}: {
  entries: BoardEntry[];
  max?: number;
  sort?: BoardSort;
  date?: string;
  today: string;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const sort = date ? "day" : parseBoardSort(sortFromUrl);
  const ranked = sortBoard(entries, sort, date);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selected = date ? parseISO(date) : undefined;

  function go(next: { sort?: BoardSort; date?: string | null }) {
    const nextSort = next.sort ?? (date ? "peak" : sort);
    const nextDate = next.date === null ? undefined : (next.date ?? date);
    void navigate({
      to: "/board",
      search: boardSearchFromState({
        sort: nextDate ? "day" : nextSort,
        date: nextDate,
      }),
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await addBoard({ data: { username: draft } });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setDraft("");
      setMessage(result.already ? "Already on the board." : "Added.");
      await router.invalidate();
    } catch {
      setMessage("Could not add that profile.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Daily board
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Biggest day
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Who on this board had the most GitHub contributions in a single
            day. Pick a date to rank that day only. Still public data, cap{" "}
            {max}.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Dashboard
          </Link>
          <Link
            to="/docs"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Docs
          </Link>
        </nav>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-start"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="github.com/username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          Add to board
        </Button>
      </form>
      {message ? (
        <p className="-mt-4 text-xs text-muted-foreground">{message}</p>
      ) : (
        <p className="-mt-4 text-xs text-muted-foreground">
          {ranked.filter((row) => !row.error).length}/{max} profiles. Counts
          are GitHub contributions that day, including private work GitHub
          reports.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {SORTS.map((row) => (
          <Button
            key={row.id}
            type="button"
            size="sm"
            variant={!date && sort === row.id ? "default" : "outline"}
            onClick={() => go({ sort: row.id, date: null })}
          >
            {row.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant={date ? "default" : "outline"}
              className="gap-2"
            >
              <CalendarDays />
              {date ? format(parseISO(date), "d MMM yyyy") : "Pick a day"}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(day) => {
                if (!day) return;
                const iso = format(day, "yyyy-MM-dd");
                if (iso > today) return;
                go({ date: iso });
              }}
              disabled={{ after: new Date() }}
              defaultMonth={selected ?? parseISO(today)}
            />
          </PopoverContent>
        </Popover>
        {date ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => go({ sort: "peak", date: null })}
          >
            Clear day
          </Button>
        ) : null}
      </div>

      <ol className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {ranked.map((row) => {
          const dayCount = date ? (row.byDate[date] ?? 0) : null;
          return (
            <li key={row.username.toLowerCase()}>
              <Link
                to="/u/$username"
                params={{ username: row.profile?.login ?? row.username }}
                search={date ? { d: date } : {}}
                className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5"
              >
                <span className="w-8 font-mono text-sm tabular-nums text-muted-foreground">
                  {row.rank}
                </span>
                {row.profile ? (
                  <img
                    src={row.profile.avatarUrl}
                    alt=""
                    className="size-8 rounded-full outline outline-1 -outline-offset-1 outline-foreground/10"
                  />
                ) : (
                  <span className="size-8 rounded-full bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {row.profile?.name || row.profile?.login || row.username}
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    @{row.profile?.login ?? row.username}
                  </span>
                </span>
                {row.error ? (
                  <span className="text-xs text-muted-foreground">
                    {row.error}
                  </span>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-sm sm:grid-cols-3">
                    {date ? (
                      <Stat
                        label={format(parseISO(date), "d MMM")}
                        value={formatCount(dayCount ?? 0)}
                        active
                      />
                    ) : (
                      <Stat
                        label="Peak"
                        value={
                          row.bestDay
                            ? `${formatCount(row.bestDay.count)}`
                            : "—"
                        }
                        hint={
                          row.bestDay
                            ? format(parseISO(row.bestDay.date), "d MMM")
                            : undefined
                        }
                        active={sort === "peak"}
                      />
                    )}
                    <Stat
                      label="Streak"
                      value={`${row.streak}d`}
                      active={sort === "streak"}
                    />
                    <Stat
                      label="Volume"
                      value={formatCount(row.total)}
                      active={sort === "volume"}
                    />
                  </dl>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  active,
}: {
  label: string;
  value: string;
  hint?: string;
  active: boolean;
}) {
  return (
    <div className={cn(active ? "text-foreground" : "text-muted-foreground")}>
      <dt className="text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="font-mono tabular-nums">
        {value}
        {hint ? (
          <span className="ml-1 text-[10px] font-sans text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}
