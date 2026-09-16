import { useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { addBoard } from "@/lib/github/api";
import {
  BOARD_MAX,
  parseBoardSort,
  sortBoard,
  type BoardEntry,
  type BoardSort,
} from "@/lib/github/board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

const SORTS: { id: BoardSort; label: string }[] = [
  { id: "streak", label: "Streak" },
  { id: "consistency", label: "Consistency" },
  { id: "active", label: "Active days" },
  { id: "volume", label: "Volume" },
];

export function BoardView({
  entries,
  max = BOARD_MAX,
  sort: sortFromUrl,
}: {
  entries: BoardEntry[];
  max?: number;
  sort?: BoardSort;
}) {
  const navigate = useNavigate();
  const router = useRouter();
  const sort = parseBoardSort(sortFromUrl);
  const ranked = sortBoard(entries, sort);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function pickSort(next: BoardSort) {
    void navigate({
      to: "/board",
      search: next === "streak" ? {} : { s: next },
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
            Public board
          </p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            Shipping board
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Opt-in list of public GitHub profiles, ranked by last-12-month
            streak and consistency. Not a score. Cap {max}.
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
          {ranked.filter((row) => !row.error).length}/{max} profiles. Anyone
          can add a public handle.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {SORTS.map((row) => (
          <Button
            key={row.id}
            type="button"
            size="sm"
            variant={sort === row.id ? "default" : "outline"}
            onClick={() => pickSort(row.id)}
          >
            {row.label}
          </Button>
        ))}
      </div>

      <ol className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
        {ranked.map((row) => (
          <li key={row.username.toLowerCase()}>
            <Link
              to="/u/$username"
              params={{ username: row.profile?.login ?? row.username }}
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
                <span className="text-xs text-muted-foreground">{row.error}</span>
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-sm sm:grid-cols-4">
                  <Stat
                    label="Streak"
                    value={`${row.streak}d`}
                    active={sort === "streak"}
                  />
                  <Stat
                    label="Consistency"
                    value={`${Math.round(row.consistency * 100)}%`}
                    active={sort === "consistency"}
                  />
                  <Stat
                    label="Active"
                    value={formatCount(row.activeDays)}
                    active={sort === "active"}
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
        ))}
      </ol>
    </div>
  );
}

function Stat({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={cn(active ? "text-foreground" : "text-muted-foreground")}>
      <dt className="text-[10px] tracking-wide uppercase">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
