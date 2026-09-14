import { Link } from "@tanstack/react-router";
import { DOC_SECTIONS, type DocBlock } from "@/lib/docs/content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DocsPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 overflow-x-hidden px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Product docs
          </p>
          <h1 className="font-display text-3xl tracking-tight text-foreground sm:text-4xl">
            <Link to="/" className="hover:opacity-80">
              Cadence
            </Link>
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            How lookup, the heatmap, and the commit log actually work.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-fit">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </header>

      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="Docs sections"
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <ul className="flex flex-wrap gap-1 lg:flex-col lg:gap-0">
            {DOC_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="flex min-w-0 max-w-2xl flex-col gap-10 pb-10">
          {DOC_SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-6">
              <h2 className="font-display text-2xl tracking-tight">
                {section.title}
              </h2>
              <div className="mt-4 flex flex-col gap-4">
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
    return <p className="text-sm leading-relaxed text-pretty">{block.text}</p>;
  }
  if (block.type === "h3") {
    return (
      <h3 className="mt-2 font-display text-lg tracking-tight">{block.text}</h3>
    );
  }
  if (block.type === "ul") {
    return (
      <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed break-words">
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
          "rounded-2xl bg-card px-4 py-3 text-sm leading-relaxed text-pretty",
          "shadow-[var(--shadow-border)]",
        )}
      >
        {block.text}
      </p>
    );
  }
  return (
    <dl className="space-y-4">
      {block.items.map((item) => (
        <div key={item.term} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">
            {item.term}
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-pretty">{item.def}</dd>
        </div>
      ))}
    </dl>
  );
}
