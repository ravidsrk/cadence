import { useState } from "react";
import {
  GitCommitHorizontal,
  GitPullRequest,
  Info,
  Sparkles,
} from "lucide-react";
import {
  intensityBracketForCount,
  intensityLevelForCount,
} from "@/lib/github/stats";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const HEAT_DOT_COLORS = [
  "bg-heat-0",
  "bg-heat-1",
  "bg-heat-2",
  "bg-heat-3",
  "bg-heat-4",
  "bg-heat-5",
] as const;

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

export function CountPair({
  commitsLabel,
  commitsHint,
  commitsError,
  publicCommits = 0,
  privateCommits = 0,
  contribLabel,
  contribCount = 0,
  bestDayCount = 0,
  mergedLabel,
  mergedHint,
  mergedError,
  publicMerged = 0,
  privateMerged = 0,
  openedPrsCount = 0,
  detailLoaded = true,
}: {
  commitsLabel: string;
  commitsHint: string;
  commitsError?: string;
  publicCommits?: number;
  privateCommits?: number;
  contribLabel: string;
  contribCount?: number;
  contribLevel?: number;
  bestDayCount?: number;
  mergedLabel: string;
  mergedHint: string;
  mergedError?: string;
  mergedCount?: number;
  publicMerged?: number;
  privateMerged?: number;
  openedPrsCount?: number;
  detailLoaded?: boolean;
}) {
  const totalCommits = publicCommits + privateCommits;
  const contribVsBestPct =
    bestDayCount > 0
      ? Math.min(100, Math.round((contribCount / bestDayCount) * 100))
      : contribCount > 0
        ? 100
        : 0;
  const level = intensityLevelForCount(contribCount);
  const bracket = intensityBracketForCount(contribCount);

  const commitsPart = Math.min(contribCount, totalCommits);
  const prsOpenedPart = Math.min(
    Math.max(0, contribCount - commitsPart),
    openedPrsCount,
  );
  const reviewsAndIssuesPart = Math.max(
    0,
    contribCount - commitsPart - prsOpenedPart,
  );

  return (
    <div className="mt-4 space-y-3 sm:mt-5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <div className="flex min-w-0 flex-col justify-between rounded-xl bg-secondary/50 p-3 shadow-[var(--shadow-border)] sm:p-3.5">
          <div>
            <div className="flex items-center justify-between gap-1 text-xs font-medium text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <GitPullRequest className="size-3.5 shrink-0 text-accent" />
                <span className="truncate">Merged PRs</span>
              </span>
              <InfoTooltip text="Counts pull requests authored or merged by this user that were merged on the selected UTC day (includes private repositories when accessible, otherwise public)." />
            </div>
            <p className="mt-2 font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl">
              {mergedLabel}
            </p>
          </div>
          <div className="mt-3 space-y-1.5">
            <PublicPrivateSplitBar
              publicCount={publicMerged}
              privateCount={privateMerged}
            />
            <p className="truncate font-mono text-xs text-muted-foreground tabular-nums">
              {mergedError ?? mergedHint}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-xl bg-secondary/50 p-3 shadow-[var(--shadow-border)] sm:p-3.5">
          <div>
            <div className="flex items-center justify-between gap-1 text-xs font-medium text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <GitCommitHorizontal className="size-3.5 shrink-0 text-accent" />
                <span className="truncate">Commits</span>
              </span>
              <InfoTooltip text="Counts public and private commits authored on the selected UTC day via GitHub commit search." />
            </div>
            <p className="mt-2 font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl">
              {commitsLabel}
            </p>
          </div>
          <div className="mt-3 space-y-1.5">
            <PublicPrivateSplitBar
              publicCount={publicCommits}
              privateCount={privateCommits}
            />
            <p className="truncate font-mono text-xs text-muted-foreground tabular-nums">
              {commitsError ?? commitsHint}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-between rounded-xl bg-secondary/50 p-3 shadow-[var(--shadow-border)] sm:p-3.5">
          <div>
            <div className="flex items-center justify-between gap-1 text-xs font-medium text-muted-foreground">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Sparkles className="size-3.5 shrink-0 text-accent" />
                <span className="truncate">Contributions</span>
              </span>
              <InfoTooltip text="Counts total GitHub contributions on the selected day across commits, pull requests opened, code reviews, and issues." />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
              <p className="font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl">
                {contribLabel}
              </p>
              <div
                data-contrib-bracket={bracket.label}
                className="inline-flex items-center gap-1.5 rounded-md bg-background/60 px-1.5 py-0.5 shadow-[var(--shadow-border)]"
                title={`${bracket.label} intensity (${bracket.rangeLabel} contributions)`}
              >
                <span className="font-mono text-[10px] font-medium text-muted-foreground">
                  {bracket.label}
                </span>
                <div className="flex items-center gap-0.5">
                  {([1, 2, 3, 4, 5] as const).map((lvl) => (
                    <span
                      key={lvl}
                      className={cn(
                        "size-1.5 rounded-[1.5px]",
                        level >= lvl ? HEAT_DOT_COLORS[lvl] : "bg-heat-0",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div
              role="progressbar"
              aria-valuenow={contribVsBestPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${contribVsBestPct}% of personal best day`}
              title={`${contribVsBestPct}% of personal best day`}
              className="h-1.5 overflow-hidden rounded-full bg-heat-0"
            >
              <div
                className="h-full rounded-full bg-heat-3 transition-all duration-300"
                style={{ width: `${contribVsBestPct}%` }}
              />
            </div>
            <p className="truncate font-mono text-xs text-muted-foreground tabular-nums">
              {bestDayCount > 0
                ? `${contribVsBestPct}% of personal best day`
                : "All GitHub activity"}
            </p>
          </div>
        </div>
      </div>

      <div
        data-day-breakdown="true"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-secondary/30 px-3 py-2 font-mono text-xs text-muted-foreground tabular-nums"
      >
        <span>Contribution breakdown</span>
        <span>
          {detailLoaded || contribCount === 0
            ? `${formatCount(commitsPart)} commits + ${formatCount(prsOpenedPart)} PRs opened + ${formatCount(reviewsAndIssuesPart)} reviews & issues`
            : `${formatCount(contribCount)} total contributions (commit & PR split unavailable)`}
        </span>
      </div>
    </div>
  );
}

function PublicPrivateSplitBar({
  publicCount,
  privateCount,
}: {
  publicCount: number;
  privateCount: number;
}) {
  const [open, setOpen] = useState(false);
  const total = publicCount + privateCount;
  const tip = `${formatCount(publicCount)} public · ${formatCount(privateCount)} private`;

  let pubPct = 0;
  let privPct = 0;
  if (total > 0) {
    if (publicCount > 0 && privateCount > 0) {
      pubPct = Math.max(8, Math.min(92, Math.round((publicCount / total) * 100)));
      privPct = 100 - pubPct;
    } else if (publicCount > 0) {
      pubPct = 100;
      privPct = 0;
    } else {
      pubPct = 0;
      privPct = 100;
    }
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <div
          role="img"
          tabIndex={0}
          data-split-bar="true"
          aria-label={tip}
          title={tip}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={cn(
            "flex h-1.5 w-full items-center overflow-hidden rounded-full bg-heat-0 outline-none focus-visible:ring-2 focus-visible:ring-accent",
            publicCount > 0 && privateCount > 0 && "gap-[2px]",
          )}
        >
          <div
            data-segment="public"
            className="h-full rounded-l-full bg-heat-4 transition-all duration-300"
            style={{ width: `${pubPct}%` }}
          />
          <div
            data-segment="private"
            className="h-full rounded-r-full bg-heat-2 transition-all duration-300"
            style={{ width: `${privPct}%` }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent className="font-mono text-xs tabular-nums">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={text}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
