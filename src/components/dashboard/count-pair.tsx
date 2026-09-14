import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CountPair({
  commitsLabel,
  commitsHint,
  commitsError,
  contribLabel,
}: {
  commitsLabel: string;
  commitsHint: string;
  commitsError?: string;
  contribLabel: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-end gap-8">
      <div>
        <p className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
          Public commits
          <Why
            text="Commits GitHub search reports as authored by this login on that UTC day, on public default branches. Cadence lists up to the first 100."
          />
        </p>
        <p className="mt-1 font-mono text-5xl leading-none font-medium tracking-tight tabular-nums sm:text-6xl">
          {commitsLabel}
        </p>
        {commitsError ? (
          <p className="mt-2 max-w-xs text-xs text-muted-foreground">
            {commitsError}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{commitsHint}</p>
        )}
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
          GitHub contributions
          <Why
            text="The number on that square of GitHub’s contribution graph: commits, pull requests, reviews, and issues, including private work GitHub is allowed to count. These two numbers often disagree."
          />
        </p>
        <p className="mt-1 font-mono text-3xl font-medium tabular-nums">
          {contribLabel}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Commits, PRs, reviews, issues
        </p>
      </div>
    </div>
  );
}

function Why({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label={text}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}
