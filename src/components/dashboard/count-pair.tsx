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
  mergedLabel,
  mergedHint,
  mergedError,
}: {
  commitsLabel: string;
  commitsHint: string;
  commitsError?: string;
  contribLabel: string;
  mergedLabel: string;
  mergedHint: string;
  mergedError?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-end gap-8">
      <div>
        <p className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
          Merged PRs
          <Why
            text="Every public pull request merged on that UTC day that this login opened or merged. GitHub search stops at 1,000."
          />
        </p>
        <p className="mt-1 font-mono text-4xl leading-none font-medium tracking-tight tabular-nums sm:text-5xl">
          {mergedLabel}
        </p>
        {mergedError ? (
          <p className="mt-2 max-w-xs text-xs text-muted-foreground">
            {mergedError}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{mergedHint}</p>
        )}
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-xs tracking-wide text-muted-foreground uppercase">
          Commits
          <Why
            text="Public and private commits authored that UTC day. Private commits are counted, not listed. GitHub search stops at 1,000."
          />
        </p>
        <p className="mt-1 font-mono text-4xl leading-none font-medium tracking-tight tabular-nums sm:text-5xl">
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
