import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Code2,
  Copy,
  Share2,
} from "lucide-react";
import { AppHeader } from "@/components/dashboard/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DOC_SECTIONS, type DocBlock } from "@/lib/docs/content";
import {
  normalizeUsername,
  profilePath,
  profileRoute,
} from "@/lib/github/username";
import { SITE_ORIGIN } from "@/lib/site";
import { cn } from "@/lib/utils";

const STUDIO_PRESETS = [
  "ravidsrk",
  "sindresorhus",
  "yyx990803",
  "Rich-Harris",
  "shadcn",
] as const;

export function DocsPage() {
  const [studioInput, setStudioInput] = useState("ravidsrk");
  const [studioUser, setStudioUser] = useState("ravidsrk");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copySnippet = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const applyStudioUser = (raw: string) => {
    const cleaned = normalizeUsername(raw) ?? "ravidsrk";
    setStudioInput(cleaned);
    setStudioUser(cleaned);
  };

  const userProfileUrl = `${SITE_ORIGIN}${profilePath(studioUser)}`;
  const badgeMd = `[![Cadence Streak](${SITE_ORIGIN}/api/badge/${studioUser}.svg)](${userProfileUrl})`;
  const skylineMd = `[![${studioUser}'s 3D GitHub Skyline](${SITE_ORIGIN}/api/heatmap/${studioUser}.svg?view=3d)](${userProfileUrl})`;
  const heatmapMd = `[![${studioUser}'s GitHub Cadence](${SITE_ORIGIN}/api/heatmap/${studioUser}.svg)](${userProfileUrl})`;
  const iframeHtml = `<iframe src="${SITE_ORIGIN}/embed/${studioUser}" width="100%" height="340" frameborder="0" loading="lazy"></iframe>`;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 overflow-x-hidden px-3.5 py-4 sm:gap-8 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-3.5 sm:gap-5">
        <AppHeader subtitle="Product docs & Embed Studio" />
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
            How Cadence works
          </h1>
          <p className="max-w-2xl text-xs text-muted-foreground sm:text-sm">
            Reference guide for the 4-Pillar Cadence Score, isometric 3D
            contribution skylines, competitive league cohorts, and live README
            SVG embeds.
          </p>
        </div>
      </header>

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)] sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Share2 className="size-4 text-accent" />
              <h2 className="font-display text-lg font-semibold sm:text-xl">
                Interactive README & Embed Studio
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enter any GitHub handle to preview live SVG cards and copy
              ready-to-paste Markdown or HTML snippets.
            </p>
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyStudioUser(studioInput);
            }}
          >
            <Input
              value={studioInput}
              onChange={(e) => setStudioInput(e.target.value)}
              placeholder="GitHub username..."
              aria-label="Preview username for embeds"
              className="h-8 min-w-0 flex-1 font-mono text-xs sm:w-52 sm:flex-none"
            />
            <Button type="submit" size="sm" className="h-8 shrink-0 text-xs">
              Preview
            </Button>
          </form>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Presets:
          </span>
          {STUDIO_PRESETS.map((handle) => (
            <button
              key={handle}
              type="button"
              onClick={() => applyStudioUser(handle)}
              className={cn(
                "rounded-full px-2.5 py-0.5 font-mono text-xs transition-colors",
                studioUser.toLowerCase() === handle.toLowerCase()
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              @{handle}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="flex flex-col justify-between gap-3 rounded-xl bg-secondary/40 p-3.5 shadow-[var(--shadow-border)] sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Compact streak badge
              </span>
              <button
                type="button"
                onClick={() => void copySnippet("badge", badgeMd)}
                className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs font-medium text-accent shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
              >
                {copiedId === "badge" ? (
                  <>
                    <Check className="size-3" />
                    Copied MD
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy MD
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center overflow-x-auto rounded-lg bg-background/60 p-3.5 sm:p-4">
              <img
                src={`/api/badge/${encodeURIComponent(studioUser)}.svg`}
                alt={`Cadence streak badge preview for ${studioUser}`}
                className="h-7 w-auto"
                loading="lazy"
              />
            </div>
            <code className="truncate rounded bg-background/50 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {badgeMd}
            </code>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-xl bg-secondary/40 p-3.5 shadow-[var(--shadow-border)] sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                3D Skyline SVG
              </span>
              <button
                type="button"
                onClick={() => void copySnippet("skyline", skylineMd)}
                className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs font-medium text-accent shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
              >
                {copiedId === "skyline" ? (
                  <>
                    <Check className="size-3" />
                    Copied MD
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy MD
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-background/60 p-3">
              <img
                src={`/api/heatmap/${encodeURIComponent(studioUser)}.svg?view=3d`}
                alt={`Cadence 3D skyline SVG preview for ${studioUser}`}
                className="max-h-24 w-auto"
                loading="lazy"
              />
            </div>
            <code className="truncate rounded bg-background/50 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {skylineMd}
            </code>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-xl bg-secondary/40 p-3.5 shadow-[var(--shadow-border)] sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                2D Heatmap SVG
              </span>
              <button
                type="button"
                onClick={() => void copySnippet("heatmap", heatmapMd)}
                className="inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs font-medium text-accent shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
              >
                {copiedId === "heatmap" ? (
                  <>
                    <Check className="size-3" />
                    Copied MD
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    Copy MD
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-lg bg-background/60 p-3">
              <img
                src={`/api/heatmap/${encodeURIComponent(studioUser)}.svg`}
                alt={`Cadence heatmap SVG preview for ${studioUser}`}
                className="max-h-24 w-auto"
                loading="lazy"
              />
            </div>
            <code className="truncate rounded bg-background/50 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {heatmapMd}
            </code>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-secondary/30 p-3 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Code2 className="size-4 shrink-0 text-accent" />
            <span className="shrink-0 text-xs font-medium">
              Interactive Iframe:
            </span>
            <code className="truncate font-mono text-[11px] text-muted-foreground">
              {iframeHtml}
            </code>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void copySnippet("iframe", iframeHtml)}
              className="inline-flex items-center gap-1 rounded-md bg-card px-2.5 py-1 text-xs font-medium text-accent shadow-[var(--shadow-border)] transition-colors hover:bg-secondary"
            >
              {copiedId === "iframe" ? (
                <>
                  <Check className="size-3" />
                  Copied HTML
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  Copy HTML
                </>
              )}
            </button>
            <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
              <Link
                to={profileRoute(studioUser)}
                params={{ username: studioUser }}
              >
                Open @{studioUser}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 sm:gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav
          aria-label="Docs sections"
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <ul className="no-scrollbar flex flex-nowrap gap-1 overflow-x-auto rounded-2xl bg-card p-1.5 shadow-[var(--shadow-border)] lg:flex-col lg:gap-0.5 lg:p-2">
            {DOC_SECTIONS.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:py-2 sm:text-sm"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="flex min-w-0 max-w-3xl flex-col gap-8 pb-8 sm:gap-10 sm:pb-10">
          {DOC_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-6">
              <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
                {section.title}
              </h2>
              <div className="mt-3 flex flex-col gap-3.5 sm:mt-4 sm:gap-4">
                {section.blocks.map((block, index) => (
                  <DocBlockView
                    key={`${section.id}-${index}`}
                    block={block}
                  />
                ))}
              </div>
            </section>
          ))}
        </article>
      </div>

      <footer className="pb-4 text-xs text-muted-foreground">
        Cadence reads public GitHub data only.{" "}
        <Link to="/" className="text-foreground/80 hover:underline">
          Open the dashboard
        </Link>
        .
      </footer>
    </div>
  );
}

function DocBlockView({ block }: { block: DocBlock }) {
  if (block.type === "p") {
    return (
      <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
        {block.text}
      </p>
    );
  }
  if (block.type === "h3") {
    return (
      <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
        {block.text}
      </h3>
    );
  }
  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground/90 break-words">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === "callout") {
    return (
      <p
        className={cn(
          "rounded-2xl bg-secondary/50 px-4 py-3 text-sm leading-relaxed text-foreground/90 text-pretty",
          "shadow-[var(--shadow-border)]",
        )}
      >
        {block.text}
      </p>
    );
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {block.items.map((item) => (
        <div
          key={item.term}
          className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]"
        >
          <dt className="font-display text-sm font-semibold text-accent">
            {item.term}
          </dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
            {item.def}
          </dd>
        </div>
      ))}
    </dl>
  );
}
